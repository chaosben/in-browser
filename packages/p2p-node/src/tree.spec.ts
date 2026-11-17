import { mkdtemp, readFile, rm, utimes, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fsTree } from './tree.js';

let root: string;
beforeEach(async () => (root = await mkdtemp(join(tmpdir(), 'p2p-node-tree-'))));
afterEach(() => rm(root, { recursive: true, force: true }));

async function write(tree: ReturnType<typeof fsTree>, path: string, text: string) {
	const writer = (await tree.write(path)).getWriter();
	await writer.write(new TextEncoder().encode(text));
	await writer.close();
}

describe('fsTree', () => {
	it('writes, reads and stats files below its folder, creating missing folders', async () => {
		const tree = fsTree(root);
		await write(tree, '/a/b/Notes.md', 'hello');
		expect(await readFile(join(root, 'a', 'b', 'Notes.md'), 'utf8')).toBe('hello');
		const file = await tree.read('/a/b/Notes.md');
		expect(await file.text()).toBe('hello');
		expect(file.name).toBe('Notes.md');
		const state = await tree.stat('/a/b/Notes.md');
		expect(state).toEqual({ kind: 'file', size: 5, modified: file.lastModified });
		expect(Number.isInteger(state!.modified)).toBe(true);
		expect(await tree.stat('/a')).toEqual({ kind: 'directory', size: 0, modified: 0 });
		expect(await tree.stat('/missing')).toBeNull();
	});

	it('scans files and folders, skipping ignored and special entries', async () => {
		await mkdir(join(root, 'docs'));
		await writeFile(join(root, 'docs', 'a.txt'), 'x');
		await writeFile(join(root, 'docs', '.p2p-1234.part'), 'half');
		await symlink(join(root, 'docs', 'a.txt'), join(root, 'link.txt'));
		await utimes(join(root, 'docs', 'a.txt'), 1000, 1_700_000_000.5);
		const snapshot = await fsTree(root).scan();
		expect([...snapshot.keys()].sort()).toEqual(['/docs', '/docs/a.txt']);
		expect(snapshot.get('/docs/a.txt')).toEqual({ kind: 'file', size: 1, modified: 1_700_000_000_500 });
	});

	it('moves, lists and removes', async () => {
		const tree = fsTree(root);
		await write(tree, '/a.txt', '1');
		await tree.move('/a.txt', '/sub/b.txt');
		expect(await tree.names('/sub')).toEqual(['b.txt']);
		expect(await tree.names('/nothing')).toEqual([]);
		await tree.remove('/sub');
		expect(await tree.stat('/sub')).toBeNull();
		await tree.mkdir('/x/y');
		expect(await tree.stat('/x/y')).toEqual({ kind: 'directory', size: 0, modified: 0 });
	});
});
