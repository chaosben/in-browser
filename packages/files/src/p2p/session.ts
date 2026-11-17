import { basename, extname, join, nameProblem, parent, segments, uniqueName } from '../path.js';
import { holdDeletes, plan, type Base, type FileState, type Op, type Snapshot } from '../sync/plan.js';
import { stateOf } from '../sync/scan.js';
import type { Json, Rpc } from './rpc.js';
import type { LogFn } from '../sync/log.js';
import { intersect } from './scope.js';

// Sync of two devices: the one with the smaller ID drives (plans and applies), the other one only answers requests
// (`serve`). The plan is the one of the folder sync (`sync/plan.ts`) with the other device in the role of “disk”;
// on top: files changed on both sides are compared by content (SHA-256), and when they really differ the losing
// version is kept as a conflict copy. Only paths both devices take part in are synced (their folder choices).

/** The file system a session works on (the shared OPFS in the app, a separate folder per device in the specs) */
export interface Tree {
	scan(): Promise<Snapshot>;
	stat(path: string): Promise<FileState | null>;
	read(path: string): Promise<File>;
	/** Replaces the file's content when the stream closes (creates missing folders) */
	write(path: string): Promise<WritableStream<Uint8Array>>;
	mkdir(path: string): Promise<void>;
	remove(path: string): Promise<void>;
	move(from: string, to: string): Promise<void>;
	/** Names in a folder (`[]` if it doesn't exist) */
	names(folder: string): Promise<string[]>;
}

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
	log?: LogFn;
}

/** Files are hashed in slices of this size (WebCrypto can only hash a whole buffer, not a stream) */
const HASH_SLICE = 64 * 1024 * 1024;

type WireState = [string, 'f' | 'd', number, number];

const toWire = (snapshot: Snapshot): WireState[] =>
	[...snapshot].map(([path, s]) => [path, s.kind === 'file' ? 'f' : 'd', s.size, s.modified]);
const fromWire = (wire: WireState[]): Snapshot =>
	new Map(wire.map(([path, k, size, modified]) => [path, { kind: k === 'f' ? 'file' : 'directory', size, modified }]));

/**
 * Content fingerprint of a file of any size: SHA-256 of the file, or for large files SHA-256 over the SHA-256 of each
 * slice (both devices compute it the same way, so equal fingerprints mean equal content)
 */
export async function hashFile(file: File): Promise<string> {
	const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
	if (file.size <= HASH_SLICE) return hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
	const digests: Uint8Array[] = [];
	for (let offset = 0; offset < file.size; offset += HASH_SLICE) {
		digests.push(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.slice(offset, offset + HASH_SLICE).arrayBuffer())));
	}
	const all = new Uint8Array(digests.length * 32);
	digests.forEach((digest, i) => all.set(digest, i * 32));
	return `s${hex(await crypto.subtle.digest('SHA-256', all))}`;
}

/** `/a/Notes.md` → `/a/Notes (conflict Laptop).md`, numbered if taken */
export async function conflictPath(tree: Tree, path: string, label: string): Promise<string> {
	const name = basename(path);
	const ext = extname(name);
	const stem = ext ? name.slice(0, -ext.length) : name;
	const candidate = `${stem} (${label})${ext ? name.slice(-ext.length) : ''}`;
	return join(parent(path), uniqueName(candidate, await tree.names(parent(path))));
}

const validName = (path: string) => segments(path).every((name) => !nameProblem(name));

/** Deletes a file that may still be open for writing for a moment (aborted transfer) */
async function removeSoon(tree: Tree, path: string) {
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			await tree.remove(path);
			if (!(await tree.stat(path))) return;
		} catch {
			// Still locked by the aborted write
		}
		await new Promise((r) => setTimeout(r, 100));
	}
}

/**
 * Receives a file atomically: into a hidden temporary file next to it first (ignored by every scan), and only when
 * it is complete into place – a connection lost halfway leaves nothing behind. `keep`: the existing version is kept
 * as a conflict copy with this label (also only once the new one is complete).
 */
async function receive<T>(
	tree: Tree,
	path: string,
	fill: (target: WritableStream<Uint8Array>) => Promise<T>,
	keep: string | undefined,
	onWrite: (path: string) => void
): Promise<{ result: T; copy?: string }> {
	const temp = join(parent(path), `.p2p-${crypto.randomUUID()}.part`);
	onWrite(temp);
	let result: T;
	try {
		result = await fill(await tree.write(temp));
	} catch (e) {
		await removeSoon(tree, temp);
		throw e;
	}
	let copy: string | undefined;
	onWrite(path);
	if (await tree.stat(path)) {
		if (keep) {
			copy = await conflictPath(tree, path, keep);
			onWrite(copy);
			await tree.move(path, copy);
		} else await tree.remove(path);
	}
	await tree.move(temp, path);
	return { result, copy };
}

