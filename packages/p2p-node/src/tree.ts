import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { segments } from '@in-browser/files/path.js';
import { ignored, type FileState, type Snapshot } from '@in-browser/files/sync/plan.js';
import type { Tree } from '@in-browser/files/p2p/session.js';

// A folder on disk as the P2P sync sees it: paths of the sync (`/a/b.txt`) below `root`. Modification times are
// whole milliseconds, like `File.lastModified` in the browser, so stat, read and scan agree.

const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };

export function fsTree(root: string): Tree {
	const real = (path: string) => join(root, ...segments(path));

	const state = async (path: string): Promise<FileState | null> => {
		try {
			const s = await stat(path);
			if (s.isDirectory()) return DIR;
			return s.isFile() ? { kind: 'file', size: s.size, modified: Math.trunc(s.mtimeMs) } : null;
		} catch {
			return null;
		}
	};

	async function scan(folder: string, into: Snapshot): Promise<Snapshot> {
		const entries = await readdir(real(folder), { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			const path = `${folder === '/' ? '' : folder}/${entry.name}`;
			if (ignored(path)) continue;
			if (entry.isDirectory()) {
				into.set(path, DIR);
				await scan(path, into);
			} else if (entry.isFile()) {
				const s = await state(real(path));
				if (s) into.set(path, s);
			}
			// Symbolic links and other special entries are not synced
		}
		return into;
	}

	return {
		scan: () => scan('/', new Map()),
		stat: (path) => state(real(path)),
		async read(path) {
			const file = real(path);
			const s = await stat(file);
			if (!s.isFile()) throw new Error(`Not a file: ${path}`);
			return new File([await openAsBlob(file)], segments(path).at(-1)!, { lastModified: Math.trunc(s.mtimeMs) });
		},
		async write(path) {
			const file = real(path);
			await mkdir(join(file, '..'), { recursive: true });
			return Writable.toWeb(createWriteStream(file)) as WritableStream<Uint8Array>;
		},
		mkdir: async (path) => void (await mkdir(real(path), { recursive: true })),
		remove: (path) => rm(real(path), { recursive: true, force: true }),
		async move(from, to) {
			await mkdir(join(real(to), '..'), { recursive: true });
			await rename(real(from), real(to));
		},
		names: async (folder) => (await readdir(real(folder)).catch(() => [])) as string[]
	};
}
