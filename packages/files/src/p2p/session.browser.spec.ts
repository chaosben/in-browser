import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Base } from '../sync/plan.js';
import { Rpc } from './rpc.js';
import { drive, Gate, serve, type DriveOptions, type Tree } from './session.js';
import { folderTree, linkedPair, readText, until, writeText } from './testing.js';

// Two devices with their own OPFS folder, connected by a real WebRTC data channel

let a: Awaited<ReturnType<typeof folderTree>>;
let b: Awaited<ReturnType<typeof folderTree>>;
let rpcA: Rpc;
let rpcB: Rpc;
let base: Base;

beforeEach(async () => {
	[a, b] = await Promise.all([folderTree('test-a'), folderTree('test-b')]);
	const [linkA, linkB] = await linkedPair();
	rpcA = new Rpc(linkA);
	rpcB = new Rpc(linkB);
	serve(rpcB, { tree: b, gate: new Gate() });
	base = new Map();
});

afterEach(async () => {
	rpcA.close();
	await Promise.all([a.clear(), b.clear()]);
});

const options = (extra: Partial<DriveOptions> = {}): DriveOptions => ({
	tree: a,
	gate: new Gate(),
	scope: { mine: [], theirs: [] },
	base,
	saveBase: async (next) => void (base = next),
	conflictLabel: (side) => `conflict ${side === 'mine' ? 'A' : 'B'}`,
	...extra
});

const sync = (extra?: Partial<DriveOptions>) => drive(rpcA, options(extra));
const paths = async (tree: Tree) => [...(await tree.scan()).keys()].sort();