/**
 * Answers the requests of the driving device. Returns a function to call when the connection ends: it frees this
 * device for other sessions if the driver vanished in the middle of one.
 */
export function serve(rpc: Pick<Rpc, 'handle'>, { tree, gate, onWrite, scope, log }: ServeOptions): () => void {
	let holding = false;
	const release = () => {
		if (holding) gate.leave();
		holding = false;
	};
	rpc.handle('begin', async () => {
		holding = gate.enter();
		log?.('serve.begin', { accepted: holding });
		return { value: holding };
	});
	rpc.handle('end', async () => release());
	rpc.handle('snapshot', async () => ({ value: { scope: scope?.(), entries: toWire(await tree.scan()) } as unknown as Json }));
	rpc.handle('hash', async (params) => {
		const out: Record<string, string | null> = {};
		for (const path of params as string[]) out[path] = await hashFile(await tree.read(path)).catch(() => null);
		return { value: out };
	});
	rpc.handle('get', async (params) => {
		const file = await tree.read(params as string);
		return { value: stateToJson(stateOf(file)), download: file.stream() };
	});
	rpc.handle('put', async (params, upload) => {
		const { path, keep } = params as { path: string; keep?: string };
		if (!validName(path) || !upload) throw new Error(`Invalid name: ${path}`);
		const { copy } = await receive(tree, path, (target) => upload.pipeTo(target), keep, (p) => onWrite?.(p));
		const state = (await tree.stat(path))!;
		log?.('serve.put', { path, state, ...(copy ? { conflictCopy: copy } : {}) });
		return { value: { state: stateToJson(state), copy: copy ?? null } };
	});
	rpc.handle('mkdir', async (params) => {
		const path = params as string;
		if (!validName(path)) throw new Error(`Invalid name: ${path}`);
		onWrite?.(path);
		await tree.mkdir(path);
		log?.('serve.mkdir', { path });
	});
	rpc.handle('remove', async (params) => {
		const { path, kind } = params as { path: string; kind: FileState['kind'] };
		// Folders only when empty: files new inside them stay (and get synced back)
		if (kind === 'directory' && (await tree.names(path)).length) return log?.('serve.remove.skipped', { path, reason: 'folder not empty' });
		onWrite?.(path);
		await tree.remove(path).catch(() => {});
		log?.('serve.remove', { path, kind });
	});
	return release;
}

const stateToJson = (s: FileState): Json => ({ kind: s.kind, size: s.size, modified: s.modified });

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

export interface DriveResult {
	/** The other device was busy with another session: try again later */
	busy?: true;
	applied: number;
	failed: number;
	/** Paths whose losing version was kept as a conflict copy */
	conflicts: string[];
	/** Deletions waiting for confirmation */
	pendingDeletes: number;
}

/** Runs one sync with the other device (this one drives) */
export async function drive(rpc: Rpc, options: DriveOptions): Promise<DriveResult> {
	const { gate } = options;
	const result: DriveResult = { applied: 0, failed: 0, conflicts: [], pendingDeletes: 0 };
	if (!gate.enter()) return { ...result, busy: true };
	try {
		if (!(await rpc.call('begin'))) return { ...result, busy: true };
		try {
			await run(rpc, options, result);
		} finally {
			await rpc.call('end').catch(() => {});
		}
		return result;
	} finally {
		gate.leave();
	}
}

