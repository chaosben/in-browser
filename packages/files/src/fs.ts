import { changed } from './changes.js';
import { FilesError, type Entry } from './entry.js';
import * as opfs from './opfs.js';
import { basename, join, nameKey, nameProblem, normalize, parent, segments } from './path.js';
import { fileAccess } from './sources/blocks.js';
import { excludedIn, sourceAt, type At } from './sources/registry.js';
import type { RandomAccess } from './sources/source.js';

// The shared file system as every tool uses it. A path lives in one of three places:
//   /:c/<id>/…            a connected folder (`sources/`, e.g. a folder on disk)
//   in a folder this device doesn't sync (the device sync's folder choice): opened live from another device
//   anything else         My files in the OPFS of this device (`opfs.ts`)
// Every function routes there, so tools work with all of them alike; the rules of My files (valid names, no clashes,
// no overwriting) hold everywhere. Changes are announced to every tab (`watch`).

export { FilesError, type Entry, type FilesErrorCode } from './entry.js';
export { changed, noticed, watch, watchSettled } from './changes.js';
export { supported } from './opfs.js';
export type { RandomAccess } from './sources/source.js';

/** Runs an action of a source; its errors name the full path */
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

/** Before creating `path`: valid name, no other entry that only differs in case (would clash on disk) */
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
	let inner = '/';
	for (const name of segments(base.inner)) {
		inner = join(inner, name);
		const here = { ...base, inner };
		const current = join(base.root, inner);
		const entry = await inSource(here, () => base.source.stat(inner));
		if (entry?.kind === 'directory') continue;
		if (entry) throw new FilesError('exists', current);
		await checkNewAt(here, current);
		await inSource(here, () => base.source.mkdir(inner));
		created = true;
	}
	return created;
}

/** Can `path` be changed where it lies? (Not in a guest share for viewing or another source only for reading) */
export async function canWrite(path: string): Promise<boolean> {
	const at = await sourceAt(normalize(path));
	return !at?.source.caps.readOnly;
}

// --- Reading ---

/** Entries of a folder (unsorted), including hidden ones; in My files also the folders opened from other devices */
export async function list(path: string): Promise<Entry[]> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (at) {
		const entries = await inSource(at, () => at.source.list(at.inner));
		return entries.map((entry) => ({ ...entry, path: join(at.root, entry.path), ...(at.key === 'devices' ? { remote: true } : {}) }));
	}
	const entries = await opfs.list(path);
	const remote = excludedIn(path);
	if (!remote.length) return entries;
	const local = entries.filter((entry) => !remote.includes(entry.path));
	return [...local, ...remote.map((folder): Entry => ({ name: basename(folder), path: folder, kind: 'directory', remote: true }))];
}

/** File or folder at `path`, `null` if there is none */
export async function stat(path: string): Promise<Entry | null> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (!at) return opfs.stat(path);
	const entry = await inSource(at, () => at.source.stat(at.inner));
	return entry && { ...entry, name: basename(path), path, ...(at.key === 'devices' ? { remote: true } : {}) };
}

export async function exists(path: string): Promise<boolean> {
	return (await stat(path)) !== null;
}

/** The whole file (remote sources fetch it completely; for media prefer `open`) */
export async function read(path: string): Promise<File> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (at) return inSource(at, () => at.source.read(at.inner));
	return opfs.read(path);
}

export async function readText(path: string): Promise<string> {
	return (await read(path)).text();
}

/** A file read in pieces – the same for every place; remote sources fetch only what is read */
export async function open(path: string): Promise<RandomAccess> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (at?.source.open) return inSource(at, () => at.source.open!(at.inner));
	return fileAccess(await read(path));
}

// --- Writing ---

/** Creates the folder and its parents (no error if it exists). */
export async function mkdir(path: string): Promise<void> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (!at) return opfs.mkdir(path);
	if (await mkdirAt(at, path)) changed(path);
}

