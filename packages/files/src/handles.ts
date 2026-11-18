// Small helpers on File System Access handles (OPFS and folders on disk alike)

type Movable<H extends FileSystemHandle = FileSystemHandle> = H & { move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> };

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
	const handle = (await from.getFileHandle(name)) as Movable<FileSystemFileHandle>;
	if (handle.move) {
		try {
			await handle.move(to, newName);
			return;
		} catch (e) {
			if (!(e instanceof DOMException) && !(e instanceof TypeError)) throw e;
		}
	}
	const source = await handle.getFile();
	await source.stream().pipeTo(await (await to.getFileHandle(newName, { create: true })).createWritable());
	await from.removeEntry(name);
}

async function entry(dir: FileSystemDirectoryHandle, name: string): Promise<Movable> {
	return dir.getFileHandle(name).catch(() => dir.getDirectoryHandle(name));
}

/** Copies a file or folder (with everything inside) into `to` as `name` */
async function copyEntry(handle: FileSystemHandle, to: FileSystemDirectoryHandle, name: string): Promise<void> {
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
	if (handle.move) {
		try {
			await handle.move(dir, newName);
			return;
		} catch (e) {
			if (!(e instanceof DOMException) && !(e instanceof TypeError)) throw e;
		}
	}
	const temp = `.moving-${crypto.randomUUID()}`;
	await copyEntry(handle, dir, temp);
	await dir.removeEntry(name, { recursive: true });
	await copyEntry(await entry(dir, temp), dir, newName);
	await dir.removeEntry(temp, { recursive: true });
}
