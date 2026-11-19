import { afterEach, describe, expect, it } from 'vitest';
import { FilesError } from '../entry.js';
import { Device, type P2pView } from './device.js';
import { liveSource } from './live.js';
import type { Network } from './network.js';
import { memoryStore } from './store.js';
import { folderTree, hub, readText, until, writeText } from './testing.js';

// Opening a folder live from another device: B doesn't sync /Videos, A has it; B reads and writes it through A

interface TestDevice {
	device: Device;
	tree: Awaited<ReturnType<typeof folderTree>>;
	view: () => P2pView;
}

const started: TestDevice[] = [];

async function device(network: Network, name: string): Promise<TestDevice> {
	const tree = await folderTree(`live-${name}`);
	let view: P2pView | null = null;
	const device = new Device({ store: memoryStore(), tree, network, conflictLabel: (n) => `conflict ${n}`, onChange: (v) => (view = v) });
	await device.start();
	const d = { device, tree, view: () => view! };
	started.push(d);
	return d;
}

afterEach(async () => {
	for (const d of started.splice(0)) {
		d.device.stop();
		await d.tree.clear();
	}
});

async function pair(network: Network) {
	const a = await device(network, 'A');
	const b = await device(network, 'B');
	await a.device.createGroup('A');
	const { code } = await a.device.invite();
	await b.device.join(code, 'B');
	await until(() => b.view().devices.some((d) => d.name === 'A' && d.online), 8000, 'B sees A');
	return [a, b];
}

/** B's view of the folders it doesn't sync, as fs.ts uses it */
const through = (b: TestDevice) => liveSource((method, params, upload) => b.device.live(method, params, upload), { readOnly: false, trash: true });

describe('live access to another device', () => {
	it('lists, reads in pieces, writes in pieces, moves and trashes on the device that has the folder', async () => {
		const network = hub();
		const [a, b] = await pair(network);
		// B doesn't sync /Videos before it exists (so no copy arrives first)
		await b.device.excludeFolder('/Videos');
		await until(() => a.view().devices.some((d) => d.name === 'B' && d.scope.includes('/Videos')), 8000, 'A knows B excludes');
		const big = Uint8Array.from({ length: 2.5 * 1024 * 1024 }, (_, i) => i % 253);
		const writer = (await a.tree.write('/Videos/clip.bin')).getWriter();
		await writer.write(big);
		await writer.close();
		await writeText(a.tree, '/Videos/notes.txt', 'hello');

		const source = through(b);
		expect((await source.list('/Videos')).map((e) => e.name).sort()).toEqual(['clip.bin', 'notes.txt']);
		const access = await source.open!('/Videos/clip.bin');
		expect(access.size).toBe(big.length);
		// Across a block border
		expect(await access.read(1024 * 1024 - 5, 1024 * 1024 + 5)).toEqual(big.slice(1024 * 1024 - 5, 1024 * 1024 + 5));
		expect(await access.read(big.length - 3, big.length)).toEqual(big.slice(-3));

		// Writing in pieces, also at a position (a header fixed at the end)
		const stream = (await source.writable('/Videos/new.bin')).getWriter();
		await stream.write(new Uint8Array([1, 2, 3, 4, 5, 6]));
		await stream.write({ type: 'write', position: 0, data: new Uint8Array([9]) });
		await stream.close();
		expect(new Uint8Array(await (await a.tree.read('/Videos/new.bin')).arrayBuffer())).toEqual(new Uint8Array([9, 2, 3, 4, 5, 6]));

		// An aborted write leaves nothing behind
		const aborted = (await source.writable('/Videos/gone.bin')).getWriter();
		await aborted.write(new Uint8Array([1]));
		await aborted.abort();
		await until(async () => !(await a.tree.names('/Videos')).some((n) => n.endsWith('.part')), 4000, 'temp file removed');
		expect(await a.tree.stat('/Videos/gone.bin')).toBeNull();

		await source.move('/Videos/notes.txt', '/Videos/renamed.txt');
		expect(await readText(a.tree, '/Videos/renamed.txt')).toBe('hello');
		const ref = await source.trash!('/Videos/renamed.txt');
		expect(await a.tree.stat('/Videos/renamed.txt')).toBeNull();
		await source.untrash!(ref);
		expect(await readText(a.tree, '/Videos/renamed.txt')).toBe('hello');

		// B itself never got the folder
		expect(await b.tree.stat('/Videos')).toBeNull();
	});

	it('refuses folders the answering device doesn’t have and is offline without it', async () => {
		const network = hub();
		const [a, b] = await pair(network);
		await writeText(a.tree, '/Private/x.txt', 'x');
		await a.device.excludeFolder('/Private');
		await b.device.excludeFolder('/Private');
		await until(() => b.view().devices.some((d) => d.name === 'A' && d.scope.includes('/Private')), 8000, 'B knows A excludes');
		await expect(through(b).list('/Private')).rejects.toMatchObject({ code: 'offline' });
		a.device.stop();
		await until(() => !b.view().devices.some((d) => d.name === 'A' && d.online), 8000, 'A gone');
		await expect(through(b).stat('/Docs')).rejects.toBeInstanceOf(FilesError);
	});
});
