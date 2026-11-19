import { FilesError, type Entry } from './entry.js';
import { basename, connectionOf, join, nameKey, nameProblem, normalize, parent, segments } from './path.js';
import { sourceAt } from './sources/registry.js';
import type { Source } from './sources/source.js';

// The shared file system of all tools, stored in the Origin Private File System (OPFS):
//   files/…          root `/` of the file system (“My files”): visible in Files and mirrored into a real folder (sync)
//   cache/<tool>/…   private local data of a tool (see cache.ts), neither shown nor synced
// Data a tool wants to carry along to other computers belongs under `/.apps/<tool>/` (hidden, but synced).
// Paths under `/:c/<id>` belong to connected sources (`sources/`, e.g. a folder on disk): every function routes them
// there, so tools work with them like with any other path. Changes are announced to every tab (`watch`).

export { FilesError, type Entry, type FilesErrorCode } from './entry.js';

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

/** Announces changes this tab noticed on its own (each tab watches connected folders itself) */
export function noticed(...paths: string[]) {
	listeners.forEach((l) => l(paths));
}

/** Calls `listener` with the paths of every change (also from other tabs); returns the unsubscribe function. */
export function watch(listener: Listener): () => void {
	ensureChannel();
	listeners.add(listener);
	return () => listeners.delete(listener);
}

// --- Connected sources ---

interface At {
	source: Source;
	root: string;
	inner: string;
}

/** Runs an action of a source; its errors name the full path (`denied`: the connection) */
async function inSource<T>(at: At, action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (e) {
		if (e instanceof FilesError) throw new FilesError(e.code, join(at.root, e.path));
		throw e;
	}
}

function writableAt(at: At, path: string) {
	if (at.source.caps.readOnly) throw new FilesError('readOnly', path);
}

/** The same checks as `checkNew` for a source */
async function checkNewAt(at: At, path: string) {
	const name = basename(path);
	if (nameProblem(name)) throw new FilesError('invalidName', path);
	const key = nameKey(name);
	const siblings = await inSource(at, () => at.source.list(parent(at.inner)));
	if (siblings.some((other) => other.name !== name && nameKey(other.name) === key)) throw new FilesError('collision', path);
}

async function mkdirAt(base: At, path: string): Promise<boolean> {
	writableAt(base, path);
	let created = false;
	let current = base.root;
	let inner = '/';
	for (const name of segments(base.inner)) {
		current = join(current, name);
		inner = join(inner, name);
		const here = { ...base, inner };
		const entry = await inSource(here, () => base.source.stat(inner));
		if (entry?.kind === 'directory') continue;
		if (entry) throw new FilesError('exists', current);
		await checkNewAt(here, current);
		await inSource(here, () => base.source.mkdir(inner));
		created = true;
	}
	return created;
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
	const source = await sourceAt(path);
	if (source) {
		const entries = await inSource(source, () => source.source.list(source.inner));
		return entries.map((entry) => ({ ...entry, path: join(source.root, entry.path) }));
	}
	const dir = await dirHandle(path);
	const entries: Promise<Entry>[] = [];
	for await (const [name, handle] of dir.entries()) entries.push(entryOf(path === '/' ? `/${name}` : `${path}/${name}`, handle));
	return Promise.all(entries);
}

/** File or folder at `path`, `null` if there is none */
export async function stat(path: string): Promise<Entry | null> {
	path = normalize(path);
	const source = await sourceAt(path);
	if (source) {
		const entry = await inSource(source, () => source.source.stat(source.inner));
		return entry && { ...entry, name: basename(path), path };
	}
	const handle = await anyHandle(path);
	return handle && entryOf(path, handle);
}

export async function exists(path: string): Promise<boolean> {
	path = normalize(path);
	if (connectionOf(path)) return (await stat(path)) !== null;
	return (await anyHandle(path)) !== null;
}

export async function read(path: string): Promise<File> {
	path = normalize(path);
	const source = await sourceAt(path);
	if (source) return inSource(source, () => source.source.read(source.inner));
	return (await fileHandle(path)).getFile();
}

export async function readText(path: string): Promise<string> {
	return (await read(path)).text();
}

// --- Writing ---

/** Creates the folder and its parents (no error if it exists). */
export async function mkdir(path: string): Promise<void> {
	path = normalize(path);
	const source = await sourceAt(path);
	if (source) {
		if (await mkdirAt(source, path)) changed(path);
		return;
	}
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
		const stream = await openWritable(path);
		const writer = stream.getWriter();
		try {
			await writer.write(data);
			await writer.close();
		} catch (e) {
			await writer.abort(e).catch(() => {});
			throw e;
		}
	});
	changed(path);
}

