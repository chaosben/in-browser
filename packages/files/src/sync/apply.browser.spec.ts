import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { folderTree, readText, writeText } from '../p2p/testing.js';
import { runSync, type SyncOptions } from './apply.js';
import { treeSide } from './tree-ops.js';
import type { Base } from './plan.js';
import type { Tree } from './tree.js';

// Carrying out plans between two trees in this page – the way the folder sync works (browser ↔ folder on disk)

let mine: Awaited<ReturnType<typeof folderTree>>;
let disk: Awaited<ReturnType<typeof folderTree>>;
let base: Base;

beforeEach(async () => {
	[mine, disk] = await Promise.all([folderTree('apply-mine'), folderTree('apply-disk')]);
	base = new Map();
});
afterEach(() => Promise.all([mine.clear(), disk.clear()]));

const options = (extra: Partial<SyncOptions> = {}): SyncOptions => ({
	base,
	saveBase: async (next) => void (base = next),
	conflictLabel: (side) => `conflict ${side === 'mine' ? 'browser' : 'folder'}`,
	hold: ['deleteLocal'],
	...extra
});
const sync = async (extra?: Partial<SyncOptions>) => runSync(mine, treeSide(disk), await mine.scan(), await disk.scan(), options(extra));
const paths = async (tree: Tree) => [...(await tree.scan()).keys()].sort();
const later = () => new Promise((r) => setTimeout(r, 20));

