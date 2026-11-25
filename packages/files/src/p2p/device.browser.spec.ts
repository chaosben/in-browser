import { afterEach, describe, expect, it } from 'vitest';
import { Device } from './device.js';
import type { P2pView } from './view.js';
import type { Network } from './network.js';
import { memoryStore, type Store } from './store.js';
import { folderTree, hub, readText, until, writeText } from './testing.js';

// Whole devices (rooms, sign-in, pairing, member log, sync, knowledge) over an in-page network with real WebRTC

interface TestDevice {
	device: Device;
	tree: Awaited<ReturnType<typeof folderTree>>;
	store: Store;
	view: () => P2pView;
}

const started: TestDevice[] = [];

async function device(network: Network, name: string, store = memoryStore(), tree?: TestDevice['tree']): Promise<TestDevice> {
	tree ??= await folderTree(`device-${name}`);
	let view: P2pView | null = null;
	const device = new Device({ store, tree, network, conflictLabel: (n) => `conflict ${n}`, onChange: (v) => (view = v) });
	await device.start();
	const d = { device, tree, store, view: () => view! };
	started.push(d);
	return d;
}

afterEach(async () => {
	for (const d of started.splice(0)) {
		d.device.stop();
		await d.tree.clear();
	}
});

const online = (d: TestDevice, name: string) => d.view().devices.some((x) => x.name === name && x.online && !x.self);

async function pairedGroup(network: Network, ...names: string[]) {
	const [first, ...rest] = await Promise.all(names.map((n) => device(network, n)));
	await first.device.createGroup(names[0]);
	for (const [i, d] of rest.entries()) {
		const { code } = await first.device.invite();
		await d.device.join(code, names[i + 1]);
	}
	return [first, ...rest];
}

// Generous time limits: under the load of a full test run, WebRTC connections take a while
describe('P2P devices', { timeout: 30_000 }, () => {
	it('pairs with a one-time key that works only once, and syncs', async () => {
		const network = hub();
		const a = await device(network, 'A');
		await a.device.createGroup('A');
		const { code } = await a.device.invite();
		const b = await device(network, 'B');
		await b.device.join(code, 'B');
		await until(() => online(a, 'B') && online(b, 'A'), 15_000, 'both online');
		expect(b.view().devices.map((d) => d.name).sort()).toEqual(['A', 'B']);

		await writeText(a.tree, '/hello.txt', 'from A');
		await a.device.localChange(['/hello.txt']);
		// The file exists as soon as writing starts: wait for its content
		await until(async () => (await readText(b.tree, '/hello.txt').catch(() => '')) === 'from A', 15_000, 'file on B');

		const c = await device(network, 'C');
		await expect(c.device.join(code, 'C', 1500)).rejects.toThrow('timeout');
	});

	it('removes a device, also when it was offline at the time: it learns that and nothing else', async () => {
		const network = hub();
		const [a, b, c] = await pairedGroup(network, 'A', 'B', 'C');
		await until(() => online(a, 'C') && online(b, 'C'), 15_000, 'C online');
		await writeText(a.tree, '/before.txt', 'x');
		await a.device.localChange(['/before.txt']);
		// B and C go offline, A removes C
		b.device.stop();
		c.device.stop();
		await a.device.remove(c.device.identity.id);
		expect(a.view().devices.map((d) => d.name).sort()).toEqual(['A', 'B']);
		const room = a.device.group!.room!;
		// B comes back (same storage): it meets A in the old room and is given the new one as a member
		const b2 = await device(network, 'B', b.store, b.tree);
		await until(() => b2.device.group?.room === room && online(b2, 'A'), 15_000, 'B learns the removal and the new room');
		// C comes back: it finds the others in the old room, learns about its removal – but not the new room, and
		// nothing about files or devices since
		await writeText(a.tree, '/secret.txt', 'not for C');
		await a.device.localChange(['/secret.txt']);
		const back = await device(network, 'C', c.store, c.tree);
		await until(() => back.view().state === 'removed', 15_000, 'C learns it was removed');
		await new Promise((r) => setTimeout(r, 1000));
		expect(await back.tree.stat('/secret.txt')).toBeNull();
		const known = JSON.stringify(back.device.state);
		expect(known).not.toContain(room);
		expect(known).not.toContain('/secret.txt');
	});

	it('tells the others when it leaves', async () => {
		const network = hub();
		const [a, b] = await pairedGroup(network, 'A', 'B');
		await until(() => online(a, 'B') && online(b, 'A'), 15_000, 'both online');
		await b.device.leave();
		await until(() => a.view().devices.length === 1, 15_000, 'A learns that B left');
		expect(a.device.group!.room).not.toBeNull();
	});

	it('opens live channels between paired devices', async () => {
		const network = hub();
		const [a, b] = await pairedGroup(network, 'A', 'B');
		const endAt = (d: TestDevice) => d.device.liveEnds().find((e) => e.peer.kind === 'device');
		await until(() => !!endAt(a) && !!endAt(b), 15_000, 'ends open');
		expect(endAt(a)!.peer.name).toBe('B');
		const heard: unknown[] = [];
		endAt(b)!.onMessage('test', (m) => heard.push(m));
		endAt(a)!.send('test', { page: 2 });
		await until(() => heard.length === 1, 4000, 'heard');
		expect(heard).toEqual([{ page: 2 }]);
	});

	it('gives the sizes of subfolders only – a file in the folder is none (choosing it off would exclude a file)', async () => {
		const a = await device(hub(), 'A');
		await writeText(a.tree, '/top.txt', '12345');
		await writeText(a.tree, '/Docs/a.txt', '123');
		await writeText(a.tree, '/Docs/sub/b.txt', '12');
		await a.tree.mkdir('/Empty');
		// A package counts like a file: no folder to choose, its size belongs to the folder it lies in
		await writeText(a.tree, '/Trip.screencapture/project.json', '{}');
		await writeText(a.tree, '/Docs/Trip.screencapture/media/a.mp4', '1234');
		expect(await a.device.folderSizes('/')).toEqual({ '/Docs': 9, '/Empty': 0 });
		expect(await a.device.folderSizes('/Docs')).toEqual({ '/Docs/sub': 2 });
	});
});
