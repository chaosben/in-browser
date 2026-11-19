import { readFile, rename, writeFile } from 'node:fs/promises';

// Small files of the p2p-node (configuration, state, the record of updates). Node builtins only: the starter uses it.

/** The parsed file; `undefined` if it is missing – or, unless `strict`, unreadable (`strict` throws then) */
export async function readJson<T>(file: string, strict = false): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(file, 'utf8')) as T;
	} catch (e) {
		if (!strict || (e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw e;
	}
}

/** Written to a temporary file first and renamed, so a crash never leaves half a file (mode 0600) */
export async function writeAtomic(file: string, data: string | Uint8Array) {
	const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
	await writeFile(temp, data, { mode: 0o600 });
	await rename(temp, file);
}
