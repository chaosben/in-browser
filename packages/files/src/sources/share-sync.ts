import { isHidden } from '../path.js';
import type { Rebindable } from '../p2p/live-ends.js';
import type { Network } from '../p2p/network.js';
import type { Rpc } from '../p2p/rpc.js';
import { drive, Gate, type DriveResult } from '../p2p/session.js';
import { handleTree } from '../sync/handle-tree.js';
import { ignored, type Base, type Snapshot } from '../sync/plan.js';
import type { Tree } from '../sync/tree.js';
import { shareClient, type ShareInfo, type ShareSession } from './share.js';

// A guest's copy of a share, kept in sync (decided by the user: a share brings the data into the guest's browser
// like the sync between devices, reduced to two – it was shared on purpose, and what was opened must work without
// the connection). One page of the guest's browser holds the connection and drives the sessions (`p2p/session.ts`
// `drive`; the sharing device answers on the tree of the share, `p2p/share-tree.ts`): when it connects, when the
// sharing device says something changed, after changes here and every minute. A share for viewing is a mirror: the
// copy only follows. Before a share that is large or doesn't fit is fetched, the guest is asked (`ask`, `allow`).

export interface ShareSyncState {
	/** `connecting`: no answer yet; `offline`: the sharing device can't be reached now; `syncing`; `synced`: the copy
	 * is as the share was a moment ago; `waiting`: the guest is asked before it is fetched (`ask`) */
	phase: 'connecting' | 'offline' | 'syncing' | 'synced' | 'waiting';
	done?: number;
	total?: number;
	/** The share's size waiting for the guest's yes; `full`: it doesn't fit the free space here */
	ask?: { bytes: number; full: boolean };
	/** Steps of the last session that failed */
	failed?: number;
	/** `offline` because another browser has the share open right now (one guest at a time) */
	taken?: boolean;
}

export interface ShareSyncOptions {
	session: Pick<ShareSession, 'code' | 'token' | 'ended'>;
	network: () => Promise<Network>;
	/** The folder holding the copy */
	dir: FileSystemDirectoryHandle;
	base: { load(): Promise<Base>; save(base: Base): Promise<void> };
	/** Bytes from which the guest is asked first (`null`: never) and the free bytes here */
	limits: () => Promise<{ limit: number | null; free: number | null }>;
	/** Bytes of the share the guest agreed to fetch so far */
	allowed: () => number;
	conflictLabel: (side: 'mine' | 'theirs') => string;
	onState: (state: ShareSyncState) => void;
	onInfo?: (info: ShareInfo) => void;
	onEnded?: () => void;
	/** Paths of the copy a session wrote or removed */
	onWrite?: (path: string) => void;
	live?: Rebindable;
	/** How often it syncs without a reason (ms) */
	interval?: number;
	timeout?: number;
	backoff?: number[];
}

export interface ShareSync {
	live: Rebindable;
	/** Syncs soon (after `delay` ms) */
	syncNow(delay?: number): void;
	close(): void;
}

/** The copy as a session sees it: hidden entries are no part of a share */
function copyTree(dir: FileSystemDirectoryHandle): Tree {
	const tree = handleTree(dir);
	return {
		...tree,
		async scan() {
			const all = await tree.scan();
			for (const path of [...all.keys()]) if (isHidden(path)) all.delete(path);
			return all;
		}
	};
}

const bytesOf = (snapshot: Snapshot) => [...snapshot.values()].reduce((sum, state) => sum + state.size, 0);

export function shareSync(options: ShareSyncOptions): ShareSync {
	const { dir, base, limits, allowed, onState, onWrite = () => {}, interval = 60_000 } = options;
	const tree = copyTree(dir);
	const gate = new Gate();
	let rpc: Rpc | null = null;
	let mode: 'view' | 'edit' = 'view';
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	let again = false;
	let closed = false;
	let state: ShareSyncState = { phase: 'connecting' };
	const set = (next: ShareSyncState) => {
		state = next;
		if (!closed) onState(next);
	};

	function syncNow(delay = 0) {
		if (closed) return;
		if (running) return void (again = true);
		clearTimeout(timer);
		timer = setTimeout(() => void run(), delay);
	}

	/** Asked before a session moves anything: a share that grew past what the guest agreed to, and is large or
	 * doesn't fit, waits */
	async function confirm(local: Snapshot, remote: Snapshot): Promise<boolean> {
		const bytes = bytesOf(remote);
		if (bytes <= allowed()) return true;
		const more = bytes - bytesOf(local);
		const { limit, free } = await limits();
		const full = free !== null && more > free;
		if (!full && (limit === null || more < limit)) return true;
		set({ phase: 'waiting', ask: { bytes, full } });
		return false;
	}

	async function run() {
		const on = rpc;
		if (closed || running || !on) return;
		running = true;
		again = false;
		let result: DriveResult | null = null;
		try {
			if (state.phase !== 'waiting') set({ phase: 'syncing' });
			result = await drive(on, {
				tree,
				gate,
				scope: { mine: [], theirs: [] },
				base: await base.load(),
				saveBase: base.save,
				conflictLabel: options.conflictLabel,
				// The copy is the guest's to empty, and what it deletes lies in the sharing device's trash
				allowDeletes: true,
				mirror: mode !== 'edit',
				confirm,
				onWrite: (path) => !ignored(path) && onWrite(path),
				onProgress: (done, total) => set({ phase: 'syncing', done, total })
			});
			if (result.waiting) return;
			if (rpc === on) set({ phase: 'synced', ...(result.failed && { failed: result.failed }) });
		} catch (e) {
			if (!closed && rpc === on) console.warn('[share] sync failed', e);
		} finally {
			running = false;
			if (!closed) {
				// Conflict copies are new files: one more run brings them over; skipped steps (changed meanwhile) as well
				const soon = again || result?.busy || result?.conflicts.length || result?.skipped;
				clearTimeout(timer);
				timer = setTimeout(() => void run(), soon ? 1000 : interval);
			}
		}
	}

	const client = shareClient(options.session, options.network, {
		live: options.live,
		timeout: options.timeout,
		backoff: options.backoff,
		onInfo: (info) => {
			mode = info.mode;
			options.onInfo?.(info);
		},
		onRpc(next) {
			rpc = next;
			next.handle('share.changed', async () => syncNow(300));
			syncNow();
		},
		onDown(taken) {
			rpc = null;
			if (state.phase !== 'waiting') set({ phase: 'offline', ...(taken && { taken }) });
		},
		onEnded: () => options.onEnded?.()
	});

	return {
		live: client.live,
		syncNow,
		close() {
			closed = true;
			clearTimeout(timer);
			client.close();
		}
	};
}