describe('runSync between two trees', () => {
	it('keeps the losing version of a change on both sides as a conflict copy', async () => {
		await writeText(mine, '/n.md', 'base');
		await sync();
		await writeText(disk, '/n.md', 'older change in the folder');
		await later();
		await writeText(mine, '/n.md', 'newer change in the browser');
		const result = await sync();
		expect(result.conflicts).toEqual(['/n.md']);
		expect(await readText(disk, '/n.md')).toBe('newer change in the browser');
		expect(await readText(disk, '/n (conflict folder).md')).toBe('older change in the folder');
	});

	it('keeps the losing version of a package as a whole package, once – never as files inside it', async () => {
		for (const name of ['project.json', 'pages/1.json', 'pages/2.json', 'media/big.bin']) await writeText(mine, `/Trip.screencapture/${name}`, 'base');
		await sync();
		for (const name of ['project.json', 'pages/1.json']) await writeText(disk, `/Trip.screencapture/${name}`, 'older, in the folder');
		await later();
		for (const name of ['project.json', 'pages/1.json']) await writeText(mine, `/Trip.screencapture/${name}`, 'newer, in the browser');
		await writeText(disk, '/Trip.screencapture/pages/3.json', 'only in the folder');
		const result = await sync();
		expect(result.conflicts).toEqual(['/Trip.screencapture']);
		const copy = '/Trip (conflict folder).screencapture';
		expect((await paths(disk)).filter((path) => path.includes('conflict'))).toEqual(
			[copy, ...['media', 'media/big.bin', 'pages', 'pages/1.json', 'pages/2.json', 'pages/3.json', 'project.json'].map((name) => `${copy}/${name}`)].sort()
		);
		expect(await readText(disk, `${copy}/pages/1.json`)).toBe('older, in the folder');
		expect(await readText(disk, `${copy}/project.json`)).toBe('older, in the folder');
		expect(await readText(disk, '/Trip.screencapture/project.json')).toBe('newer, in the browser');
	});

	it('makes no copy when both sides got the same content', async () => {
		await writeText(mine, '/n.md', 'base');
		await sync();
		await writeText(disk, '/n.md', 'same');
		await later();
		await writeText(mine, '/n.md', 'same');
		const result = await sync();
		expect(result.conflicts).toEqual([]);
		expect(await paths(disk)).toEqual(['/n.md']);
	});

	it('leaves alone what changed since the plan, and plans it again next time', async () => {
		await writeText(mine, '/a.txt', 'v1');
		await writeText(mine, '/b.txt', 'keep me');
		await sync();
		await writeText(disk, '/a.txt', 'v2 from the folder');
		await disk.remove('/b.txt');
		const [local, remote] = [await mine.scan(), await disk.scan()];
		// Meanwhile the user saves both files in the browser
		await later();
		await writeText(mine, '/a.txt', 'typed meanwhile');
		await writeText(mine, '/b.txt', 'edited meanwhile');
		const result = await runSync(mine, treeSide(disk), local, remote, options());
		expect(result.skipped).toBe(2);
		expect(await readText(mine, '/a.txt')).toBe('typed meanwhile');
		expect(await readText(mine, '/b.txt')).toBe('edited meanwhile');
		// The next run sees both changes: the newer one wins, the other is kept; the edit beats the deletion
		const next = await sync();
		expect(next.conflicts).toEqual(['/a.txt']);
		expect(await readText(disk, '/a.txt')).toBe('typed meanwhile');
		expect(await readText(disk, '/a (conflict folder).txt')).toBe('v2 from the folder');
		expect(await readText(disk, '/b.txt')).toBe('edited meanwhile');
	});

	it('does not overwrite the other side when it changed since the plan', async () => {
		await writeText(mine, '/a.txt', 'v1');
		await sync();
		await writeText(mine, '/a.txt', 'v2 from the browser');
		const [local, remote] = [await mine.scan(), await disk.scan()];
		await writeText(disk, '/a.txt', 'saved in the folder meanwhile');
		const result = await runSync(mine, treeSide(disk), local, remote, options());
		expect(result.skipped).toBe(1);
		expect(await readText(disk, '/a.txt')).toBe('saved in the folder meanwhile');
		expect(await disk.names('/')).toEqual(['a.txt']);
	});

	it('skips files removed on either side since the plan (e.g. the trash emptied meanwhile), without an error', async () => {
		await writeText(mine, '/.in-browser-trash/e1/.trashinfo.json', '{}');
		await writeText(disk, '/from-disk.txt', 'there');
		const [local, remote] = [await mine.scan(), await disk.scan()];
		await mine.remove('/.in-browser-trash/e1');
		await disk.remove('/from-disk.txt');
		const result = await runSync(mine, treeSide(disk), local, remote, options());
		expect(result.failed).toBe(0);
		expect(result.skipped).toBe(2);
		expect(await disk.stat('/.in-browser-trash/e1/.trashinfo.json')).toBeNull();
		expect(await mine.stat('/from-disk.txt')).toBeNull();
	});

	it('renames folders in upper/lower case with everything inside', async () => {
		await writeText(disk, '/Docs/a.txt', 'a');
		await writeText(disk, '/Docs/sub/b.txt', 'b');
		await sync();
		await disk.move('/Docs', '/docs');
		const result = await sync();
		expect(result.failed).toBe(0);
		expect(await paths(mine)).toEqual(['/docs', '/docs/a.txt', '/docs/sub', '/docs/sub/b.txt']);
		// Where the browser can't rename folders it copies them (new dates): a later run settles that without losses
		await sync();
		expect((await sync()).applied).toBe(0);
		expect(await readText(mine, '/docs/sub/b.txt')).toBe('b');
		expect(await paths(disk)).toEqual(['/docs', '/docs/a.txt', '/docs/sub', '/docs/sub/b.txt']);
	});

	it('holds many deletions from the folder for confirmation', async () => {
		for (let i = 0; i < 25; i++) await writeText(mine, `/f${i}.txt`, `${i}`);
		await sync();
		for (let i = 0; i < 25; i++) await disk.remove(`/f${i}.txt`);
		await writeText(disk, '/keep.txt', 'x');
		const held = await sync();
		expect(held.pendingDeletes).toBe(25);
		expect(held.held).toHaveLength(25);
		expect((await paths(mine)).length).toBe(26);
	});
});
