import { basename, extname, join, nameKey, nameProblem, parent, segments, uniqueName } from '../path.js';
import { caseRenames, holdDeletes, pathKey, plan, renameKeys, type Base, type FileState, type Op, type Snapshot } from './plan.js';
import type { LogFn } from './log.js';
import { stateOf } from './scan.js';
import { unchanged, type Tree } from './tree.js';

// Carrying out a plan (`plan.ts`) between this side's tree and the other side – shared by the folder sync (the other
// side is a folder on disk) and the P2P sync (another device, over RPC). Rules that keep the user's data:
// - Nothing is overwritten or deleted that changed since the plan was made: right before, its state is compared
//   with the one the plan saw; if it differs, the step is skipped (the next run plans again).
// - Files arrive in a hidden temporary file and are moved into place only when complete.
// - The losing version of a change on both sides becomes a conflict copy (unless the content is the same).
// - Like Syncthing (without versioning), what the other side deleted or replaced is deleted or replaced here: the
//   user's own deletions are kept in the synced trash (`trash.ts`), so they are on every device anyway.

/** The other side of a sync: a tree here (`treeSide`) or another device (`rpcSide` in `p2p/session.ts`) */
export interface Other {
	hash(paths: string[]): Promise<Record<string, string | null>>;
	/** Writes the file into `target`; returns its state */
	get(path: string, target: WritableStream<Uint8Array>): Promise<FileState>;
	/** `expect`: the state the plan saw there (`null`: none); `keep`: label for a conflict copy of the version there */
	put(path: string, upload: ReadableStream<Uint8Array>, options: { keep?: string; expect: FileState | null }): Promise<PutResult>;
	mkdir(path: string): Promise<void>;
	remove(path: string, kind: FileState['kind'], expect: FileState | null): Promise<Outcome>;
	rename(from: string, to: string, expect: FileState | null): Promise<Outcome>;
}

/** `stale`: changed since the plan, left alone; `kept`: a folder that isn't empty, left alone */
export type Outcome = 'done' | 'stale' | 'kept';
export type PutResult = { state: FileState; copy: string | null } | { stale: true };

/** Files are hashed in slices of this size (WebCrypto can only hash a whole buffer, not a stream) */
const HASH_SLICE = 64 * 1024 * 1024;

/**
 * Content fingerprint of a file of any size: SHA-256 of the file, or for large files SHA-256 over the SHA-256 of each
 * slice (both sides compute it the same way, so equal fingerprints mean equal content)
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

export const validName = (path: string) => segments(path).every((name) => !nameProblem(name));

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
 * it is complete into place – a connection lost halfway leaves nothing behind. Then, only if the file there is still
 * as `expect`ed: the existing version becomes a conflict copy (`keep`: its label) or is replaced.
 */
export async function receive<T>(
	tree: Tree,
	path: string,
	fill: (target: WritableStream<Uint8Array>) => Promise<T>,
	{ keep, expect, onWrite = () => {} }: { keep?: string; expect: FileState | null; onWrite?: (path: string) => void }
): Promise<{ result: T; copy?: string } | { stale: true }> {
	const temp = join(parent(path), `.p2p-${crypto.randomUUID()}.part`);
	onWrite(temp);
	let result: T;
	try {
		result = await fill(await tree.write(temp));
	} catch (e) {
		await removeSoon(tree, temp);
		throw e;
	}
	try {
		const current = await tree.stat(path);
		if (!unchanged(current, expect)) {
			await removeSoon(tree, temp);
			return { stale: true };
		}
		if (current && current.kind !== 'file') throw new Error(`Not a file: ${path}`);
		// Another entry differing only in case would block the move – find out before the old version is moved away
		const key = nameKey(basename(path));
		const clash = (await tree.names(parent(path))).find((name) => name !== basename(path) && name !== basename(temp) && nameKey(name) === key);
		if (clash) throw new Error(`Name differs only in case from “${clash}”: ${path}`);
		let copy: string | undefined;
		onWrite(path);
		if (current) {
			if (keep) {
				copy = await conflictPath(tree, path, keep);
				onWrite(copy);
				await tree.move(path, copy);
			} else await tree.remove(path);
		}
		await tree.move(temp, path);
		return { result, copy };
	} catch (e) {
		await removeSoon(tree, temp);
		throw e;
	}
}

