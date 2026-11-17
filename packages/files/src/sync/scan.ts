import { ignored, type FileState, type Snapshot } from './plan.js';

// Reading a whole tree into a snapshot (folder sync and P2P sync)

/** All files and folders below `dir` (paths from its root), without ignored ones */
export async function scan(dir: FileSystemDirectoryHandle, prefix = '', into: Snapshot = new Map()): Promise<Snapshot> {
	for await (const [name, handle] of dir.entries()) {
		const path = `${prefix}/${name}`;
		if (ignored(path)) continue;
		if (handle.kind === 'directory') {
			into.set(path, DIR);
			await scan(handle as FileSystemDirectoryHandle, path, into);
		} else {
			into.set(path, stateOf(await (handle as FileSystemFileHandle).getFile()));
		}
	}
	return into;
}

export const stateOf = (file: File): FileState => ({ kind: 'file', size: file.size, modified: file.lastModified });
export const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };
