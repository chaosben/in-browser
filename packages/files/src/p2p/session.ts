import { runSync, type SyncResult } from '../sync/apply.js';
import { GONE, treeSide, type Other, type Outcome } from '../sync/tree-ops.js';
import type { LogFn } from '../sync/log.js';
import type { Base, FileState, Snapshot } from '../sync/plan.js';
import { stateOf } from '../sync/scan.js';
import type { Tree } from '../sync/tree.js';
import type { Json, Rpc } from './rpc.js';
import { intersect } from './scope.js';

export type { Tree } from '../sync/tree.js';
export { conflictPath, hashFile } from '../sync/tree-ops.js';

// Sync of two devices: the one with the smaller ID drives (plans and applies, `sync/apply.ts`), the other one only
// answers requests (`serve`) – in the role of the “disk” side of the plan. Only paths both devices take part in are
// synced (their folder choices). Deletions held for confirmation can be confirmed on either device: the answering
// one passes its permission on in `begin`, the driver reports what it held back in `end`.

/** Only one session at a time per device (it may drive one or answer one) */
export class Gate {
	busy = false;
	enter(): boolean {
		if (this.busy) return false;
		this.busy = true;
		return true;
	}
	leave() {
		this.busy = false;
	}
}

export interface ServeOptions {
	tree: Tree;
	gate: Gate;
	/** Called for every path a session writes or deletes here (not to be taken for a local change) */
	onWrite?: (path: string) => void;
	/** Excluded folders of this device right now (sent with every snapshot, so the driver never uses an old choice) */
	scope?: () => string[];
	/** The user confirmed held deletions on this device (passed on to the driver) */
	allowDeletes?: () => boolean;
	/** A session driven by the other device ended (what it held back for confirmation) */
	onEnd?: (summary: SessionSummary) => void;
	log?: LogFn;
}

export interface SessionSummary {
	/** The session was over without errors (also counts as confirmed deletions being done) */
	complete: boolean;
	pendingDeletes: number;
	usedAllowDeletes: boolean;
}

type WireState = [string, 'f' | 'd', number, number];

const toWire = (snapshot: Snapshot): WireState[] =>
	[...snapshot].map(([path, s]) => [path, s.kind === 'file' ? 'f' : 'd', s.size, s.modified]);
const fromWire = (wire: WireState[]): Snapshot =>
	new Map(wire.map(([path, k, size, modified]) => [path, { kind: k === 'f' ? 'file' : 'directory', size, modified }]));

const stateToJson = (s: FileState | null): Json => (s ? { kind: s.kind, size: s.size, modified: s.modified } : null);

/**
 * Answers the requests of the driving device. Returns a function to call when the connection ends: it frees this
 * device for other sessions if the driver vanished in the middle of one.
 */
export function serve(rpc: Pick<Rpc, 'handle'>, { tree, gate, onWrite, scope, allowDeletes, onEnd, log }: ServeOptions): () => void {
	const side = treeSide(tree, { onWrite, log });
	let holding = false;
	const release = () => {
		if (holding) gate.leave();
		holding = false;
	};
	rpc.handle('begin', async () => {
		holding = gate.enter();
		const allow = holding && !!allowDeletes?.();
		log?.('serve.begin', { accepted: holding, allowDeletes: allow });
		return { value: { accepted: holding, allowDeletes: allow } };
	});
	rpc.handle('end', async (params) => {
		release();
		if (params) onEnd?.(params as unknown as SessionSummary);
	});
	rpc.handle('snapshot', async () => ({ value: { scope: scope?.(), entries: toWire(await tree.scan()) } as unknown as Json }));
	rpc.handle('hash', async (params) => ({ value: await side.hash(params as string[]) }));
	rpc.handle('get', async (params) => {
		// Gone since the plan: the asking side skips the step (`isGone`)
		if (!(await tree.stat(params as string))) throw new Error(GONE);
		const file = await tree.read(params as string);
		return { value: stateToJson(stateOf(file)), download: file.stream() };
	});
	rpc.handle('put', async (params, upload) => {
		const { path, keep, expect } = params as { path: string; keep?: string; expect: FileState | null };
		if (!upload) throw new Error(`No content: ${path}`);
		const reply = await side.put(path, upload, { keep, expect });
		const value: Json = 'stale' in reply ? { stale: true } : { state: stateToJson(reply.state), copy: reply.copy };
		return { value };
	});
	rpc.handle('mkdir', async (params) => void (await side.mkdir(params as string)));
	rpc.handle('remove', async (params) => {
		const { path, kind, expect } = params as { path: string; kind: FileState['kind']; expect: FileState | null };
		return { value: await side.remove(path, kind, expect) };
	});
	rpc.handle('rename', async (params) => {
		const { from, to, expect } = params as { from: string; to: string; expect: FileState | null };
		return { value: await side.rename(from, to, expect) };
	});
	return release;
}

