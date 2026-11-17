import { list, mkdir, move, read, remove, rootHandle, stat, writable } from '../fs.js';
import { scan } from '../sync/scan.js';
import type { Tree } from './session.js';

// The shared file system (OPFS) as the P2P sync sees it; every change goes through fs.ts (locks, `watch`)

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
	names: async (folder) => (await list(folder).catch(() => [])).map((entry) => entry.name)
};
