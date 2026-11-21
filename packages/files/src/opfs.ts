import { requestPersistence } from './cache.js';
import { changed } from './changes.js';
import { FilesError, type Entry } from './entry.js';
import { basename, nameKey, nameProblem, normalize, parent, segments } from './path.js';
import { childHandle, isMissing, nativeMove } from './handles.js';

// My files in the Origin Private File System (OPFS), as they really are on this device: no routing to connected
// folders or other devices (that is fs.ts). Used by the syncs, the trash cleanup and to answer live requests of other
// devices; tools use fs.ts.
//   files/…          root `/` of the file system (“My files”): visible in Files and mirrored into a real folder (sync)
//   cache/<tool>/…   private local data of a tool (see cache.ts), neither shown nor synced

const ROOT_DIR = 'files';

export function supported() {
	return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function rootDir() {
	return (await navigator.storage.getDirectory()).getDirectoryHandle(ROOT_DIR, { create: true });
}

/** OPFS folder of the root `/` (for the sync, which walks it directly) */
export const rootHandle = rootDir;

let asked = false;
/** Before the first write of a page: ask the browser to keep the storage (what is written may be the only copy) */
function keepStorage() {
	if (asked) return;
	asked = true;
	void requestPersistence().catch(() => false);
}

/** A write the browser refused for lack of space, as `full` */
function full(e: unknown, path: string): never {
	if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new FilesError('full', path);
	throw e;
}

function notFound(e: unknown, path: string): never {
	if (isMissing(e)) throw new FilesError('notFound', path);
	throw e;
}

/** Folder handle of `path`; `create` also creates missing parents */
async function dirHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
	let handle = await rootDir();
	for (const name of segments(path)) {
		try {
			handle = await handle.getDirectoryHandle(name, { create });
		} catch (e) {
			notFound(e, path);
		}
	}
	return handle;
}

async function fileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
	const name = basename(path);
	if (!name) throw new FilesError('root', path);
	const dir = await dirHandle(parent(path), create);
	try {
		return await dir.getFileHandle(name, { create });
	} catch (e) {
		notFound(e, path);
	}
}

/** Handle of a file or folder, `null` if there is none */
async function anyHandle(path: string): Promise<FileSystemHandle | null> {
	const name = basename(path);
	if (!name) return rootDir();
	let dir: FileSystemDirectoryHandle;
	try {
		dir = await dirHandle(parent(path));
	} catch (e) {
		if (e instanceof FilesError) return null;
		throw e;
	}
	return childHandle(dir, name);
}

/** Before creating `name` in `dir`: valid name, no other entry that only differs in case (would clash on disk) */
async function checkNew(dir: FileSystemDirectoryHandle, path: string) {
	const name = basename(path);
	if (nameProblem(name)) throw new FilesError('invalidName', path);
	const key = nameKey(name);
	for await (const other of dir.keys()) {
		if (other !== name && nameKey(other) === key) throw new FilesError('collision', path);
	}
}

// --- Reading ---

async function entryOf(path: string, handle: FileSystemHandle): Promise<Entry> {
	if (handle.kind === 'directory') return { name: basename(path), path, kind: 'directory' };
	const file = await (handle as FileSystemFileHandle).getFile();
	return { name: basename(path), path, kind: 'file', size: file.size, modified: file.lastModified };
}

/** Entries of a folder (unsorted), including hidden ones */
export async function list(path: string): Promise<Entry[]> {
	path = normalize(path);
	const dir = await dirHandle(path);
	const entries: Promise<Entry>[] = [];
	for await (const [name, handle] of dir.entries()) entries.push(entryOf(path === '/' ? `/${name}` : `${path}/${name}`, handle));
	return Promise.all(entries);
}

/** File or folder at `path`, `null` if there is none */
export async function stat(path: string): Promise<Entry | null> {
	path = normalize(path);
	const handle = await anyHandle(path);
	return handle && entryOf(path, handle);
}

export async function exists(path: string): Promise<boolean> {
	return (await anyHandle(normalize(path))) !== null;
}

export async function read(path: string): Promise<File> {
	return (await fileHandle(normalize(path))).getFile();
}

// --- Writing ---

/** Creates the folder and its parents (no error if it exists). */
export async function mkdir(path: string): Promise<void> {
	path = normalize(path);
	let handle = await rootDir();
	let current = '';
	let created = false;
	for (const name of segments(path)) {
		current += `/${name}`;
		try {
			handle = await handle.getDirectoryHandle(name);
		} catch (e) {
			// A file of that name is in the way
			if (e instanceof DOMException && e.name === 'TypeMismatchError') throw new FilesError('exists', current);
			await checkNew(handle, current);
			handle = await handle.getDirectoryHandle(name, { create: true });
			created = true;
		}
	}
	if (created) changed(path);
}

