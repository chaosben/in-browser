// Private local data of a tool in the OPFS (`cache/<tool>/…`): caches and temporary files that are neither shown
// in Files nor synced (e.g. waveform caches, export files before the download).

/** Folder `cache/<tool>/<path…>`, created if missing */
export async function cacheDir(tool: string, ...path: string[]): Promise<FileSystemDirectoryHandle> {
	let handle = await (await navigator.storage.getDirectory()).getDirectoryHandle('cache', { create: true });
	for (const name of [tool, ...path]) handle = await handle.getDirectoryHandle(name, { create: true });
	return handle;
}

/** Asks the browser not to evict the storage automatically. */
export async function requestPersistence(): Promise<boolean> {
	if (!navigator.storage.persist) return false;
	return (await navigator.storage.persisted()) || navigator.storage.persist();
}

/** Used and available storage of the whole site */
export async function storageEstimate() {
	return navigator.storage.estimate();
}
