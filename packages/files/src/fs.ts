import { basename, nameKey, nameProblem, normalize, parent, segments } from './path.js';

// The shared file system of all tools, stored in the Origin Private File System (OPFS):
//   files/…          root `/` of the file system: visible in Files and mirrored into a real folder (sync)
//   cache/<tool>/…   private local data of a tool (see cache.ts), neither shown nor synced
// Data a tool wants to carry along to other computers belongs under `/.apps/<tool>/` (hidden, but synced).
// Changes are announced to every tab (`watch`).

export interface Entry {
	name: string;
	path: string;
	kind: 'file' | 'directory';
	/** Bytes (files only) */
	size?: number;
	/** Last change in ms (files only; OPFS folders have no date) */
	modified?: number;
}

export type FilesErrorCode = 'notFound' | 'exists' | 'collision' | 'invalidName' | 'intoItself' | 'root';

/** Error with a code the UI translates (`filesMessages().errors`) */
export class FilesError extends Error {
	constructor(
		readonly code: FilesErrorCode,
		readonly path: string
	) {
		super(`${code}: ${path}`);
		this.name = 'FilesError';
	}
}

const ROOT_DIR = 'files';

export function supported() {
	return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function rootDir() {
	return (await navigator.storage.getDirectory()).getDirectoryHandle(ROOT_DIR, { create: true });
}

/** OPFS folder of the root `/` (for the sync, which walks it directly) */
export const rootHandle = rootDir;

function notFound(e: unknown, path: string): never {
	if (e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) {
		throw new FilesError('notFound', path);
	}
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
	for (const get of [() => dir.getFileHandle(name), () => dir.getDirectoryHandle(name)]) {
		try {
			return await get();
		} catch (e) {
			if (!(e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError'))) throw e;
		}
	}
	return null;
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

// --- Change notifications (all tabs of the origin) ---

type Listener = (paths: string[]) => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function ensureChannel() {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel('files:changes');
	channel.onmessage = (e) => listeners.forEach((l) => l(e.data as string[]));
}

/** Announces changed paths (files or folders) to this and every other tab. */
export function changed(...paths: string[]) {
	ensureChannel();
	channel?.postMessage(paths);
	listeners.forEach((l) => l(paths));
}

/** Calls `listener` with the paths of every change (also from other tabs); returns the unsubscribe function. */
export function watch(listener: Listener): () => void {
	ensureChannel();
	listeners.add(listener);
	return () => listeners.delete(listener);
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

export async function readText(path: string): Promise<string> {
	return (await read(path)).text();
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
		const writable = await (await fileHandle(path, true)).createWritable();
		await writable.write(data);
		await writable.close();
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
	const inner = await (await fileHandle(path, true)).createWritable();
	return new WritableStream<FileSystemWriteChunkType>({
		write: (chunk) => inner.write(chunk),
		close: async () => {
			await inner.close();
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
	const native = (source as FileSystemHandle & { move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> }).move;
	let moved = false;
	if (native) {
		try {
			await native.call(source, await dirHandle(parent(to)), basename(to));
			moved = true;
		} catch (e) {
			if (!(e instanceof DOMException) && !(e instanceof TypeError)) throw e;
		}
	}
	if (!moved) {
		const target = caseOnly ? `${parent(to)}/.moving-${crypto.randomUUID()}` : to;
		await copyHandle(source, target);
		await remove(from);
		if (caseOnly) await move(target, to);
	}
	changed(from, to);
}
