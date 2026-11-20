import { chmod, mkdtemp, rm, utimes, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanTrash, entryName } from '@in-browser/files/trash.js';
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

	it.skipIf(process.getuid?.() === 0)('throws instead of reporting an unreadable folder as empty', async () => {
		await mkdir(join(root, 'locked'));
		await writeFile(join(root, 'locked', 'a.txt'), 'x');
		await chmod(join(root, 'locked'), 0o000);
		try {
			await expect(fsTree(root).scan()).rejects.toThrow();
			await expect(fsTree(root).names('/locked')).rejects.toThrow();
		} finally {
			await chmod(join(root, 'locked'), 0o700);
		}
		// A missing folder is just empty
		expect((await fsTree(join(root, 'missing')).scan()).size).toBe(0);
	});

	it('removes expired trash entries after the synced retention', async () => {
		const tree = fsTree(root);
		const old = entryName(Date.now() - 40 * 24 * 60 * 60 * 1000);
		const recent = entryName(Date.now());
		for (const entry of [old, recent]) await write(tree, `/.in-browser-trash/${entry}/docs/a.txt`, 'deleted');
		await cleanTrash(tree);
		expect(await tree.names('/.in-browser-trash')).toEqual([recent]);
		// The trash is synced like any other folder
		expect([...(await tree.scan()).keys()]).toContain(`/.in-browser-trash/${recent}/docs/a.txt`);
		await write(tree, '/.apps/files/settings.json', JSON.stringify({ trashDays: null }));
		await cleanTrash(tree, Date.now() + 1000 * 24 * 60 * 60 * 1000);
		expect(await tree.names('/.in-browser-trash')).toEqual([recent]);
	});
});
