// Planning of a sync run between the browser (OPFS, “local”) and a folder on disk (“disk”): pure logic.
// Rule: the newer version wins. What changed is decided against the state after the last run (`base`), so
// deletions propagate too. A change always beats a deletion. Nothing is compared by content.

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
	| { type: 'toDisk' | 'toLocal'; path: string }
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
				// Both new or both changed: the newer one wins (equal times: the same file)
				if (l.modified > d.modified) files.push({ type: 'toDisk', path });
				else if (d.modified > l.modified) files.push({ type: 'toLocal', path });
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

/** Files the plan deletes in the browser because they were deleted in the folder on disk */
export function deletedLocalFiles(ops: Op[]): number {
	return ops.filter((op) => op.type === 'deleteLocal' && op.kind === 'file').length;
}
