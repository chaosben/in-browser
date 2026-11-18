import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { segments } from '@in-browser/files/path.js';
import { ignored, type FileState, type Snapshot } from '@in-browser/files/sync/plan.js';
import type { Tree } from '@in-browser/files/sync/tree.js';
import { canFlush, syncDir } from './durable.js';

// A folder on disk as the P2P sync sees it: paths of the sync (`/a/b.txt`) below `root`. Modification times are
// whole milliseconds, like `File.lastModified` in the browser, so stat, read and scan agree.
// - Anything that can't be read throws (a scan never reports an unreadable folder as empty – that would look like
//   deletions); only what is really gone (ENOENT) is missing.
// - Where Node allows it (not in the sandbox, see `durable.ts`), writes reach the disk before they count (`flush`,
//   and the folder after a rename), so a power cut never leaves an empty file in place of a synced one.

const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };

const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';

export function fsTree(root: string): Tree {
	const real = (path: string) => join(root, ...segments(path));

	const state = async (path: string): Promise<FileState | null> => {
		try {
			const s = await stat(path);
			if (s.isDirectory()) return DIR;
			return s.isFile() ? { kind: 'file', size: s.size, modified: Math.trunc(s.mtimeMs) } : null;
		} catch (e) {
			if (missing(e)) return null;
			throw e;
		}
	};

	async function scan(folder: string, into: Snapshot): Promise<Snapshot> {
		let entries;
		try {
			entries = await readdir(real(folder), { withFileTypes: true });
		} catch (e) {
			// Gone (the whole folder: the sync then holds all deletions for confirmation); anything else stops the scan
			if (missing(e)) return into;
			throw e;
		}
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
			return Writable.toWeb(createWriteStream(file, { flush: await canFlush(root) })) as WritableStream<Uint8Array>;
		},
		mkdir: async (path) => void (await mkdir(real(path), { recursive: true })),
		remove: (path) => rm(real(path), { recursive: true, force: true }),
		async move(from, to) {
			await mkdir(join(real(to), '..'), { recursive: true });
			await rename(real(from), real(to));
			await syncDir(join(real(to), '..'));
		},
		async names(folder) {
			try {
				return await readdir(real(folder));
			} catch (e) {
				if (missing(e)) return [];
				throw e;
			}
		}
	};
}