/** Writes a whole file at once (creates parents; replaces the content only when complete). */
export async function write(path: string, data: Blob | BufferSource | string): Promise<void> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (!at) return opfs.write(path, data);
	await mkdir(parent(path));
	await navigator.locks.request(`files:${path}`, async () => {
		const writer = (await openAt(at, path)).getWriter();
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

async function openAt(at: At, path: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	writableAt(at, path);
	if (!basename(at.inner)) throw new FilesError('root', path);
	if (!(await exists(path))) await checkNewAt(at, path);
	return inSource(at, () => at.source.writable(at.inner));
}

/**
 * Opens a file for streaming (creates parents). Accepts the chunks of `FileSystemWritableFileStream`
 * (also `{ type: 'write', position, data }`, so it works with Mediabunny's `StreamTarget`); the content is replaced
 * when the stream is closed, which is also when the change is announced.
 */
export async function writable(path: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (!at) return opfs.writable(path);
	await mkdir(parent(path));
	const writer = (await openAt(at, path)).getWriter();
	return new WritableStream<FileSystemWriteChunkType>({
		write: (chunk) => writer.write(chunk),
		close: async () => {
			await writer.close();
			changed(path);
		},
		abort: (reason) => writer.abort(reason)
	});
}

/** Deletes a file or a folder with everything in it for good (no error if it does not exist). */
export async function remove(path: string): Promise<void> {
	path = normalize(path);
	const at = await sourceAt(path);
	if (!at) return opfs.remove(path);
	if (at.inner === '/' || !basename(path)) throw new FilesError('root', path);
	writableAt(at, path);
	await inSource(at, () => at.source.remove(at.inner));
	changed(path);
}

/** The place a path lives in (for moves: same place = native move) */
async function placeKey(path: string): Promise<string> {
	return (await sourceAt(path))?.key ?? 'local';
}

/** Copies a file or folder to `to` (must not exist yet). */
export async function copy(from: string, to: string): Promise<void> {
	from = normalize(from);
	to = normalize(to);
	if (to === from || to.startsWith(from + '/')) throw new FilesError('intoItself', to);
	if ((await placeKey(from)) === 'local' && (await placeKey(to)) === 'local') return opfs.copy(from, to);
	const entry = await stat(from);
	if (!entry) throw new FilesError('notFound', from);
	if (await exists(to)) throw new FilesError('exists', to);
	await copyAcross(entry, to);
	changed(to);
}

/** Copies between places through the path functions, file by file as streams */
async function copyAcross(entry: Entry, to: string): Promise<void> {
	if (entry.kind === 'file') {
		await (await read(entry.path)).stream().pipeTo(await writable(to));
		return;
	}
	await mkdir(to);
	for (const child of await list(entry.path)) await copyAcross(child, join(to, child.name));
}

/** Moves or renames a file or folder to `to` (must not exist yet, except for a change in case only). */
export async function move(from: string, to: string): Promise<void> {
	from = normalize(from);
	to = normalize(to);
	if (to === from) return;
	if (to.startsWith(from + '/')) throw new FilesError('intoItself', to);
	const fromKey = await placeKey(from);
	const toKey = await placeKey(to);
	if (fromKey === 'local' && toKey === 'local') return opfs.move(from, to);
	if (fromKey === toKey) await moveInSource(from, to);
	else {
		// Between places: copy, then delete the original once the copy is complete
		const entry = await stat(from);
		if (!entry || !basename(from)) throw new FilesError(basename(from) ? 'notFound' : 'root', from);
		if (await exists(to)) throw new FilesError('exists', to);
		await copyAcross(entry, to);
		await remove(from);
	}
	changed(from, to);
}

/** Moves inside one place that isn't My files */
async function moveInSource(from: string, to: string): Promise<void> {
	const source = (await sourceAt(from))!;
	const target = (await sourceAt(to))!;
	if (source.inner === '/' || !basename(from)) throw new FilesError('root', from);
	writableAt(source, from);
	if (!(await stat(from))) throw new FilesError('notFound', from);
	const caseOnly = parent(from) === parent(to) && nameKey(basename(from)) === nameKey(basename(to));
	if (!caseOnly && (await exists(to))) throw new FilesError('exists', to);
	if (nameProblem(basename(to))) throw new FilesError('invalidName', to);
	await mkdir(parent(to));
	if (!caseOnly) await checkNewAt(target, to);
	await inSource(source, () => source.source.move(source.inner, target.inner));
}

/** The source of a path that moves deleted items into its own trash (another device), `null` otherwise */
export async function trashOf(path: string): Promise<{ trash: (path: string) => Promise<{ entry: string; path: string }>; untrash: (ref: { entry: string; path: string }) => Promise<void> } | null> {
	const at = await sourceAt(normalize(path));
	if (!at?.source.caps.trash || !at.source.trash || !at.source.untrash) return null;
	const { source } = at;
	return {
		trash: async (p) => {
			const ref = await inSource(at, () => source.trash!(normalize(p)));
			changed(p);
			return ref;
		},
		untrash: async (ref) => {
			await inSource(at, () => source.untrash!(ref));
			changed(ref.path);
		}
	};
}
