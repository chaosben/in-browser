import { runSync, type SyncOptions, type SyncResult } from '../sync/apply.js';
import { GONE, treeSide, type Other, type Outcome, type PackageCopies } from '../sync/tree-ops.js';
import type { LogFn } from '../sync/log.js';
import type { Base, FileState, HeldFolder, Snapshot } from '../sync/plan.js';
import { stateOf } from '../sync/scan.js';
import type { Tree } from '../sync/tree.js';
import { FilesError } from '../entry.js';
import { normalize } from '../path.js';
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
	/** This device waits for its folder choice: sessions transfer nothing yet */
	setup?: () => boolean;
	/** New folders the user let through on this device (passed on to the driver) */
	allowFolders?: () => string[];
	/** Free bytes for files arriving here, where limited (a browser's quota) */
	free?: () => Promise<number | null>;
	/** Bytes a single arriving file may have at most right now (a disk that must not run full); none: not limited */
	room?: () => Promise<number | null>;
	/** Bytes from which a new folder arriving here waits for confirmation (`null`: never) */
	limit?: () => Promise<number | null>;
	/**
	 * Whether the driver may reach a path at all (the folders this device takes part in): the rest is neither listed
	 * nor read nor written, whatever the driver asks for
	 */
	reach?: (path: string) => boolean;
	/** Paths the driver may neither delete nor rename (what a guest share stands on) */
	keep?: (path: string) => boolean;
	/** Files the driver deletes go here instead of being removed (a guest's deletions: this device's trash) */
	trash?: (path: string) => Promise<void>;
	log?: LogFn;
}

