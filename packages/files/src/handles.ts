// Small helpers on File System Access handles (OPFS and folders on disk alike)

type Movable<H extends FileSystemHandle = FileSystemHandle> = H & { move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> };

/** Folders on disk can be picked (File System Access API, Chromium): connecting and syncing a folder need it */
export const diskFoldersSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/**
 * Whether the browser lets this tab read and write a folder on disk: `prompt` until a click allows it again. An answer
 * missing after `wait` ms counts as `prompt` (seen in Chrome: the question never came back, and the folder sync stood
 * still without a word).
 */
export async function folderAccess(handle: FileSystemHandle, wait = 2000): Promise<PermissionState> {
	const answer = await folderAccessAnswer(handle, wait);
	return answer === 'silent' ? 'prompt' : answer;
}

/** Like `folderAccess`, but a browser that doesn't answer is told apart (`silent`): asking it for access hangs too */
export async function folderAccessAnswer(handle: FileSystemHandle, wait = 2000): Promise<PermissionState | 'silent'> {
	const query = (handle as FileSystemHandle & { queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState> }).queryPermission;
	if (!query) return 'granted';
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([query.call(handle, { mode: 'readwrite' }), new Promise<'silent'>((resolve) => (timer = setTimeout(() => resolve('silent'), wait)))]);
	} catch {
		return 'denied';
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Folders on disk whose stored handle the browser doesn't answer for (seen in Chrome, on a local disk: neither the
 * state nor the question for access ever came back, and while that question hangs the folder picker doesn't open
 * either). Asking for access then picks the folder anew. Kept for the tab's session (`files:stuck-access`), since the
 * way out of a hanging question is a reload. Keys: a connection's id, `sync` for the synced folder.
 */
const STUCK = 'files:stuck-access';
let stuck: Set<string> | null = null;

function stuckKeys(): Set<string> {
	if (stuck) return stuck;
	try {
		stuck = new Set(JSON.parse(sessionStorage.getItem(STUCK) ?? '[]') as string[]);
	} catch {
		stuck = new Set();
	}
	return stuck;
}

export const isStuck = (key: string) => stuckKeys().has(key);

export function setStuck(key: string, on: boolean) {
	const keys = stuckKeys();
	if (on) keys.add(key);
	else keys.delete(key);
	try {
		sessionStorage.setItem(STUCK, JSON.stringify([...keys]));
	} catch {
		// Only this page then
	}
}

/** The error of a handle that isn't there (or is a folder where a file was asked for, and the other way round) */
export const isMissing = (e: unknown) => e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');

/** File or folder `name` in `dir`, `null` if there is none */
export async function childHandle(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemHandle | null> {
	for (const get of [() => dir.getFileHandle(name), () => dir.getDirectoryHandle(name)]) {
		try {
			return await get();
		} catch (e) {
			if (!isMissing(e)) throw e;
		}
	}
	return null;
}

/** Moves `handle` natively into `dir` as `name`; `false` where the browser can't (the caller copies instead) */
export async function nativeMove(handle: FileSystemHandle, dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
	const movable = handle as Movable;
	if (!movable.move) return false;
	try {
		await movable.move(dir, name);
		return true;
	} catch (e) {
		if (!(e instanceof DOMException) && !(e instanceof TypeError)) throw e;
		return false;
	}
}

/** Folder below `root` (`names` from the root), created if `create` */
export async function dirAt(root: FileSystemDirectoryHandle, names: string[], create = false): Promise<FileSystemDirectoryHandle> {
	let dir = root;
	for (const name of names) dir = await dir.getDirectoryHandle(name, { create });
	return dir;
}

/**
 * Moves the file `name` of `from` to `to` as `newName`: natively where the browser can (keeps the date), otherwise
 * copied and then deleted – the source goes only once the copy is complete.
 */
export async function moveFile(from: FileSystemDirectoryHandle, name: string, to: FileSystemDirectoryHandle, newName: string): Promise<void> {
	const handle = await from.getFileHandle(name);
	if (await nativeMove(handle, to, newName)) return;
	const source = await handle.getFile();
	await source.stream().pipeTo(await (await to.getFileHandle(newName, { create: true })).createWritable());
	await from.removeEntry(name);
}

async function entry(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemHandle> {
	return dir.getFileHandle(name).catch(() => dir.getDirectoryHandle(name));
}

/** Copies a file or folder (with everything inside) into `to` as `name` */
export async function copyEntry(handle: FileSystemHandle, to: FileSystemDirectoryHandle, name: string): Promise<void> {
	if (handle.kind === 'file') {
		const source = await (handle as FileSystemFileHandle).getFile();
		await source.stream().pipeTo(await (await to.getFileHandle(name, { create: true })).createWritable());
		return;
	}
	const target = await to.getDirectoryHandle(name, { create: true });
	for await (const [child, childHandle] of (handle as FileSystemDirectoryHandle).entries()) await copyEntry(childHandle, target, child);
}

/**
 * Renames an entry inside its folder (also in upper/lower case only): natively where possible, otherwise through a
 * temporary name – a copy straight to a name differing only in case would land in the same entry on Windows/macOS.
 */
export async function renameEntry(dir: FileSystemDirectoryHandle, name: string, newName: string): Promise<void> {
	if (name === newName) return;
	const handle = await entry(dir, name);
	if (await nativeMove(handle, dir, newName)) return;
	const temp = `.moving-${crypto.randomUUID()}`;
	await copyEntry(handle, dir, temp);
	await dir.removeEntry(name, { recursive: true });
	await copyEntry(await entry(dir, temp), dir, newName);
	await dir.removeEntry(temp, { recursive: true });
}