async function run(rpc: Rpc, options: DriveOptions, result: DriveResult) {
	const { tree, base: fullBase } = options;
	const snapshot = (await rpc.call('snapshot')) as unknown as { scope: string[]; entries: WireState[] };
	const scope = { mine: options.scope.mine, theirs: snapshot.scope ?? options.scope.theirs };
	options.onTheirScope?.(scope.theirs);
	const local = intersect(await tree.scan(), scope.mine, scope.theirs);
	const remote = intersect(fromWire(snapshot.entries), scope.mine, scope.theirs);
	// Outside the folders both take part in, the base is forgotten: a folder taken in again starts like a first sync
	// (both sides merged, nothing deleted)
	const base = intersect(fullBase, scope.mine, scope.theirs);

	const log = options.log;
	log?.('sync.start', { scope, local: local.size, remote: remote.size, base: base.size });
	let ops = plan(local, remote, base);
	ops = await sameContent(rpc, tree, ops, local, remote, log);
	if (log) {
		// Every step with what it is based on: this side, the other side and the state after the last sync
		for (const op of ops) {
			if (op.type === 'remember' && base.has(op.path)) continue;
			const b = base.get(op.path);
			log('sync.plan', { ...op, local: local.get(op.path) ?? null, remote: remote.get(op.path) ?? null, baseLocal: b?.local ?? null, baseRemote: b?.disk ?? null });
		}
	}

	// Many deletions at once, or the other side empty, wait for confirmation – in both directions
	if (!options.allowDeletes) {
		const held = (type: Op['type'], other: Snapshot) => {
			const mirrored = ops.map((op) => (op.type === type ? { ...op, type: 'deleteLocal' as const } : { ...op, type: 'remember' as const }));
			return holdDeletes(mirrored as Op[], other, base);
		};
		for (const [type, other] of [['deleteLocal', remote], ['deleteDisk', local]] as const) {
			if (held(type, other)) {
				log?.('sync.deletesHeld', { type, count: ops.filter((op) => op.type === type).length });
				result.pendingDeletes += ops.filter((op) => op.type === type && op.kind === 'file').length;
				ops = ops.filter((op) => op.type !== type);
			}
		}
	}

	const write = (path: string) => options.onWrite?.(path);
	for (const [i, op] of ops.entries()) {
		try {
			if (await apply(rpc, options, base, op, local, remote, write, result)) result.applied++;
		} catch (e) {
			result.failed++;
			console.error('[P2P]', op, e);
			log?.('sync.failed', { ...op, error: e instanceof Error ? e.message : String(e) });
		}
		options.onProgress?.(i + 1, ops.length);
		if (i % 50 === 49) await options.saveBase(base);
	}
	await options.saveBase(base);
	log?.('sync.done', { applied: result.applied, failed: result.failed, conflicts: result.conflicts, pendingDeletes: result.pendingDeletes });
}

/** Copies between files of equal size changed on both sides become `remember` when the content is the same */
async function sameContent(rpc: Rpc, tree: Tree, ops: Op[], local: Snapshot, remote: Snapshot, log?: LogFn): Promise<Op[]> {
	const candidates = ops.filter(
		(op) => (op.type === 'toLocal' || op.type === 'toDisk') && op.both && local.get(op.path)!.size === remote.get(op.path)!.size
	);
	if (!candidates.length) return ops;
	const theirs = (await rpc.call('hash', candidates.map((op) => op.path))) as Record<string, string | null>;
	const same = new Set<string>();
	for (const op of candidates) {
		const mine = await hashFile(await tree.read(op.path)).catch(() => null);
		if (mine && mine === theirs[op.path]) same.add(op.path);
		log?.('sync.compare', { path: op.path, size: local.get(op.path)!.size, mine, theirs: theirs[op.path] ?? null, same: same.has(op.path) });
	}
	return ops.map((op) => (same.has(op.path) && (op.type === 'toLocal' || op.type === 'toDisk') ? { type: 'remember', path: op.path } : op));
}

const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };

async function apply(
	rpc: Rpc,
	options: DriveOptions,
	base: Base,
	op: Op,
	local: Snapshot,
	remote: Snapshot,
	write: (path: string) => void,
	result: DriveResult
): Promise<boolean> {
	const { tree } = options;
	const { path } = op;
	switch (op.type) {
		case 'toLocal': {
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			const { result: state, copy } = await receive(
				tree,
				path,
				async (target) => (await rpc.call('get', path, { download: target })) as unknown as FileState,
				op.both ? options.conflictLabel('mine') : undefined,
				write
			);
			if (copy) {
				result.conflicts.push(path);
				options.log?.('sync.conflictCopy', { path, copy, kept: 'here' });
			}
			base.set(path, { local: (await tree.stat(path))!, disk: state });
			return true;
		}
		case 'toDisk': {
			const file = await tree.read(path);
			const params: Json = op.both ? { path, keep: options.conflictLabel('theirs') } : { path };
			const reply = (await rpc.call('put', params, { upload: file.stream() })) as unknown as {
				state: FileState;
				copy: string | null;
			};
			if (reply.copy) {
				result.conflicts.push(path);
				options.log?.('sync.conflictCopy', { path, copy: reply.copy, kept: 'there' });
			}
			base.set(path, { local: stateOf(file), disk: reply.state });
			return true;
		}
		case 'mkdirLocal':
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			write(path);
			await tree.mkdir(path);
			base.set(path, { local: DIR, disk: DIR });
			return true;
		case 'mkdirDisk':
			await rpc.call('mkdir', path);
			base.set(path, { local: DIR, disk: DIR });
			return true;
		case 'deleteLocal':
			if (op.kind === 'file' || !(await tree.names(path)).length) {
				write(path);
				await tree.remove(path);
			}
			base.delete(path);
			return true;
		case 'deleteDisk':
			await rpc.call('remove', { path, kind: op.kind });
			base.delete(path);
			return true;
		case 'remember':
			base.set(path, { local: local.get(path)!, disk: remote.get(path)! });
			return false;
		case 'forget':
			base.delete(path);
			return false;
		case 'conflict':
			throw new Error(`File on one device, folder on the other: ${path}`);
	}
}
