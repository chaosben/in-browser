import { nameKey, segments } from '../path.js';
import { inTrash, TRASH_ROOT } from '../trash.js';

// Planning of a sync run between this side (“local”) and the other one (“disk”: a folder on disk or another
// device): pure logic. Rule: the newer version wins. What changed is decided against the state after the last run
// (`base`), so deletions propagate too. A change always beats a deletion. Nothing is compared by content here; the
// losing version of a change on both sides is kept as a conflict copy when it really differs (`sync/apply.ts`).

export interface FileState {
	kind: 'file' | 'directory';
	/** Bytes (0 for folders) */
	size: number;
	/** Last change in ms (0 for folders) */
	modified: number;
}

/** Path (`/a/b.txt`) → state; one side at one moment */
export type Snapshot = Map<string, FileState>;

/** State of both sides right after a path was last synced */
export interface BaseEntry {
	local: FileState;
	disk: FileState;
}
export type Base = Map<string, BaseEntry>;

export type Op =
	/** `both`: changed on both sides since the base (the other version is lost unless kept as a conflict copy) */
	| { type: 'toDisk' | 'toLocal'; path: string; both?: true }
	/** Renamed on the other side in upper/lower case only (`from` → `path`): renamed here too, before anything else */
	| { type: 'renameDisk' | 'renameLocal'; path: string; from: string; kind: FileState['kind'] }
	/** Folder missing on one side */
	| { type: 'mkdirDisk' | 'mkdirLocal'; path: string }
	| { type: 'deleteDisk' | 'deleteLocal'; path: string; kind: FileState['kind'] }
	/** Both sides agree (e.g. after the first run): only remember */
	| { type: 'remember'; path: string }
	/** Gone on both sides: drop from the base */
	| { type: 'forget'; path: string }
	/** File on one side, folder on the other: left alone */
	| { type: 'conflict'; path: string };

// Temporary and system files of browsers, operating systems, office programs and sync tools
const IGNORED = [
	/\.crswap$/i,
	/^\.ds_store$/i,
	/^\._/,
	/^thumbs\.db$/i,
	/^desktop\.ini$/i,
	/^~\$/,
	/^\.~lock\..*#$/,
	/\.(tmp|part|partial|crdownload)$/i,
	/^\.syncthing\./,
	/^\.stfolder$/,
	/^\.stversions$/,
	/^\.stignore$/,
	/^\.dropbox(\.cache)?$/,
	/^\.sync_.*\.db/,
	/^\.owncloudsync\.log/,
	/^\.nextcloudsync\.log/,
	/^\.moving-/
];

/** Never synced (any part of the path matches) */
export function ignored(path: string): boolean {
	return path
		.split('/')
		.filter(Boolean)
		.some((name) => IGNORED.some((pattern) => pattern.test(name)));
}

const same = (a: FileState, b: FileState) => a.kind === b.kind && a.size === b.size && a.modified === b.modified;