describe('P2P session', { timeout: 30_000 }, () => {
	it('copies files and folders in both directions, large files in chunks', async () => {
		await writeText(a, '/Docs/a.txt', 'from A');
		await b.mkdir('/Empty');
		await writeText(b, '/b.txt', 'from B');
		const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
		const writer = (await a.write('/big.bin')).getWriter();
		await writer.write(big);
		await writer.close();
		const result = await sync();
		expect(result.failed).toBe(0);
		expect(await paths(a)).toEqual(['/Docs', '/Docs/a.txt', '/Empty', '/b.txt', '/big.bin']);
		expect(await paths(b)).toEqual(await paths(a));
		expect(await readText(b, '/Docs/a.txt')).toBe('from A');
		expect(await readText(a, '/b.txt')).toBe('from B');
		expect(new Uint8Array(await (await b.read('/big.bin')).arrayBuffer())).toEqual(big);
		// Nothing left to do
		expect((await sync()).applied).toBe(0);
	});

	it('keeps the losing version of a conflict as a copy', async () => {
		await writeText(a, '/note.md', 'base');
		await sync();
		await writeText(a, '/note.md', 'A wins? no');
		await new Promise((r) => setTimeout(r, 20));
		await writeText(b, '/note.md', 'B is newer');
		const result = await sync();
		expect(result.conflicts).toEqual(['/note.md']);
		expect(await readText(a, '/note.md')).toBe('B is newer');
		expect(await readText(a, '/note (conflict A).md')).toBe('A wins? no');
		// The next run brings the copy to the other device too
		await sync();
		expect(await readText(b, '/note (conflict A).md')).toBe('A wins? no');
	});

	it('syncs only the folders both devices take part in, and excluding never deletes', async () => {
		await writeText(a, '/Videos/one.mp4', 'video');
		await writeText(a, '/Docs/n.md', 'note');
		await sync();
		// B leaves out /Videos and deletes its copy: A keeps it, and new videos don't reach B
		const scope = { mine: [], theirs: ['/Videos'] };
		await b.remove('/Videos');
		await writeText(a, '/Videos/two.mp4', 'video 2');
		await sync({ scope });
		expect(await paths(a)).toContain('/Videos/one.mp4');
		expect(await paths(b)).toEqual(['/Docs', '/Docs/n.md']);
		// B takes part again: it gets the videos back, nothing is deleted
		await sync();
		expect(await paths(b)).toEqual(await paths(a));
		expect(await paths(a)).toEqual(['/Docs', '/Docs/n.md', '/Videos', '/Videos/one.mp4', '/Videos/two.mp4']);
	});

	it('answers nothing in a folder the answering device leaves out, whatever the driver asks for', async () => {
		// What lies in such a folder is this device's alone (made there after leaving it out; a p2p-node's `--exclude`)
		const [linkA, linkC] = await linkedPair();
		const [asker, answering] = [new Rpc(linkA), new Rpc(linkC)];
		serve(answering, { tree: b, gate: new Gate(), scope: () => ['/Private'], reach: (path) => path !== '/Private' && !path.startsWith('/Private/') });
		await writeText(b, '/Private/own.txt', 'mine alone');
		await writeText(b, '/Docs/n.md', 'note');
		const snapshot = (await asker.call('snapshot')) as unknown as { entries: [string][] };
		expect(snapshot.entries.map(([path]) => path).sort()).toEqual(['/Docs', '/Docs/n.md']);
		const state = (await b.stat('/Private/own.txt'))!;
		for (const path of ['/Private/own.txt', '/Docs/../Private/own.txt']) await expect(asker.call('get', path, { download: new WritableStream() })).rejects.toBeTruthy();
		expect(await asker.call('hash', ['/Private/own.txt'])).toEqual({});
		await expect(asker.call('put', { path: '/Private/new.txt', expect: null }, { upload: new Blob(['x']).stream() })).rejects.toBeTruthy();
		await expect(asker.call('remove', { path: '/Private/own.txt', kind: 'file', expect: { ...state } })).rejects.toBeTruthy();
		await expect(asker.call('rename', { from: '/Docs/n.md', to: '/Private/n.md', expect: { ...(await b.stat('/Docs/n.md'))! } })).rejects.toBeTruthy();
		expect(await paths(b)).toEqual(['/Docs', '/Docs/n.md', '/Private', '/Private/own.txt']);
		expect(await readText(b, '/Private/own.txt')).toBe('mine alone');
		asker.close();
	});

	it('takes no more of a file than the other device said it has', async () => {
		// The size is what was checked against the free space and asked for: a device telling a smaller one fills nothing
		const [linkA, linkC] = await linkedPair();
		const [asker, answering] = [new Rpc(linkA), new Rpc(linkC)];
		await writeText(b, '/big.bin', 'x'.repeat(200_000));
		const lying: Tree = { ...b, scan: async () => new Map([...(await b.scan())].map(([path, state]) => [path, { ...state, size: Math.min(state.size, 10) }])) };
		serve(answering, { tree: lying, gate: new Gate() });
		const result = await drive(asker, options());
		expect(result).toMatchObject({ skipped: 1 });
		expect(await paths(a)).toEqual([]);
		asker.close();
	});

	it('lets held deletions through when the answering device confirmed them, and tells it what waits', async () => {
		for (let i = 0; i < 25; i++) await writeText(a, `/f${i}.txt`, `${i}`);
		await sync();
		for (let i = 0; i < 25; i++) await b.remove(`/f${i}.txt`);
		await writeText(b, '/keep.txt', 'x');
		// B (answering) is where the user sees and confirms the held deletions
		const [linkA, linkB] = await linkedPair();
		rpcA.close();
		rpcA = new Rpc(linkA);
		let allow = false;
		const summaries: unknown[] = [];
		serve(new Rpc(linkB), { tree: b, gate: new Gate(), allowDeletes: () => allow, onEnd: (summary) => summaries.push(summary) });
		expect((await sync()).pendingDeletes).toBe(25);
		await until(() => summaries.length === 1, 5000, 'end of session');
		expect(summaries[0]).toMatchObject({ pendingDeletes: 25, usedAllowDeletes: false });
		allow = true;
		expect((await sync()).pendingDeletes).toBe(0);
		expect(await paths(a)).toEqual(['/keep.txt']);
	});

	it('applies deletions and replacements of the other device, and carries the trash like any folder', async () => {
		await writeText(a, '/gone.txt', 'deleted on B');
		await writeText(a, '/old.txt', 'version 1');
		await sync();
		// On B the user deletes into the trash (`trash-browser.ts` does this through fs.ts), and replaces a file
		const entry = '/.in-browser-trash/20261118-102233-123-abcd';
		await writeText(b, `${entry}/.trashinfo.json`, JSON.stringify({ path: '/gone.txt', kind: 'file', deleted: 1 }));
		await b.move('/gone.txt', `${entry}/gone.txt`);
		await writeText(b, '/old.txt', 'version 2, longer');
		await sync();
		expect(await paths(a)).toEqual(['/.in-browser-trash', entry, `${entry}/.trashinfo.json`, `${entry}/gone.txt`, '/old.txt']);
		expect(await readText(a, `${entry}/gone.txt`)).toBe('deleted on B');
		expect(await readText(a, '/old.txt')).toBe('version 2, longer');
	});

	it('frees the answering device when the driver vanishes mid-session', async () => {
		const gate = new Gate();
		const [linkA, linkB] = await linkedPair();
		const driver = new Rpc(linkA);
		const answering = new Rpc(linkB);
		const release = serve(answering, { tree: b, gate });
		linkB.onClose(release);
		expect(await driver.call('begin')).toMatchObject({ accepted: true });
		expect(gate.busy).toBe(true);
		driver.close();
		await until(() => !gate.busy, 5000, 'answering device free');
	});

	describe('connection lost in the middle of a transfer', () => {
		const big = () => new Uint8Array(40 * 1024 * 1024).map((_, i) => i % 97);
		const writeBig = async (tree: Tree, path: string, data: Uint8Array) => {
			const writer = (await tree.write(path)).getWriter();
			await writer.write(data);
			await writer.close();
		};
		/** Starts a sync and cuts the connection once the receiving device writes its temporary file */
		const interrupted = async (receiver: Tree) => {
			const running = sync().catch(() => null);
			await until(async () => (await receiver.names('/')).some((n) => n.endsWith('.part')), 20_000, 'transfer started');
			rpcA.close();
			await running;
		};
		/** A new connection between the same devices */
		const reconnect = async () => {
			const [linkA, linkB] = await linkedPair();
			rpcA = new Rpc(linkA);
			rpcB = new Rpc(linkB);
			serve(rpcB, { tree: b, gate: new Gate() });
		};

		it('leaves nothing behind on the receiving device', async () => {
			await writeBig(b, '/photo.jpg', big());
			await interrupted(a);
			await until(async () => (await a.names('/')).length === 0, 5000, 'A cleaned up');
			expect(await a.names('/')).toEqual([]);
			await reconnect();
			expect((await sync()).conflicts).toEqual([]);
			expect((await a.read('/photo.jpg')).size).toBe(40 * 1024 * 1024);
		}, 60_000);

		it('keeps the old version in place when a conflict transfer breaks off', async () => {
			await writeText(a, '/project.json', 'base');
			await sync();
			await writeText(b, '/project.json', 'old on B');
			await new Promise((r) => setTimeout(r, 20));
			await writeBig(a, '/project.json', big());
			await interrupted(b);
			await until(async () => (await b.names('/')).length === 1, 5000, 'B cleaned up');
			expect(await b.names('/')).toEqual(['project.json']);
			expect(await readText(b, '/project.json')).toBe('old on B');
			await reconnect();
			const result = await sync();
			expect(result.conflicts).toEqual(['/project.json']);
			expect((await b.names('/')).sort()).toEqual(['project (conflict B).json', 'project.json']);
		}, 60_000);
	});

	it('refuses a second session while one is running', async () => {
		const gate = new Gate();
		gate.enter();
		expect((await sync({ gate })).busy).toBe(true);
	});
});