/** The answering device as the other side of a sync */
function rpcSide(rpc: Rpc): Other {
	return {
		hash: async (paths) => (await rpc.call('hash', paths)) as Record<string, string | null>,
		get: async (path, target) => (await rpc.call('get', path, { download: target })) as unknown as FileState,
		async put(path, upload, { keep, expect }) {
			const reply = (await rpc.call('put', { path, ...(keep ? { keep } : {}), expect: stateToJson(expect) }, { upload })) as unknown as
				| { state: FileState; copy: string | null }
				| { stale: true };
			return reply;
		},
		mkdir: async (path) => void (await rpc.call('mkdir', path)),
		remove: async (path, kind, expect) => (await rpc.call('remove', { path, kind, expect: stateToJson(expect) })) as Outcome,
		rename: async (from, to, expect) => (await rpc.call('rename', { from, to, expect: stateToJson(expect) })) as Outcome
	};
}

export interface DriveOptions {
	tree: Tree;
	gate: Gate;
	/** Excluded folders of both devices (theirs as last known; the snapshot brings the current one) */
	scope: { mine: string[]; theirs: string[] };
	/** The other device's current excluded folders, from its snapshot */
	onTheirScope?: (scope: string[]) => void;
	/** State after the last sync with this device */
	base: Base;
	saveBase: (base: Base) => Promise<void>;
	/** Label of a conflict copy, e.g. `conflict Laptop` (the device whose version lost) */
	conflictLabel: (side: 'mine' | 'theirs') => string;
	/** Deletions that would wait for confirmation go through (after the user confirmed) */
	allowDeletes?: boolean;
	onWrite?: (path: string) => void;
	onProgress?: (done: number, total: number) => void;
	log?: LogFn;
}

export interface DriveResult extends Omit<SyncResult, 'held'> {
	/** The other device was busy with another session: try again later */
	busy?: true;
	/** Held deletions were let through because one of the two devices confirmed them */
	usedAllowDeletes?: boolean;
}

/** Runs one sync with the other device (this one drives) */
export async function drive(rpc: Rpc, options: DriveOptions): Promise<DriveResult> {
	const { gate } = options;
	const empty: DriveResult = { applied: 0, failed: 0, skipped: 0, conflicts: [], pendingDeletes: 0 };
	if (!gate.enter()) return { ...empty, busy: true };
	try {
		const begun = (await rpc.call('begin')) as unknown as { accepted: boolean; allowDeletes: boolean };
		if (!begun.accepted) return { ...empty, busy: true };
		let result: DriveResult = empty;
		const allowDeletes = !!options.allowDeletes || begun.allowDeletes;
		try {
			const { held: _, ...rest } = await run(rpc, { ...options, allowDeletes });
			result = { ...rest, usedAllowDeletes: allowDeletes };
		} finally {
			const summary: SessionSummary = { complete: result !== empty && !result.failed, pendingDeletes: result.pendingDeletes, usedAllowDeletes: allowDeletes };
			await rpc.call('end', summary as unknown as Json).catch(() => {});
		}
		return result;
	} finally {
		gate.leave();
	}
}

async function run(rpc: Rpc, options: DriveOptions): Promise<SyncResult> {
	const { tree } = options;
	const snapshot = (await rpc.call('snapshot')) as unknown as { scope: string[]; entries: WireState[] };
	const scope = { mine: options.scope.mine, theirs: snapshot.scope ?? options.scope.theirs };
	options.onTheirScope?.(scope.theirs);
	const local = intersect(await tree.scan(), scope.mine, scope.theirs);
	const remote = intersect(fromWire(snapshot.entries), scope.mine, scope.theirs);
	// Outside the folders both take part in, the base is forgotten: a folder taken in again starts like a first sync
	// (both sides merged, nothing deleted)
	const base = intersect(options.base, scope.mine, scope.theirs);
	options.log?.('sync.start', { scope, local: local.size, remote: remote.size, base: base.size });
	return runSync(tree, rpcSide(rpc), local, remote, {
		base,
		saveBase: options.saveBase,
		conflictLabel: options.conflictLabel,
		hold: ['deleteLocal', 'deleteDisk'],
		allowDeletes: options.allowDeletes,
		onWrite: options.onWrite,
		onProgress: options.onProgress,
		log: options.log
	});
}