/** A writable for `path` (its parent exists); the content is replaced when it closes */
async function openWritable(path: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	const source = await sourceAt(path);
	if (source) {
		writableAt(source, path);
		if (!basename(source.inner)) throw new FilesError('root', path);
		if (!(await exists(path))) await checkNewAt(source, path);
		return inSource(source, () => source.source.writable(source.inner));
	}
	if (!(await exists(path))) await checkNew(await dirHandle(parent(path)), path);
	return (await fileHandle(path, true)).createWritable();
}

/**
 * Opens a file for streaming (creates parents). Accepts the chunks of `FileSystemWritableFileStream`
 * (also `{ type: 'write', position, data }`, so it works with Mediabunny's `StreamTarget`); the content is replaced
 * when the stream is closed, which is also when the change is announced.
 */
export async function writable(path: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	path = normalize(path);
	await mkdir(parent(path));
	const writer = (await openWritable(path)).getWriter();
	return new WritableStream<FileSystemWriteChunkType>({
		write: (chunk) => writer.write(chunk),
		close: async () => {
			await writer.close();
			changed(path);
		},
		abort: (reason) => writer.abort(reason)
	});
}

/** Deletes a file or a folder with everything in it (no error if it does not exist). */
export async function remove(path: string): Promise<void> {
	path = normalize(path);
	const name = basename(path);
	const source = await sourceAt(path);
	if (source) {
		if (source.inner === '/') throw new FilesError('root', path);
		writableAt(source, path);
		await inSource(source, () => source.source.remove(source.inner));
		changed(path);
		return;
	}
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
	if (connectionOf(from) || connectionOf(to)) {
		const entry = await stat(from);
		if (!entry) throw new FilesError('notFound', from);
		if (await exists(to)) throw new FilesError('exists', to);
		await copyAcross(entry, to);
		changed(to);
		return;
	}
	const source = await anyHandle(from);
	if (!source) throw new FilesError('notFound', from);
	if (await exists(to)) throw new FilesError('exists', to);
	await copyHandle(source, to);
	changed(to);
}

/** Copies between places (My files and connected sources) through the path functions, file by file as streams */
async function copyAcross(entry: Entry, to: string): Promise<void> {
	if (entry.kind === 'file') {
		await (await read(entry.path)).stream().pipeTo(await writable(to));
		return;
	}
	await mkdir(to);
	for (const child of await list(entry.path)) await copyAcross(child, join(to, child.name));
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
	const fromAt = connectionOf(from);
	const toAt = connectionOf(to);
	if (fromAt || toAt) {
		if (fromAt?.id === toAt?.id) await moveInSource(from, to);
		else {
			// Between places: copy, then delete the original once the copy is complete
			const entry = await stat(from);
			if (!entry || !basename(from)) throw new FilesError(basename(from) ? 'notFound' : 'root', from);
			if (await exists(to)) throw new FilesError('exists', to);
			await copyAcross(entry, to);
			await remove(from);
		}
		changed(from, to);
		return;
	}
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
		await moveHandle(source, target);
		await remove(from);
		if (caseOnly) await move(target, to);
	}
	changed(from, to);
}

/** Moves inside one connected source */
async function moveInSource(from: string, to: string): Promise<void> {
	const source = (await sourceAt(from))!;
	const target = (await sourceAt(to))!;
	if (source.inner === '/') throw new FilesError('root', from);
	writableAt(source, from);
	if (!(await stat(from))) throw new FilesError('notFound', from);
	const caseOnly = parent(from) === parent(to) && nameKey(basename(from)) === nameKey(basename(to));
	if (!caseOnly && (await exists(to))) throw new FilesError('exists', to);
	if (nameProblem(basename(to))) throw new FilesError('invalidName', to);
	await mkdir(parent(to));
	if (!caseOnly) await checkNewAt(target, to);
	await inSource(source, () => source.source.move(source.inner, target.inner));
}

/**
 * Moves file by file where folders can't be moved natively (Chromium): files move natively (fast, no copy), only
 * what can't is copied. The source folders are removed by the caller once empty.
 */
async function moveHandle(source: FileSystemHandle, to: string): Promise<void> {
	if (source.kind === 'file') {
		const native = (source as FileSystemHandle & { move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> }).move;
		if (native) {
			try {
				await native.call(source, await dirHandle(parent(to), true), basename(to));
				return;
			} catch (e) {
				if (!(e instanceof DOMException) && !(e instanceof TypeError)) throw e;
			}
		}
		await copyHandle(source, to);
		return;
	}
	await mkdir(to);
	const children: [string, FileSystemHandle][] = [];
	for await (const entry of (source as FileSystemDirectoryHandle).entries()) children.push(entry);
	for (const [name, child] of children) await moveHandle(child, `${to}/${name}`);
}