/** Deletes what the plan saw: a file only while unchanged, a folder only while empty */
export async function discard(tree: Tree, path: string, kind: FileState['kind'], expect: FileState | null, onWrite: (path: string) => void = () => {}): Promise<Outcome> {
	if (kind === 'directory') {
		if ((await tree.names(path)).length) return 'kept';
		onWrite(path);
		await tree.remove(path);
		return 'done';
	}
	const current = await tree.stat(path);
	if (!current) return 'done';
	if (!unchanged(current, expect)) return 'stale';
	onWrite(path);
	await tree.remove(path);
	return 'done';
}

/** Renames (upper/lower case only, see `caseRenames`) while the entry is as the plan saw it */
export async function renameIn(tree: Tree, from: string, to: string, expect: FileState | null, onWrite: (path: string) => void = () => {}): Promise<Outcome> {
	if (!unchanged(await tree.stat(from), expect)) return 'stale';
	onWrite(from);
	onWrite(to);
	await tree.move(from, to);
	return 'done';
}

/** A tree as the other side (the folder on disk of the folder sync; what a device answers in `serve`) */
export function treeSide(tree: Tree, { onWrite = () => {}, log }: { onWrite?: (path: string) => void; log?: LogFn } = {}): Other {
	return {
		async hash(paths) {
			const out: Record<string, string | null> = {};
			for (const path of paths) out[path] = await hashFile(await tree.read(path)).catch(() => null);
			return out;
		},
		async get(path, target) {
			const file = await tree.read(path);
			await file.stream().pipeTo(target);
			return stateOf(file);
		},
		async put(path, upload, { keep, expect }) {
			if (!validName(path)) {
				await upload.cancel().catch(() => {});
				throw new Error(`Invalid name: ${path}`);
			}
			const received = await receive(tree, path, (target) => upload.pipeTo(target), { keep, expect, onWrite });
			if ('stale' in received) {
				log?.('serve.stale', { path, expect });
				return received;
			}
			const state = (await tree.stat(path))!;
			log?.('serve.put', { path, state, ...(received.copy ? { conflictCopy: received.copy } : {}) });
			return { state, copy: received.copy ?? null };
		},
		async mkdir(path) {
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			onWrite(path);
			await tree.mkdir(path);
			log?.('serve.mkdir', { path });
		},
		async remove(path, kind, expect) {
			const outcome = await discard(tree, path, kind, expect, onWrite);
			log?.('serve.remove', { path, kind, outcome });
			return outcome;
		},
		async rename(from, to, expect) {
			if (!validName(to)) throw new Error(`Invalid name: ${to}`);
			const outcome = await renameIn(tree, from, to, expect, onWrite);
			log?.('serve.rename', { from, to, outcome });
			return outcome;
		}
	};
}

export interface SyncOptions {
	/** State after the last sync with this other side (already limited to what both take part in) */
	base: Base;
	saveBase: (base: Base) => Promise<void>;
	/** Label of a conflict copy, e.g. `conflict Laptop` (the side whose version lost) */
	conflictLabel: (side: 'mine' | 'theirs') => string;
	/** Deletions that wait for confirmation when many or when the deleting side is empty */
	hold: ('deleteLocal' | 'deleteDisk')[];
	/** Held deletions go through (after the user confirmed) */
	allowDeletes?: boolean;
	onWrite?: (path: string) => void;
	onProgress?: (done: number, total: number) => void;
	log?: LogFn;
}

export interface SyncResult {
	applied: number;
	failed: number;
	/** Steps left alone because something changed since the plan: run again soon */
	skipped: number;
	/** Paths whose losing version was kept as a conflict copy */
	conflicts: string[];
	/** Files whose deletion waits for confirmation */
	pendingDeletes: number;
	/** The deletions waiting for confirmation */
	held: Op[];
}

/** Plans and carries out one sync between `mine` (snapshot `local`) and `other` (snapshot `remote`) */
export async function runSync(mine: Tree, other: Other, local: Snapshot, remote: Snapshot, options: SyncOptions): Promise<SyncResult> {
	const result: SyncResult = { applied: 0, failed: 0, skipped: 0, conflicts: [], pendingDeletes: 0, held: [] };
	const log = options.log;
	const write = (path: string) => options.onWrite?.(path);

	// Renames in upper/lower case first. The rest is planned as if they were done, so if one doesn't go through,
	// nothing else happens; the base takes over each rename as soon as it is done
	const renamed = caseRenames(local, remote, options.base);
	let renamedBase = options.base;
	for (const op of renamed.renames) {
		if (op.type !== 'renameLocal' && op.type !== 'renameDisk') continue;
		log?.('sync.plan', { ...op });
		try {
			// The state the entry had, found under its new name (renames go from the top down, so later ones never
			// move it again)
			const outcome =
				op.type === 'renameLocal'
					? await renameIn(mine, op.from, op.path, renamed.local.get(op.path) ?? null, write)
					: await other.rename(op.from, op.path, renamed.disk.get(op.path) ?? null);
			if (outcome !== 'done') {
				result.skipped++;
				log?.('sync.skipped', { ...op, reason: 'changed since the plan' });
				return result;
			}
			result.applied++;
			renamedBase = renameKeys(renamedBase, op.from, op.path);
			await options.saveBase(renamedBase);
		} catch (e) {
			result.failed++;
			log?.('sync.failed', { ...op, error: e instanceof Error ? e.message : String(e) });
			return result;
		}
	}
	({ local, disk: remote } = renamed);
	const base = renamed.base;

	let ops = plan(local, remote, base);
	ops = await sameContent(mine, other, ops, local, remote, log);
	if (log) {
		// Every step with what it is based on: this side, the other side and the state after the last sync
		for (const op of ops) {
			if (op.type === 'remember' && base.has(op.path)) continue;
			const b = base.get(op.path);
			log('sync.plan', { ...op, local: local.get(op.path) ?? null, remote: remote.get(op.path) ?? null, baseLocal: b?.local ?? null, baseRemote: b?.disk ?? null });
		}
	}

	// Many deletions at once, or the deleting side empty, wait for confirmation
	if (!options.allowDeletes) {
		for (const type of options.hold) {
			const other = type === 'deleteLocal' ? remote : local;
			const mirrored = ops.map((op) => (op.type === type ? { ...op, type: 'deleteLocal' as const } : { ...op, type: 'remember' as const }));
			if (!holdDeletes(mirrored as Op[], other, base)) continue;
			const held = ops.filter((op) => op.type === type);
			log?.('sync.deletesHeld', { type, count: held.length });
			result.held.push(...held);
			result.pendingDeletes += held.filter((op) => 'kind' in op && op.kind === 'file').length;
			ops = ops.filter((op) => op.type !== type);
		}
	}

	// Keys of paths written in this run: a deletion of a path that only differs in case would hit the new file on
	// Windows/macOS
	const written = new Set<string>();
	for (const [i, op] of ops.entries()) {
		try {
			if ((op.type === 'deleteLocal' || op.type === 'deleteDisk') && written.has(pathKey(op.path))) {
				result.skipped++;
				log?.('sync.skipped', { ...op, reason: 'a name differing only in case was written in this run' });
			} else {
				const outcome = await apply(mine, other, options, base, op, local, remote, write, result);
				if (outcome === 'applied') result.applied++;
				if (outcome === 'skipped') {
					result.skipped++;
					log?.('sync.skipped', { ...op, reason: 'changed since the plan' });
				}
				if (op.type === 'toLocal' || op.type === 'toDisk' || op.type.startsWith('mkdir')) written.add(pathKey(op.path));
			}
		} catch (e) {
			result.failed++;
			console.error('[Sync]', op, e);
			log?.('sync.failed', { ...op, error: e instanceof Error ? e.message : String(e) });
		}
		options.onProgress?.(i + 1, ops.length);
		if (i % 50 === 49) await options.saveBase(base);
	}
	await options.saveBase(base);
	log?.('sync.done', { applied: result.applied, failed: result.failed, skipped: result.skipped, conflicts: result.conflicts, pendingDeletes: result.pendingDeletes });
	return result;
}