/** Writes a whole file at once (creates parents; replaces the content only when complete). */
export async function write(path: string, data: Blob | BufferSource | string): Promise<void> {
	path = normalize(path);
	await mkdir(parent(path));
	await navigator.locks.request(`files:${path}`, async () => {
		if (!(await exists(path))) await checkNew(await dirHandle(parent(path)), path);
		keepStorage();
		const writable = await (await fileHandle(path, true)).createWritable();
		try {
			await writable.write(data);
			await writable.close();
		} catch (e) {
			await writable.abort().catch(() => {});
			full(e, path);
		}
	});
	changed(path);
}

/**
 * Opens a file for streaming (creates parents). Accepts the chunks of `FileSystemWritableFileStream`
 * (also `{ type: 'write', position, data }`, so it works with Mediabunny's `StreamTarget`); the content is replaced
 * when the stream is closed, which is also when the change is announced.
 */
export async function writable(path: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	path = normalize(path);
	await mkdir(parent(path));
	if (!(await exists(path))) await checkNew(await dirHandle(parent(path)), path);
	keepStorage();
	const inner = await (await fileHandle(path, true)).createWritable();
	return new WritableStream<FileSystemWriteChunkType>({
		write: (chunk) => inner.write(chunk).catch((e) => full(e, path)),
		close: async () => {
			await inner.close().catch((e) => full(e, path));
			changed(path);
		},
		abort: (reason) => inner.abort(reason)
	});
}

/** Deletes a file or a folder with everything in it (no error if it does not exist). */
export async function remove(path: string): Promise<void> {
	path = normalize(path);
	const name = basename(path);
	if (!name) throw new FilesError('root', path);
	try {
		await (await dirHandle(parent(path))).removeEntry(name, { recursive: true });
	} catch (e) {
		if (!(e instanceof FilesError) && !(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
	}
	changed(path);
}

/** Copies a file or folder to `to` (must not exist yet). */
export async function copy(from: string, to: string): Promise<void> {
	from = normalize(from);
	to = normalize(to);
	if (to === from || to.startsWith(from + '/')) throw new FilesError('intoItself', to);
	const source = await anyHandle(from);
	if (!source) throw new FilesError('notFound', from);
	if (await exists(to)) throw new FilesError('exists', to);
	await copyHandle(source, to);
	changed(to);
}

async function copyHandle(source: FileSystemHandle, to: string): Promise<void> {
	if (source.kind === 'file') {
		await (await (source as FileSystemFileHandle).getFile()).stream().pipeTo(await writable(to));
		return;
	}
	await mkdir(to);
	for await (const [name, child] of (source as FileSystemDirectoryHandle).entries()) {
		await copyHandle(child, `${to}/${name}`);
	}
}

/** Moves or renames a file or folder to `to` (must not exist yet, except for a change in case only). */
export async function move(from: string, to: string): Promise<void> {
	from = normalize(from);
	to = normalize(to);
	if (to === from) return;
	if (to.startsWith(from + '/')) throw new FilesError('intoItself', to);
	const source = await anyHandle(from);
	if (!source || !basename(from)) throw new FilesError(basename(from) ? 'notFound' : 'root', from);
	const caseOnly = parent(from) === parent(to) && nameKey(basename(from)) === nameKey(basename(to));
	if (!caseOnly && (await exists(to))) throw new FilesError('exists', to);
	if (nameProblem(basename(to))) throw new FilesError('invalidName', to);
	await mkdir(parent(to));
	if (!caseOnly) await checkNew(await dirHandle(parent(to)), to);
	// Native move where the browser supports it (fast, also for large videos), otherwise copy and delete
	if (!(await nativeMove(source, await dirHandle(parent(to)), basename(to)))) {
		const target = caseOnly ? `${parent(to)}/.moving-${crypto.randomUUID()}` : to;
		await moveHandle(source, target);
		await remove(from);
		if (caseOnly) await move(target, to);
	}
	changed(from, to);
}

/**
 * Moves file by file where folders can't be moved natively (Chromium): files move natively (fast, no copy), only
 * what can't is copied. The source folders are removed by the caller once empty.
 */
async function moveHandle(source: FileSystemHandle, to: string): Promise<void> {
	if (source.kind === 'file') {
		if (!(await nativeMove(source, await dirHandle(parent(to), true), basename(to)))) await copyHandle(source, to);
		return;
	}
	await mkdir(to);
	const children: [string, FileSystemHandle][] = [];
	for await (const entry of (source as FileSystemDirectoryHandle).entries()) children.push(entry);
	for (const [name, child] of children) await moveHandle(child, `${to}/${name}`);
}
