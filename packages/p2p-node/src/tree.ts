import { openAsBlob } from 'node:fs';
import { copyFile, lstat, mkdir, open, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import * as paths from 'node:path';
import { basename, dirname, join } from 'node:path';
import { segments } from '@in-browser/files/path.js';
import { ignored, type FileState, type Snapshot } from '@in-browser/files/sync/plan.js';
import { DIR } from '@in-browser/files/sync/scan.js';
import type { Tree } from '@in-browser/files/sync/tree.js';
import { beginVersion, versionDataPath, type VersionReason } from '@in-browser/files/sync/versions.js';
import { canFlush, syncDir } from './durable.js';
import { isBelow, realPath } from './real-path.js';

// A folder on disk as the P2P sync sees it: paths of the sync (`/a/b.txt`) below `root`. Modification times are
// whole milliseconds, like `File.lastModified` in the browser, so stat, read and scan agree.
// - Anything that can't be read throws (a scan never reports an unreadable folder as empty – that would look like
//   deletions); only what is really gone (ENOENT) is missing.
// - Where Node allows it (not in the sandbox, see `durable.ts`), writes reach the disk before they count (`flush`,
//   and the folder after a rename), so a power cut never leaves an empty file in place of a synced one.
// - Paths asked for by other devices stay in the folder (`real`): no name that the system reads as a path, and no
//   link in the folder that leads out of it. A scan builds its paths from what it reads and follows no links.

const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';

/** `versions`: folder for the earlier versions (`sync/versions.ts`) – then what the sync replaces or deletes goes there */
export function fsTree(root: string, { versions }: { versions?: string } = {}): Tree {
	/**
	 * A path as the system resolves it: links followed in the part that exists, the rest appended. A link that leads
	 * nowhere is refused – writing through it would create its target.
	 */
	async function settled(path: string): Promise<string> {
		const rest: string[] = [];
		for (let at = path; ; at = dirname(at)) {
			try {
				return join(await realpath(at), ...rest);
			} catch (e) {
				if (!missing(e) || dirname(at) === at) throw e;
				if (await lstat(at).catch(() => null)) throw new Error(`A link to nowhere: ${at}`);
				rest.unshift(basename(at));
			}
		}
	}

	/** Where a path lies on disk; throws for what would leave the folder (`real-path.ts`, and links inside it) */
	async function real(path: string): Promise<string> {
		const full = realPath(paths, root, segments(path));
		if (!isBelow(paths, await settled(paths.resolve(root)), await settled(full))) throw new Error(`Outside the folder: ${path}`);
		return full;
	}

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

	/** `dir`: the folder on disk, built from the names read there (they may be none of ours – those stay listed) */
	async function scan(folder: string, dir: string, into: Snapshot): Promise<Snapshot> {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
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
				await scan(path, join(dir, entry.name), into);
			} else if (entry.isFile()) {
				const s = await state(join(dir, entry.name));
				if (s) into.set(path, s);
			}
			// Symbolic links and other special entries are not synced
		}
		return into;
	}

	return {
		scan: () => scan('/', root, new Map()),
		stat: async (path) => state(await real(path)),
		async read(path) {
			const file = await real(path);
			const s = await stat(file);
			if (!s.isFile()) throw new Error(`Not a file: ${path}`);
			return new File([await openAsBlob(file)], segments(path).at(-1)!, { lastModified: Math.trunc(s.mtimeMs) });
		},
		async write(path) {
			const file = await real(path);
			await mkdir(join(file, '..'), { recursive: true });
			return positionalWriter(file, await canFlush(root)) as WritableStream<Uint8Array>;
		},
		mkdir: async (path) => void (await mkdir(await real(path), { recursive: true })),
		remove: async (path) => rm(await real(path), { recursive: true, force: true }),
		async move(from, to) {
			const [source, target] = [await real(from), await real(to)];
			await mkdir(dirname(target), { recursive: true });
			await rename(source, target);
			await syncDir(dirname(target));
		},
		async names(folder) {
			try {
				return await readdir(await real(folder));
			} catch (e) {
				if (missing(e)) return [];
				throw e;
			}
		},
		...(versions ? { keep: (path: string, reason: VersionReason) => keep(path, reason, versions) } : {})
	};

	async function keep(path: string, reason: VersionReason, dir: string) {
		const file = await real(path);
		const s = await state(file);
		if (s?.kind !== 'file') throw new Error(`Not a file: ${path}`);
		const store = fsTree(dir);
		const entry = await beginVersion(store, { path, reason, size: s.size, modified: s.modified });
		const target = join(dir, ...segments(versionDataPath(entry)));
		try {
			await rename(file, target);
		} catch (e) {
			// Another file system (the instance's folder and the synced one may lie on different disks)
			if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
			await copyFile(file, target);
			await rm(file);
		}
		await syncDir(join(file, '..'));
	}
}

/**
 * A file written like `FileSystemWritableFileStream`: plain chunks one after the other, `{ type: 'write', position,
 * data }` at a position (live writes of another device, e.g. a recording that fixes its header at the end)
 */
function positionalWriter(file: string, flush: boolean): WritableStream<Uint8Array | { type: 'write'; position?: number; data: Uint8Array }> {
	const handle = open(file, 'w');
	let position = 0;
	return new WritableStream({
		async write(chunk) {
			const fh = await handle;
			let data: Uint8Array;
			if (chunk instanceof Uint8Array) data = chunk;
			else {
				data = chunk.data;
				if (chunk.position !== undefined) position = chunk.position;
			}
			let written = 0;
			while (written < data.length) {
				const { bytesWritten } = await fh.write(data, written, data.length - written, position + written);
				written += bytesWritten;
			}
			position += data.length;
		},
		async close() {
			const fh = await handle;
			if (flush) await fh.sync();
			await fh.close();
		},
		async abort() {
			await (await handle).close();
		}
	});
}
