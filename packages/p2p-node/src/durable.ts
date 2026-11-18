import { open } from 'node:fs/promises';

// Flushing writes to the disk (fsync) where Node allows it: inside the permission model (the sandbox the starter runs
// the sync process in) Node disables the fsync API, so there writes rely on the file system's own ordering.

let allowed: Promise<boolean> | undefined;

/** Whether fsync works in this process (probed once on `dir`, a folder it may read) */
export function canFlush(dir: string): Promise<boolean> {
	allowed ??= (async () => {
		const handle = await open(dir, 'r').catch(() => null);
		if (!handle) return false;
		try {
			await handle.sync();
			return true;
		} catch {
			return false;
		} finally {
			await handle.close();
		}
	})();
	return allowed;
}

/** Makes a rename in `dir` durable where possible (not on Windows, where it isn't needed) */
export async function syncDir(dir: string): Promise<void> {
	if (!(await canFlush(dir))) return;
	const handle = await open(dir, 'r').catch(() => null);
	await handle?.sync().catch(() => {});
	await handle?.close();
}
