import { FilesError, list, mkdir, move, read, remove, rootHandle, stat, writable } from '../fs.js';
import { scan } from './scan.js';
import type { Tree } from './tree.js';

// The shared file system (OPFS) as both syncs see it; every change goes through fs.ts (locks, `watch`)

export const opfsTree: Tree = {
	scan: async () => scan(await rootHandle()),
	async stat(path) {
		const entry = await stat(path);
		if (!entry) return null;
		return entry.kind === 'file'
			? { kind: 'file', size: entry.size ?? 0, modified: entry.modified ?? 0 }
			: { kind: 'directory', size: 0, modified: 0 };
	},
	read,
	write: (path) => writable(path) as Promise<WritableStream<Uint8Array>>,
	mkdir,
	remove,
	move,
	async names(folder) {
		try {
			return (await list(folder)).map((entry) => entry.name);
		} catch (e) {
			// Only a missing folder has no names; anything else must not look empty
			if (e instanceof FilesError && e.code === 'notFound') return [];
			throw e;
		}
	}
};
