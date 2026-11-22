import { caseRenames, holdDeletes, holdLarge, pathKey, plan, renameKeys, type Base, type FileState, type HeldFolder, type HoldLimits, type Op, type Snapshot } from './plan.js';
import { FilesError } from '../entry.js';
import type { LogFn } from './log.js';
import { DIR, stateOf } from './scan.js';
import { packageOf } from '../formats.js';
import { discard, hashFile, isGone, receive, renameIn, validName, type Other, type PackageCopies, type PutResult } from './tree-ops.js';
import type { Tree } from './tree.js';

// Carrying out a plan (`plan.ts`) between this side's tree and the other side – shared by the folder sync (the other
// side is a folder on disk) and the P2P sync (another device, over RPC). Rules that keep the user's data:
// - Nothing is overwritten or deleted that changed since the plan was made: right before, its state is compared
//   with the one the plan saw; if it differs, the step is skipped (the next run plans again).
// - Files arrive in a hidden temporary file and are moved into place only when complete.
// - The losing version of a change on both sides becomes a conflict copy (unless the content is the same).
// - No versions are kept: what the other side deleted or replaced is deleted or replaced here: the
//   user's own deletions are kept in the synced trash (`trash.ts`), so they are on every device anyway.

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
	/** New folders that are large or don't fit wait for confirmation (`holdLarge`) */
	holdLarge?: HoldLimits;
	onWrite?: (path: string) => void;
	onProgress?: (done: number, total: number) => void;
	log?: LogFn;
}

export interface SyncResult {
	applied: number;
	failed: number;
	/** Steps left alone because something changed since the plan: run again soon */
	skipped: number;
	/** Paths whose losing version was kept as a conflict copy (for a file inside a package: the package) */
	conflicts: string[];
	/** Files whose deletion waits for confirmation */
	pendingDeletes: number;
	/** The deletions waiting for confirmation */
	held: Op[];
	/** New folders waiting for confirmation */
	heldFolders: HeldFolder[];
}

/** Plans and carries out one sync between `mine` (snapshot `local`) and `other` (snapshot `remote`) */
export async function runSync(mine: Tree, other: Other, local: Snapshot, remote: Snapshot, options: SyncOptions): Promise<SyncResult> {
	const result: SyncResult = { applied: 0, failed: 0, skipped: 0, conflicts: [], pendingDeletes: 0, held: [], heldFolders: [] };
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

	// Large new folders, or those that don't fit, wait for confirmation; the rest goes on
	if (options.holdLarge) {
		const outcome = holdLarge(ops, local, remote, options.holdLarge);
		ops = outcome.ops;
		result.heldFolders = outcome.held;
		if (outcome.held.length) log?.('sync.foldersHeld', { folders: outcome.held });
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
	const copies: PackageCopies = new Map();
	// Where storage is limited (a browser's quota), a file that doesn't fit isn't even started: it would arrive,
	// fail and start again on every run
	const room = { in: options.holdLarge?.free.in ?? null, out: options.holdLarge?.free.out ?? null };
	for (const [i, op] of ops.entries()) {
		try {
			if (op.type === 'toLocal' || op.type === 'toDisk') {
				const side = op.type === 'toLocal' ? 'in' : 'out';
				const size = (side === 'in' ? remote : local).get(op.path)?.size ?? 0;
				const left = room[side];
				if (left !== null) {
					if (size > left) throw new FilesError('full', op.path);
					room[side] = left - size;
				}
			}
			if ((op.type === 'deleteLocal' || op.type === 'deleteDisk') && written.has(pathKey(op.path))) {
				result.skipped++;
				log?.('sync.skipped', { ...op, reason: 'a name differing only in case was written in this run' });
			} else {
				const outcome = await apply(mine, other, options, base, op, local, remote, write, result, copies);
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
	log?.('sync.done', { applied: result.applied, failed: result.failed, skipped: result.skipped, conflicts: result.conflicts, pendingDeletes: result.pendingDeletes, heldFolders: result.heldFolders.length });
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

async function apply(
	mine: Tree,
	other: Other,
	options: SyncOptions,
	base: Base,
	op: Op,
	local: Snapshot,
	remote: Snapshot,
	write: (path: string) => void,
	result: SyncResult,
	copies: PackageCopies
): Promise<'applied' | 'skipped' | 'none'> {
	const { path } = op;
	/** A package is one document: a conflict inside it is the package's */
	const conflict = (copy: string, kept: 'here' | 'there') => {
		const document = packageOf(path) ?? path;
		if (!result.conflicts.includes(document)) result.conflicts.push(document);
		options.log?.('sync.conflictCopy', { path, copy, kept });
	};
	switch (op.type) {
		case 'toLocal': {
			if (!validName(path)) throw new Error(`Invalid name: ${path}`);
			let received: Awaited<ReturnType<typeof receive<FileState>>>;
			try {
				received = await receive(mine, path, (target) => other.get(path, target), {
					keep: op.both ? options.conflictLabel('mine') : undefined,
					expect: local.get(path) ?? null,
					onWrite: write,
					packages: copies
				});
			} catch (e) {
				// Gone there since the plan
				if (isGone(e)) return 'skipped';
				throw e;
			}
			if ('stale' in received) return 'skipped';
			if (received.copy) conflict(received.copy, 'here');
			base.set(path, { local: (await mine.stat(path))!, disk: received.result });
			return 'applied';
		}
		case 'toDisk': {
			let file: File;
			let reply: PutResult;
			try {
				file = await mine.read(path);
				reply = await other.put(path, file.stream(), { keep: op.both ? options.conflictLabel('theirs') : undefined, expect: remote.get(path) ?? null });
			} catch (e) {
				// Gone here since the plan (e.g. the trash was emptied while a large entry was on its way)
				if ((await mine.stat(path).catch(() => undefined)) === null) return 'skipped';
				throw e;
			}
			if ('stale' in reply) return 'skipped';
			if (reply.copy) conflict(reply.copy, 'there');
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
