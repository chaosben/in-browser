import { FilesError, type Entry } from '../entry.js';
import { dirAt, moveFile, renameEntry } from '../handles.js';
import { basename, join, nameKey, parent, segments } from '../path.js';
import type { Source } from './source.js';

// A folder on disk as a connected source (File System Access API, Chromium): read and written in place, never copied.

/** Turns errors of the File System Access API into `FilesError`s */
function mapped(e: unknown, path: string): never {
	if (e instanceof FilesError) throw e;
	if (e instanceof DOMException) {
		if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError') throw new FilesError('notFound', path);
		if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw new FilesError('denied', '/');
		if (e.name === 'InvalidModificationError') throw new FilesError('exists', path);
	}
	throw e;
}

export function folderSource(root: FileSystemDirectoryHandle): Source {
	/** Every access first checks the browser still allows it (it asks again after a restart unless allowed for good) */
	async function access() {
		const state = (await root.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
		if (state !== 'granted') throw new FilesError('denied', '/');
	}

	async function run<T>(path: string, action: () => Promise<T>): Promise<T> {
		await access();
		try {
			return await action();
		} catch (e) {
			mapped(e, path);
		}
	}

	const dir = (path: string, create = false) => dirAt(root, segments(path), create);

	async function entryOf(path: string, handle: FileSystemHandle): Promise<Entry> {
		if (handle.kind === 'directory') return { name: basename(path), path, kind: 'directory' };
		const file = await (handle as FileSystemFileHandle).getFile();
		return { name: basename(path), path, kind: 'file', size: file.size, modified: file.lastModified };
	}

	async function handleOf(path: string): Promise<FileSystemHandle | null> {
		if (path === '/') return root;
		let folder: FileSystemDirectoryHandle;
		try {
			folder = await dir(parent(path));
		} catch (e) {
			if (e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null;
			throw e;
		}
		for (const get of [() => folder.getFileHandle(basename(path)), () => folder.getDirectoryHandle(basename(path))]) {
			try {
				return await get();
			} catch (e) {
				if (!(e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError'))) throw e;
			}
		}
		return null;
	}

	return {
		caps: { readOnly: false, trash: false },
		list: (path) =>
			run(path, async () => {
				const entries: Promise<Entry>[] = [];
				for await (const [name, handle] of (await dir(path)).entries()) entries.push(entryOf(join(path, name), handle));
				return Promise.all(entries);
			}),
		stat: (path) =>
			run(path, async () => {
				const handle = await handleOf(path);
				return handle && entryOf(path, handle);
			}),
		read: (path) => run(path, async () => (await (await dir(parent(path))).getFileHandle(basename(path))).getFile()),
		writable: (path) =>
			run(path, async () => {
				const file = await (await dir(parent(path))).getFileHandle(basename(path), { create: true });
				return file.createWritable();
			}),
		mkdir: (path) => run(path, async () => void (await dir(path, true))),
		remove: (path) =>
			run(path, async () => {
				try {
					await (await dir(parent(path))).removeEntry(basename(path), { recursive: true });
				} catch (e) {
					if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
				}
			}),
		move: (from, to) =>
			run(from, async () => {
				const source = await dir(parent(from));
				if (parent(from) === parent(to) && nameKey(basename(from)) === nameKey(basename(to))) {
					return renameEntry(source, basename(from), basename(to));
				}
				const handle = await handleOf(from);
				if (handle?.kind === 'directory') {
					// Folders: rename in place where possible, otherwise entry by entry
					if (parent(from) === parent(to)) return renameEntry(source, basename(from), basename(to));
					await moveFolder(handle as FileSystemDirectoryHandle, await dir(to, true));
					await source.removeEntry(basename(from), { recursive: true });
					return;
				}
				await moveFile(source, basename(from), await dir(parent(to)), basename(to));
			})
	};
}

/** Moves the content of a folder into another, file by file (natively where possible) */
async function moveFolder(from: FileSystemDirectoryHandle, to: FileSystemDirectoryHandle): Promise<void> {
	const children: [string, FileSystemHandle][] = [];
	for await (const entry of from.entries()) children.push(entry);
	for (const [name, child] of children) {
		if (child.kind === 'file') await moveFile(from, name, to, name);
		else await moveFolder(child as FileSystemDirectoryHandle, await to.getDirectoryHandle(name, { create: true }));
	}
}