export interface SessionSummary {
	/** The session was over without errors (also counts as confirmed deletions being done) */
	complete: boolean;
	pendingDeletes: number;
	usedAllowDeletes: boolean;
	/** New folders held back that would have arrived on the answering device */
	heldFolders?: HeldFolder[];
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
export function serve(rpc: Pick<Rpc, 'handle'>, { tree, gate, onWrite, scope, allowDeletes, onEnd, setup, allowFolders, free, limit, room, reach, keep, trash, log }: ServeOptions): () => void {
	const reachable = (path: unknown) => typeof path === 'string' && (!reach || reach(normalize(path)));
	const within = (path: unknown): string => {
		if (!reachable(path)) throw new Error(`Not here: ${String(path)}`);
		return path as string;
	};
	// One session is one run: package copies (`PackageCopies`) are made once in it
	let copies: PackageCopies = new Map();
	const side = treeSide(tree, { onWrite, log, packages: () => copies });
	// Deleting files goes through the trash where one is given
	// A guest's deletions go into the trash, not into the earlier versions
	const trashing = trash ? treeSide({ ...tree, remove: trash, keep: undefined }, { onWrite, log }) : side;
	let holding = false;
	const release = () => {
		if (holding) gate.leave();
		holding = false;
	};
	rpc.handle('begin', async () => {
		holding = gate.enter();
		copies = new Map();
		const allow = holding && !!allowDeletes?.();
		const settingUp = !!setup?.();
		log?.('serve.begin', { accepted: holding, allowDeletes: allow, setup: settingUp });
		const value = { accepted: holding, allowDeletes: allow, setup: settingUp, allowFolders: allowFolders?.() ?? [], free: (await free?.()) ?? null, limit: (await limit?.()) ?? null };
		return { value };
	});
	rpc.handle('end', async (params) => {
		release();
		if (params) onEnd?.(params as unknown as SessionSummary);
	});
	rpc.handle('snapshot', async () => {
		const entries = toWire(await tree.scan()).filter(([path]) => reachable(path));
		return { value: { scope: scope?.(), entries } as unknown as Json };
	});
	rpc.handle('hash', async (params) => ({ value: await side.hash((params as string[]).filter(reachable)) }));
	rpc.handle('get', async (params) => {
		// Gone since the plan (or no longer taking part): the asking side skips the step (`isGone`)
		if (!reachable(params) || !(await tree.stat(params as string))) throw new Error(GONE);
		const file = await tree.read(params as string);
		return { value: stateToJson(stateOf(file)), download: file.stream() };
	});
	rpc.handle('put', async (params, upload) => {
		const { path, keep, expect } = params as { path: string; keep?: string; expect: FileState | null };
		if (!upload) throw new Error(`No content: ${path}`);
		if (!reachable(path)) {
			await upload.cancel().catch(() => {});
			within(path);
		}
		const left = (await room?.()) ?? null;
		const reply = await side.put(path, left === null ? upload : upload.pipeThrough(atMost(left, path)), { keep, expect });
		const value: Json = 'stale' in reply ? { stale: true } : { state: stateToJson(reply.state), copy: reply.copy };
		return { value };
	});
	rpc.handle('mkdir', async (params) => void (await side.mkdir(within(params))));
	rpc.handle('remove', async (params) => {
		const { path, kind, expect } = params as { path: string; kind: FileState['kind']; expect: FileState | null };
		within(path);
		if (keep?.(path)) throw new Error(`Kept: ${path}`);
		return { value: await (kind === 'file' ? trashing : side).remove(path, kind, expect) };
	});
	rpc.handle('rename', async (params) => {
		const { from, to, expect } = params as { from: string; to: string; expect: FileState | null };
		within(from);
		within(to);
		if (keep?.(from)) throw new Error(`Kept: ${from}`);
		return { value: await side.rename(from, to, expect) };
	});
	return release;
}

/** Passes at most `max` bytes on, then fails as a full storage does */
function atMost(max: number, path: string): TransformStream<Uint8Array, Uint8Array> {
	let size = 0;
	return new TransformStream({
		transform(chunk, controller) {
			size += chunk.length;
			if (size > max) throw new FilesError('full', path);
			controller.enqueue(chunk);
		}
	});
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
	/** Large new folders wait for confirmation: the limit (suite setting), free bytes here, folders let through here */
	holdLarge?: { limit: number | null; free: number | null; allowed: string[] };
	/**
	 * This side only follows the other one (a guest's copy of a share for viewing): whatever differs here is taken
	 * from there, what is gone there goes here, nothing is ever sent or deleted there
	 */
	mirror?: boolean;
	/** Asked with both snapshots before anything moves; `false` leaves the session without syncing (`waiting`) */
	confirm?: (local: Snapshot, remote: Snapshot) => boolean | Promise<boolean>;
	onWrite?: (path: string) => void;
	onProgress?: (done: number, total: number) => void;
	log?: LogFn;
}

export interface DriveResult extends Omit<SyncResult, 'held'> {
	/** The other device was busy with another session: try again later */
	busy?: true;
	/** Held deletions were let through because one of the two devices confirmed them */
	usedAllowDeletes?: boolean;
	/** The other device waits for its folder choice: nothing was synced */
	setup?: true;
	/** New folders held back that would have arrived on the other device */
	theirHeldFolders?: HeldFolder[];
	/** `confirm` said no: nothing was synced */
	waiting?: true;
}

/** Runs one sync with the other device (this one drives) */
export async function drive(rpc: Rpc, options: DriveOptions): Promise<DriveResult> {
	const { gate } = options;
	const empty: DriveResult = { applied: 0, failed: 0, skipped: 0, conflicts: [], pendingDeletes: 0, heldFolders: [] };
	if (!gate.enter()) return { ...empty, busy: true };
	try {
		const begun = (await rpc.call('begin')) as unknown as Begun;
		if (!begun.accepted) return { ...empty, busy: true };
		if (begun.setup) {
			await rpc.call('end').catch(() => {});
			return { ...empty, setup: true };
		}
		let result: DriveResult = empty;
		const allowDeletes = !!options.allowDeletes || begun.allowDeletes;
		const hold = options.holdLarge && {
			limit: { in: options.holdLarge.limit, out: begun.limit ?? null },
			free: { in: options.holdLarge.free, out: begun.free ?? null },
			allowed: [...options.holdLarge.allowed, ...(begun.allowFolders ?? [])]
		};
		try {
			const ran = await run(rpc, { ...options, allowDeletes }, hold);
			if (!ran) return (result = { ...empty, waiting: true });
			const { held: _, heldFolders, ...rest } = ran;
			// Folders held on their way to the other device are its to confirm
			const flip = (f: HeldFolder): HeldFolder => ({ ...f, direction: 'in' });
			result = {
				...rest,
				heldFolders: heldFolders.filter((f) => f.direction === 'in'),
				theirHeldFolders: heldFolders.filter((f) => f.direction === 'out').map(flip),
				usedAllowDeletes: allowDeletes
			};
		} finally {
			const summary: SessionSummary = {
				complete: result !== empty && !result.failed && !result.waiting,
				pendingDeletes: result.pendingDeletes,
				usedAllowDeletes: allowDeletes,
				heldFolders: result.theirHeldFolders ?? []
			};
			await rpc.call('end', summary as unknown as Json).catch(() => {});
		}
		return result;
	} finally {
		gate.leave();
	}
}

interface Begun {
	accepted: boolean;
	allowDeletes: boolean;
	/** Missing from devices before protocol 3 */
	setup?: boolean;
	allowFolders?: string[];
	free?: number | null;
	limit?: number | null;
}

async function run(rpc: Rpc, options: DriveOptions, holdLarge?: SyncOptions['holdLarge']): Promise<SyncResult | null> {
	const { tree } = options;
	const snapshot = (await rpc.call('snapshot')) as unknown as { scope: string[]; entries: WireState[] };
	const scope = { mine: options.scope.mine, theirs: snapshot.scope ?? options.scope.theirs };
	options.onTheirScope?.(scope.theirs);
	const local = intersect(await tree.scan(), scope.mine, scope.theirs);
	const remote = intersect(fromWire(snapshot.entries), scope.mine, scope.theirs);
	// Outside the folders both take part in, the base is forgotten: a folder taken in again starts like a first sync
	// (both sides merged, nothing deleted)
	const base = options.mirror ? mirrorBase(local, options.base) : intersect(options.base, scope.mine, scope.theirs);
	options.log?.('sync.start', { scope, local: local.size, remote: remote.size, base: base.size });
	if (options.confirm && !(await options.confirm(local, remote))) return null;
	return runSync(tree, rpcSide(rpc), local, remote, {
		base,
		saveBase: options.saveBase,
		conflictLabel: options.conflictLabel,
		hold: options.mirror ? [] : ['deleteLocal', 'deleteDisk'],
		allowDeletes: options.allowDeletes,
		holdLarge,
		onWrite: options.onWrite,
		onProgress: options.onProgress,
		log: options.log
	});
}

/**
 * The base of a mirror: everything here counts as unchanged since the last sync, so the plan only ever follows the
 * other side – a file that differs here is fetched again, one that is gone there is removed here, and nothing here
 * looks new or changed (which would be sent)
 */
function mirrorBase(local: Snapshot, saved: Base): Base {
	const base: Base = new Map();
	for (const [path, state] of local) {
		const was = saved.get(path);
		// Still as the last sync left it: unchanged there too unless the other side says otherwise. Anything else
		// here never came from there: it counts as changed there, so it is fetched again
		const kept = was && was.local.kind === state.kind && was.local.size === state.size && was.local.modified === state.modified;
		base.set(path, { local: state, disk: kept ? was.disk : state });
	}
	return base;
}