/** Copies between files of equal size changed on both sides become `remember` when the content is the same */
async function sameContent(mine: Tree, other: Other, ops: Op[], local: Snapshot, remote: Snapshot, log?: LogFn): Promise<Op[]> {
	const candidates = ops.filter(
		(op) => (op.type === 'toLocal' || op.type === 'toDisk') && op.both && local.get(op.path)!.size === remote.get(op.path)!.size
	);
	if (!candidates.length) return ops;
	const theirs = await other.hash(candidates.map((op) => op.path));
	const same = new Set<string>();
	for (const op of candidates) {
		const hash = await hashFile(await mine.read(op.path)).catch(() => null);
		if (hash && hash === theirs[op.path]) same.add(op.path);
		log?.('sync.compare', { path: op.path, size: local.get(op.path)!.size, mine: hash, theirs: theirs[op.path] ?? null, same: same.has(op.path) });
	}
	return ops.map((op) => (same.has(op.path) && (op.type === 'toLocal' || op.type === 'toDisk') ? { type: 'remember', path: op.path } : op));
}

const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };

async function apply(
	mine: Tree,
	other: Other,
	options: SyncOptions,
	base: Base,
	op: Op,
	local: Snapshot,
	remote: Snapshot,
	write: (path: string) => void,
	result: SyncResult
): Promise<'applied' | 'skipped' | 'none'> {
	const { path } = op;
	switch (op.type) {
		case 'toLocal': {
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			const received = await receive(mine, path, (target) => other.get(path, target), {
				keep: op.both ? options.conflictLabel('mine') : undefined,
				expect: local.get(path) ?? null,
				onWrite: write
			});
			if ('stale' in received) return 'skipped';
			if (received.copy) {
				result.conflicts.push(path);
				options.log?.('sync.conflictCopy', { path, copy: received.copy, kept: 'here' });
			}
			base.set(path, { local: (await mine.stat(path))!, disk: received.result });
			return 'applied';
		}
		case 'toDisk': {
			const file = await mine.read(path);
			const reply = await other.put(path, file.stream(), { keep: op.both ? options.conflictLabel('theirs') : undefined, expect: remote.get(path) ?? null });
			if ('stale' in reply) return 'skipped';
			if (reply.copy) {
				result.conflicts.push(path);
				options.log?.('sync.conflictCopy', { path, copy: reply.copy, kept: 'there' });
			}
			base.set(path, { local: stateOf(file), disk: reply.state });
			return 'applied';
		}
		case 'mkdirLocal':
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			write(path);
			await mine.mkdir(path);
			base.set(path, { local: DIR, disk: DIR });
			return 'applied';
		case 'mkdirDisk':
			await other.mkdir(path);
			base.set(path, { local: DIR, disk: DIR });
			return 'applied';
		case 'deleteLocal':
		case 'deleteDisk': {
			const outcome =
				op.type === 'deleteLocal'
					? await discard(mine, path, op.kind, local.get(path) ?? null, write)
					: await other.remove(path, op.kind, remote.get(path) ?? null);
			if (outcome === 'stale') return 'skipped';
			// A folder that isn't empty stays: what is new inside gets synced back as new
			base.delete(path);
			return 'applied';
		}
		case 'remember':
			base.set(path, { local: local.get(path)!, disk: remote.get(path)! });
			return 'none';
		case 'forget':
			base.delete(path);
			return 'none';
		case 'renameLocal':
		case 'renameDisk':
			return 'none';
		case 'conflict':
			throw new Error(`File on one side, folder on the other: ${path}`);
	}
}
