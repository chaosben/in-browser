// Private local data of a tool in the OPFS (`cache/<tool>/…`): caches and temporary files that are neither shown
// in Files nor synced (e.g. waveform caches, export files before the download).

/** Folder `cache/<tool>/<path…>`, created if missing */
export async function cacheDir(tool: string, ...path: string[]): Promise<FileSystemDirectoryHandle> {
	let handle = await (await navigator.storage.getDirectory()).getDirectoryHandle('cache', { create: true });
	for (const name of [tool, ...path]) handle = await handle.getDirectoryHandle(name, { create: true });
	return handle;
}

/**
 * Asks the browser not to evict the storage automatically. My files are the user's only copy until they sync, so
 * the first write asks (`opfs.ts`); the answer is the browser's (Firefox asks the user, the others decide alone).
 */
export async function requestPersistence(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
	return (await navigator.storage.persisted()) || navigator.storage.persist();
}

/** Whether the browser promised to keep the storage (`false` also where it can't say) */
export async function storagePersisted(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false;
	return navigator.storage.persisted();
}

/** Used and available storage of the whole site */
export async function storageEstimate() {
	return navigator.storage.estimate();
}
