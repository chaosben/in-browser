import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilesError, copy, exists, list, mkdir, move, readText, remove, stat, watch, write } from '../fs.js';
import { connectionRoot } from '../path.js';
import { displayName, displayPath, saveConnections } from './registry.js';

// fs.ts routing paths under `/:c/<id>` to a connected folder. The “folder on disk” is a folder in the OPFS of headless
// Chromium (the same API as `showDirectoryPicker()` hands out).

const ROOT = connectionRoot('t1');
let disk: FileSystemDirectoryHandle;

async function diskNames(dir: FileSystemDirectoryHandle = disk): Promise<string[]> {
	const names: string[] = [];
	for await (const name of dir.keys()) names.push(name);
	return names.sort();
}

beforeEach(async () => {
	const opfs = await navigator.storage.getDirectory();
	await opfs.removeEntry('disk', { recursive: true }).catch(() => {});
	disk = await opfs.getDirectoryHandle('disk', { create: true });
	await saveConnections([{ id: 't1', kind: 'folder', name: 'Projects', handle: disk }]);
});

afterEach(async () => {
	await saveConnections([]);
	for (const entry of await list('/')) await remove(entry.path);
});

describe('a connected folder through fs.ts', () => {
	it('writes, lists and reads in place, nothing in My files', async () => {
		await write(`${ROOT}/Docs/a.txt`, 'hello');
		expect(await diskNames()).toEqual(['Docs']);
		expect((await list(`${ROOT}/Docs`)).map((e) => [e.path, e.kind, e.size])).toEqual([[`${ROOT}/Docs/a.txt`, 'file', 5]]);
		expect(await readText(`${ROOT}/Docs/a.txt`)).toBe('hello');
		expect((await stat(ROOT))?.kind).toBe('directory');
		expect(await list('/')).toEqual([]);
	});

	it('moves and renames inside, also in upper/lower case only', async () => {
		await write(`${ROOT}/a.txt`, 'x');
		await mkdir(`${ROOT}/Sub`);
		await move(`${ROOT}/a.txt`, `${ROOT}/Sub/b.txt`);
		expect(await exists(`${ROOT}/a.txt`)).toBe(false);
		await move(`${ROOT}/Sub/b.txt`, `${ROOT}/Sub/B.txt`);
		expect(await diskNames(await disk.getDirectoryHandle('Sub'))).toEqual(['B.txt']);
		await move(`${ROOT}/Sub`, `${ROOT}/Moved`);
		expect(await diskNames()).toEqual(['Moved']);
	});

	it('copies and moves between My files and the folder', async () => {
		await write('/Notes/n.txt', 'mine');
		await copy('/Notes', `${ROOT}/Notes`);
		expect(await readText(`${ROOT}/Notes/n.txt`)).toBe('mine');
		await move(`${ROOT}/Notes/n.txt`, '/back.txt');
		expect(await readText('/back.txt')).toBe('mine');
		expect(await exists(`${ROOT}/Notes/n.txt`)).toBe(false);
	});

	it('keeps the rules of My files: no clashes, no overwriting, not the root', async () => {
		await write(`${ROOT}/a.txt`, 'x');
		await expect(mkdir(`${ROOT}/A.TXT`)).rejects.toMatchObject({ code: 'collision' });
		await expect(write(`${ROOT}/A.txt`, 'y')).rejects.toMatchObject({ code: 'collision' });
		await write(`${ROOT}/b.txt`, 'y');
		await expect(move(`${ROOT}/b.txt`, `${ROOT}/a.txt`)).rejects.toMatchObject({ code: 'exists' });
		await expect(remove(ROOT)).rejects.toMatchObject({ code: 'root' });
		await expect(readText(`${ROOT}/missing.txt`)).rejects.toBeInstanceOf(FilesError);
	});

	it('deletes in place and announces changes', async () => {
		const seen: string[] = [];
		const stop = watch((paths) => seen.push(...paths));
		await write(`${ROOT}/c.txt`, 'x');
		await remove(`${ROOT}/c.txt`);
		stop();
		expect(seen).toContain(`${ROOT}/c.txt`);
		expect(await diskNames()).toEqual([]);
	});

	it('names the connection instead of its id', async () => {
		await list(ROOT);
		expect(displayName(ROOT)).toBe('Projects');
		expect(displayPath(`${ROOT}/Docs`, 'My files')).toBe('Projects/Docs');
		expect(displayPath('/', 'My files')).toBe('My files');
	});

	it('unknown connections don’t exist', async () => {
		await expect(list(connectionRoot('gone'))).rejects.toMatchObject({ code: 'notFound' });
	});
});