export function plan(local: Snapshot, disk: Snapshot, base: Base): Op[] {
	const paths = new Set([...local.keys(), ...disk.keys(), ...base.keys()]);
	const files: Op[] = [];
	const mkdirs: Op[] = [];
	const deletes: Op[] = [];
	for (const path of paths) {
		if (ignored(path)) continue;
		const l = local.get(path);
		const d = disk.get(path);
		const b = base.get(path);
		const localChanged = !!l && (!b || !same(l, b.local));
		const diskChanged = !!d && (!b || !same(d, b.disk));

		if (l && d) {
			if (l.kind !== d.kind) files.push({ type: 'conflict', path });
			else if (l.kind === 'directory') {
				if (!b) files.push({ type: 'remember', path });
			} else if (localChanged && diskChanged) {
				// Both new or both changed: the newer one wins (equal time and size: taken for the same file; equal time
				// but another size: the other side's version, this one is kept as a conflict copy)
				if (l.modified > d.modified) files.push({ type: 'toDisk', path, both: true });
				else if (d.modified > l.modified || l.size !== d.size) files.push({ type: 'toLocal', path, both: true });
				else files.push({ type: 'remember', path });
			} else if (localChanged) files.push({ type: 'toDisk', path });
			else if (diskChanged) files.push({ type: 'toLocal', path });
		} else if (l) {
			// Gone on disk: deleted there, unless it is new or changed here
			if (b && !localChanged) deletes.push({ type: 'deleteLocal', path, kind: l.kind });
			else if (l.kind === 'directory') mkdirs.push({ type: 'mkdirDisk', path });
			else files.push({ type: 'toDisk', path });
		} else if (d) {
			if (b && !diskChanged) deletes.push({ type: 'deleteDisk', path, kind: d.kind });
			else if (d.kind === 'directory') mkdirs.push({ type: 'mkdirLocal', path });
			else files.push({ type: 'toLocal', path });
		} else if (b) {
			files.push({ type: 'forget', path });
		}
	}
	// Folders first (parents before children), then files, then deletions (children before parents)
	const depth = (op: Op) => op.path.split('/').length;
	mkdirs.sort((a, b) => depth(a) - depth(b));
	deletes.sort((a, b) => depth(b) - depth(a));
	return [...mkdirs, ...files, ...deletes];
}

/** Path with every name in its case-insensitive form (two paths that clash on Windows/macOS get the same key) */
export const pathKey = (path: string) => segments(path).map(nameKey).join('/');

/** The entries with `from` and everything below it under `to` */
export const renameKeys = <T>(entries: Map<string, T>, from: string, to: string): Map<string, T> =>
	new Map([...entries].map(([path, value]) => [path === from || path.startsWith(from + '/') ? to + path.slice(from.length) : path, value]));

/**
 * Renames in upper/lower case only. Planned as a copy plus a deletion they would destroy the file on systems that
 * don't tell the two names apart (the copy lands in the old file, then the deletion removes it). So they become a
 * rename on the other side, and the plan then works on snapshots and base as if the rename were done already.
 * Only when the old name was synced before (in the base) and the new one is unknown there.
 */
export function caseRenames(local: Snapshot, disk: Snapshot, base: Base): { renames: Op[]; local: Snapshot; disk: Snapshot; base: Base } {
	const renames: Op[] = [];
	for (let round = 0; round < 64; round++) {
		const found = findRename(local, disk, base, 'disk') ?? findRename(disk, local, base, 'local');
		if (!found) break;
		const { from, to, side } = found;
		if (side === 'disk') disk = renameKeys(disk, from, to);
		else local = renameKeys(local, from, to);
		base = renameKeys(base, from, to);
		renames.push({ type: side === 'disk' ? 'renameDisk' : 'renameLocal', path: to, from, kind: (side === 'disk' ? local : disk).get(to)!.kind });
	}
	return { renames, local, disk, base };
}

/** The topmost path renamed on side `renamed` that `stale` (the side named `side`) still has under its old name */
function findRename(renamed: Snapshot, stale: Snapshot, base: Base, side: 'disk' | 'local') {
	const byKey = new Map<string, string[]>();
	for (const path of renamed.keys()) {
		if (stale.has(path) || base.has(path)) continue;
		const key = pathKey(path);
		byKey.set(key, [...(byKey.get(key) ?? []), path]);
	}
	if (!byKey.size) return null;
	const candidates = [...stale.keys()]
		.filter((path) => !renamed.has(path) && base.has(path))
		.sort((a, b) => segments(a).length - segments(b).length);
	for (const from of candidates) {
		const matches = byKey.get(pathKey(from)) ?? [];
		// Exactly one new spelling of the same kind, otherwise it's not clear what happened
		if (matches.length === 1 && renamed.get(matches[0])!.kind === stale.get(from)!.kind) return { from, to: matches[0], side };
	}
	return null;
}

/** Files the plan deletes in the browser because they were deleted in the folder on disk (not counting the trash:
 * expired entries are removed on every device and must never wait for confirmation) */
