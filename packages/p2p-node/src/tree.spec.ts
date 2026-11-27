import { chmod, mkdtemp, rm, utimes, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanTrash, entryName } from '@in-browser/files/trash.js';
import { listVersions, versionDataPath } from '@in-browser/files/sync/versions.js';
import { realPath } from './real-path.js';
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
	it('keeps what the sync takes away as an earlier version outside the synced folder', async () => {
		const versions = join(root, 'versions');
		const tree = fsTree(join(root, 'folder'), { versions });
		await write(tree, '/docs/a.txt', 'old');
		await tree.keep!('/docs/a.txt', 'replaced');
		expect(await tree.stat('/docs/a.txt')).toBeNull();
		const store = fsTree(versions);
		const [version] = await listVersions(store);
		expect(version).toMatchObject({ path: '/docs/a.txt', reason: 'replaced', size: 3 });
		expect(await (await store.read(versionDataPath(version.entry))).text()).toBe('old');
	});

	it('never leaves the folder, whatever another device asks for', async () => {
		// Windows splits at `\\` too and reads drives and streams; names of the sync never hold any of them
		expect(realPath(win32, 'C:\\sync', ['docs', 'a.txt'])).toBe('C:\\sync\\docs\\a.txt');
		for (const name of ['..\\..\\keys\\identity.json', 'D:', 'a.txt:stream', '..', 'a/b', 'a\0']) expect(() => realPath(win32, 'C:\\sync', ['docs', name]), name).toThrow();
		expect(() => realPath(posix, '/sync', ['docs', '..\\x'])).toThrow();
		// A link in the folder that leads out of it is not followed – neither read nor written through
		const folder = join(root, 'folder');
		await mkdir(join(root, 'outside'));
		await writeFile(join(root, 'outside', 'secret.txt'), 'secret');
		await mkdir(folder);
		await symlink(join(root, 'outside'), join(folder, 'out'));
		await symlink(join(root, 'outside', 'new.txt'), join(folder, 'nowhere.txt'));
		const tree = fsTree(folder);
		await expect(tree.read('/out/secret.txt')).rejects.toThrow();
		await expect(tree.remove('/out/secret.txt')).rejects.toThrow();
		await expect(tree.write('/out/planted.txt')).rejects.toThrow();
		await expect(tree.write('/nowhere.txt')).rejects.toThrow();
		expect(await (await fsTree(root).read('/outside/secret.txt')).text()).toBe('secret');
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
		for (const entry of [old, recent]) {
			await write(tree, `/.in-browser-trash/${entry}/docs/a.txt`, 'deleted');
			await write(tree, `/.in-browser-trash/${entry}/.trashinfo.json`, '{}');
		}
		// An entry counts from when this device got it (its info file's time), not from its name alone
		const then = Date.now() / 1000 - 40 * 24 * 60 * 60;
		await utimes(join(root, '.in-browser-trash', old, '.trashinfo.json'), then, then);
		await cleanTrash(tree);
		expect(await tree.names('/.in-browser-trash')).toEqual([recent]);
		// The trash is synced like any other folder
		expect([...(await tree.scan()).keys()]).toContain(`/.in-browser-trash/${recent}/docs/a.txt`);
		await write(tree, '/.apps/files/settings.json', JSON.stringify({ trashDays: null }));
		await cleanTrash(tree, Date.now() + 1000 * 24 * 60 * 60 * 1000);
		expect(await tree.names('/.in-browser-trash')).toEqual([recent]);
	});
});
