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

describe('P2P session', () => {
	it('copies files and folders in both directions', async () => {
		await writeText(a, '/Docs/a.txt', 'from A');
		await b.mkdir('/Empty');
		await writeText(b, '/b.txt', 'from B');
		const result = await sync();
		expect(result.failed).toBe(0);
		expect(await paths(a)).toEqual(['/Docs', '/Docs/a.txt', '/Empty', '/b.txt']);
		expect(await paths(b)).toEqual(await paths(a));
		expect(await readText(b, '/Docs/a.txt')).toBe('from A');
		expect(await readText(a, '/b.txt')).toBe('from B');
		// Nothing left to do
		expect((await sync()).applied).toBe(0);
	});

	it('transfers large files in chunks', async () => {
		const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
		const writer = (await a.write('/big.bin')).getWriter();
		await writer.write(big);
		await writer.close();
		const progress: number[] = [];
		await sync({ onProgress: (done) => progress.push(done) });
		expect(new Uint8Array(await (await b.read('/big.bin')).arrayBuffer())).toEqual(big);
		expect(progress.at(-1)).toBe(1);
	});

	it('passes on changes and deletions', async () => {
		await writeText(a, '/x.txt', 'one');
		await writeText(a, '/y.txt', 'two');
		await sync();
		await writeText(b, '/x.txt', 'changed on B');
		await b.remove('/y.txt');
		await sync();
		expect(await readText(a, '/x.txt')).toBe('changed on B');
		expect(await paths(a)).toEqual(['/x.txt']);
	});

	it('compares large files by content too (in slices)', async () => {
		const big = new Uint8Array(65 * 1024 * 1024).map((_, i) => i % 199);
		for (const tree of [a, b]) {
			const writer = (await tree.write('/video.bin')).getWriter();
			await writer.write(big);
			await writer.close();
			await new Promise((r) => setTimeout(r, 20));
		}
		const result = await sync();
		expect(result.conflicts).toEqual([]);
		expect(result.applied).toBe(0);
	}, 60_000);

	it('does not transfer files with the same content', async () => {
		await writeText(a, '/same.txt', 'identical');
		await new Promise((r) => setTimeout(r, 20));
		await writeText(b, '/same.txt', 'identical');
		const result = await sync();
		expect(result.applied).toBe(0);
		expect(result.conflicts).toEqual([]);
	});

	it('keeps the losing version of a conflict as a copy', async () => {
		await writeText(a, '/note.md', 'base');
		await sync();
		await writeText(a, '/note.md', 'A wins? no');
		await new Promise((r) => setTimeout(r, 20));
		await writeText(b, '/note.md', 'B is newer');
		const log: { event: string; data?: Record<string, unknown> }[] = [];
		const result = await sync({ log: (event, data) => log.push({ event, data }) });
		// The log shows why: both sides changed since the last sync, different content
		const planned = log.find((e) => e.event === 'sync.plan' && e.data?.path === '/note.md')!.data!;
		expect(planned).toMatchObject({ type: 'toLocal', both: true });
		expect(planned.baseLocal).not.toBeNull();
		expect(log.find((e) => e.event === 'sync.compare')?.data).toMatchObject({ path: '/note.md', same: false });
		expect(log.find((e) => e.event === 'sync.conflictCopy')?.data).toMatchObject({ path: '/note.md', kept: 'here' });
		expect(result.conflicts).toEqual(['/note.md']);
		expect(await readText(a, '/note.md')).toBe('B is newer');
		expect(await readText(a, '/note (conflict A).md')).toBe('A wins? no');
		// The next run brings the copy to the other device too
		await sync();
		expect(await readText(b, '/note (conflict A).md')).toBe('A wins? no');
	});

	it('syncs only the folders both devices take part in, and excluding never deletes', async () => {
		await writeText(a, '/Videos/big.mp4', 'video');
		await writeText(a, '/Docs/n.md', 'note');
		await sync({ scope: { mine: [], theirs: ['/Videos'] } });
		expect(await paths(b)).toEqual(['/Docs', '/Docs/n.md']);
		// B already had the video and excludes it now: nothing gets deleted on either side
		await writeText(b, '/Videos/own.mp4', 'own');
		await sync({ scope: { mine: [], theirs: ['/Videos'] } });
		expect(await paths(a)).toContain('/Videos/big.mp4');
		expect(await paths(b)).toContain('/Videos/own.mp4');
	});

	it('holds many deletions for confirmation', async () => {
		for (let i = 0; i < 25; i++) await writeText(a, `/f${i}.txt`, `${i}`);
		await sync();
		for (let i = 0; i < 25; i++) await b.remove(`/f${i}.txt`);
		await writeText(b, '/keep.txt', 'x');
		const held = await sync();
		expect(held.pendingDeletes).toBe(25);
		expect((await paths(a)).length).toBe(26);
		await sync({ allowDeletes: true });
		expect(await paths(a)).toEqual(['/keep.txt']);
	});

	it('frees the answering device when the driver vanishes mid-session', async () => {
		const gate = new Gate();
		const [linkA, linkB] = await linkedPair();
		const driver = new Rpc(linkA);
		const answering = new Rpc(linkB);
		const release = serve(answering, { tree: b, gate });
		linkB.onClose(release);
		expect(await driver.call('begin')).toBe(true);
		expect(gate.busy).toBe(true);
		driver.close();
		await new Promise((r) => setTimeout(r, 300));
		expect(gate.busy).toBe(false);
	});

	describe('connection lost in the middle of a transfer', () => {
		const big = () => new Uint8Array(40 * 1024 * 1024).map((_, i) => i % 97);
		const writeBig = async (tree: Tree, path: string, data: Uint8Array) => {
			const writer = (await tree.write(path)).getWriter();
			await writer.write(data);
			await writer.close();
		};
		/** Starts a sync and cuts the connection shortly after */
		const interrupted = async () => {
			const running = sync().catch(() => null);
			await new Promise((r) => setTimeout(r, 300));
			rpcA.close();
			await running;
			await new Promise((r) => setTimeout(r, 300));
		};
		/** A new connection between the same devices */
		const reconnect = async () => {
			const [linkA, linkB] = await linkedPair();
			rpcA = new Rpc(linkA);
			rpcB = new Rpc(linkB);
			serve(rpcB, { tree: b, gate: new Gate() });
		};

		it('leaves nothing behind on the receiving device (upload)', async () => {
			await writeBig(a, '/photo.jpg', big());
			await interrupted();
			// Neither a half file nor a leftover temporary file (cleaning up may take a moment after the abort)
			await until(async () => (await b.names('/')).length === 0, 5000, 'B cleaned up');
			expect(await b.names('/')).toEqual([]);
			await reconnect();
			const result = await sync();
			expect(result.conflicts).toEqual([]);
			expect((await b.read('/photo.jpg')).size).toBe(40 * 1024 * 1024);
		}, 60_000);

		it('leaves nothing behind on the receiving device (download)', async () => {
			await writeBig(b, '/photo.jpg', big());
			await interrupted();
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
			await interrupted();
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
