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

	it('removes a device, also when it was offline at the time', async () => {
		const network = hub();
		const [a, b, c] = await pairedGroup(network, 'A', 'B', 'C');
		await until(() => online(a, 'C') && online(b, 'C'), 15_000, 'C online');
		// C goes offline, A removes it
		c.device.stop();
		await a.device.remove(c.device.identity.id);
		expect(a.view().devices.map((d) => d.name).sort()).toEqual(['A', 'B']);
		await until(() => b.view().devices.length === 2, 15_000, 'B learns the removal');
		// C comes back (same storage): it finds the others in the old room, learns about its removal, can't sync
		const back = await device(network, 'C', c.store, c.tree);
		await until(() => back.view().state === 'removed', 15_000, 'C learns it was removed');
		await writeText(a.tree, '/secret.txt', 'not for C');
		await a.device.localChange(['/secret.txt']);
		await new Promise((r) => setTimeout(r, 1000));
		expect(await back.tree.stat('/secret.txt')).toBeNull();
	});
});