export function deletedLocalFiles(ops: Op[]): number {
	return ops.filter((op) => op.type === 'deleteLocal' && op.kind === 'file' && !inTrash(op.path)).length;
}

/** From this many files deleted on the other side (and a quarter of all synced ones) deletions wait for confirmation */
export const MANY_DELETES = 20;

/**
 * Whether the deletions coming from the other side must wait for confirmation: when that side is empty (lost or
 * emptied by accident) or when they are many.
 */
export function holdDeletes(ops: Op[], other: Snapshot, base: Base): boolean {
	const deletes = deletedLocalFiles(ops);
	if (!deletes) return false;
	const otherFiles = [...other].filter(([path, s]) => s.kind === 'file' && !inTrash(path)).length;
	const baseFiles = [...base].filter(([path, b]) => b.local.kind === 'file' && !inTrash(path)).length;
	return otherFiles === 0 || (deletes >= MANY_DELETES && deletes * 4 > baseFiles);
}

/** A new folder whose transfer waits for confirmation (large, or more than fits on the receiving side) */
export interface HeldFolder {
	path: string;
	/** Bytes of the files that would arrive */
	bytes: number;
	/** `in`: would arrive on this side (“local”); `out`: on the other side (“disk”) */
	direction: 'in' | 'out';
	/** It doesn't fit into the free space there (else: it reached the limit) */
	full: boolean;
}

export interface HoldLimits {
	/** Bytes from which a new folder waits, per receiving side (suite setting `sync.askAbove`); `null`: never because
	 * of its size (also a side where nobody could confirm, like a p2p-node) */
	limit: { in: number | null; out: number | null };
	/** Free bytes on each side, where known (a browser's quota; disks don't count) */
	free: { in?: number | null; out?: number | null };
	/** Folders the user let through: never held */
	allowed: readonly string[];
	/** Sides to look at (default both) */
	directions?: readonly ('in' | 'out')[];
}

/**
 * Holds back the transfers into folders that are new on the receiving side when they reach the limit or don't fit
 * there. A new folder is the topmost folder the plan creates on that side; everything below it waits with it
 * (including its own creation, so it stays new until confirmed). The rest of the run goes on.
 */
export function holdLarge(ops: Op[], local: Snapshot, disk: Snapshot, limits: HoldLimits): { ops: Op[]; held: HeldFolder[] } {
	const held: HeldFolder[] = [];
	const holding = new Set<string>();
	for (const direction of limits.directions ?? (['in', 'out'] as const)) {
		const mkdir = direction === 'in' ? 'mkdirLocal' : 'mkdirDisk';
		const transfer = direction === 'in' ? 'toLocal' : 'toDisk';
		const source = direction === 'in' ? disk : local;
		const created = new Set(ops.filter((op) => op.type === mkdir).map((op) => op.path));
		const roots = [...created].filter((path) => !created.has(parentOf(path)));
		const free = limits.free[direction];
		const limit = limits.limit[direction];
		for (const root of roots) {
			// Tool data and the trash always travel (like `holdDeletes`, which ignores the trash)
			if (inTrash(root) || root === TRASH_ROOT || root === '/.apps' || root.startsWith('/.apps/')) continue;
			if (limits.allowed.some((folder) => folder === root || root.startsWith(folder + '/'))) continue;
			const inside = (path: string) => path === root || path.startsWith(root + '/');
			let bytes = 0;
			for (const op of ops) if (op.type === transfer && inside(op.path)) bytes += source.get(op.path)?.size ?? 0;
			const full = free != null && bytes > free;
			if (!full && (limit === null || bytes < limit)) continue;
			held.push({ path: root, bytes, direction, full });
			for (const op of ops) if ((op.type === transfer || op.type === mkdir) && inside(op.path)) holding.add(`${op.type} ${op.path}`);
		}
	}
	return { ops: ops.filter((op) => !holding.has(`${op.type} ${op.path}`)), held };
}

const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
