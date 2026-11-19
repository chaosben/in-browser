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

describe('P2P devices', () => {
	it('pairs with a one-time key and syncs', async () => {
		const network = hub();
		const [a, b] = await pairedGroup(network, 'A', 'B');
		await until(() => online(a, 'B') && online(b, 'A'), 8000, 'both online');
		expect(b.view().devices.map((d) => d.name).sort()).toEqual(['A', 'B']);

		await writeText(a.tree, '/hello.txt', 'from A');
		await a.device.localChange(['/hello.txt']);
		// The file exists as soon as writing starts: wait for its content
		await until(async () => (await readText(b.tree, '/hello.txt').catch(() => '')) === 'from A', 8000, 'file on B');
		expect(await readText(b.tree, '/hello.txt')).toBe('from A');
	});

	it('held deletions show and can be confirmed on both devices, whichever drives', async () => {
		const network = hub();
		const [a, b] = await pairedGroup(network, 'A', 'B');
		// A scan may meet a file a running sync just moves: try again then
		const count = (d: TestDevice) => d.tree.scan().then((s) => s.size, () => -1);
		await until(() => online(a, 'B') && online(b, 'A'), 8000, 'both online');
		for (let i = 0; i < 25; i++) await writeText(a.tree, `/f${i}.txt`, `${i}`);
		await writeText(a.tree, '/keep.txt', 'x');
		a.device.syncNow();
		await until(async () => (await count(b)) === 26, 15000, 'files on B');
		// Deleting many files at once on the device that does not drive: both see that it waits
		const driver = a.device.identity.id < b.device.identity.id ? a : b;
		const other = driver === a ? b : a;
		for (let i = 0; i < 25; i++) await other.tree.remove(`/f${i}.txt`);
		other.device.syncNow();
		await until(() => driver.view().pendingDeletes === 25 && other.view().pendingDeletes === 25, 15000, 'deletions held on both');
		expect(await count(driver)).toBe(26);
		// Confirmed where the user deleted them (not the driving device)
		other.device.applyDeletes();
		await until(async () => (await count(driver)) === 1, 15000, 'deletions applied');
		await until(() => driver.view().pendingDeletes === 0 && other.view().pendingDeletes === 0, 8000, 'nothing waits');
		// Deletions from another device are applied like Syncthing does: no archive of them
		expect(await driver.tree.names('/.in-browser-trash')).toEqual([]);
	}, 60_000);

	it('a one-time key works only once', async () => {
		const network = hub();
		const [a] = await pairedGroup(network, 'A');
		const { code } = await a.device.invite();
		const b = await device(network, 'B');
		await b.device.join(code, 'B');
		const c = await device(network, 'C');
		await expect(c.device.join(code, 'C', 1500)).rejects.toThrow('timeout');
	});

	it('names are unique and renames reach the others', async () => {
		const network = hub();
		const [a, b] = await pairedGroup(network, 'Laptop', 'Laptop');
		expect(b.view().self?.name).toBe('Laptop (2)');
		await until(() => online(a, 'Laptop (2)'), 8000, 'online');
		await b.device.rename('Phone');
		await until(() => a.view().devices.some((d) => d.name === 'Phone'), 8000, 'rename on A');
	});

	it('removes a device, also when it was offline at the time', async () => {
		const network = hub();
		const [a, b, c] = await pairedGroup(network, 'A', 'B', 'C');
		await until(() => online(a, 'C') && online(b, 'C'), 8000, 'C online');
		// C goes offline, A removes it
		c.device.stop();
		await a.device.remove(c.device.identity.id);
		expect(a.view().devices.map((d) => d.name).sort()).toEqual(['A', 'B']);
		await until(() => b.view().devices.length === 2, 8000, 'B learns the removal');
		// C comes back (same storage): it finds the others in the old room, learns about its removal, can't sync
		const back = await device(network, 'C', c.store, c.tree);
		await until(() => back.view().state === 'removed', 8000, 'C learns it was removed');
		await writeText(a.tree, '/secret.txt', 'not for C');
		await a.device.localChange(['/secret.txt']);
		await new Promise((r) => setTimeout(r, 1000));
		expect(await back.tree.stat('/secret.txt')).toBeNull();
	});

	it('knows when another device got the changes indirectly (A → B → C)', async () => {
		const network = hub();
		const [a, b, c] = await pairedGroup(network, 'A', 'B', 'C');
		await until(() => online(a, 'B') && online(a, 'C') && online(b, 'C'), 8000, 'all online');
		c.device.stop();
		await writeText(a.tree, '/news.txt', 'new');
		await a.device.localChange(['/news.txt']);
		await until(async () => (await b.tree.stat('/news.txt')) !== null, 8000, 'B has it');
		await until(() => a.view().devices.find((d) => d.name === 'C')?.missing?.changes === 1, 8000, 'A: C misses 1');
		// A goes offline; C comes back and syncs with B only
		a.device.stop();
		const c2 = await device(network, 'C', c.store, c.tree);
		await until(async () => (await readText(c2.tree, '/news.txt').catch(() => '')) === 'new', 8000, 'C has it via B');
		// A comes back and learns through B (or C) that C is up to date
		await new Promise((r) => setTimeout(r, 300));
		const a2 = await device(network, 'A', a.store, a.tree);
		await until(() => a2.view().devices.find((d) => d.name === 'C')?.missing?.changes === 0, 8000, 'A: C is up to date');
		expect(await readText(c2.tree, '/news.txt')).toBe('new');
	});

	it('a device that excludes a folder neither gets it nor deletes it elsewhere', async () => {
		const network = hub();
		const [a, b] = await pairedGroup(network, 'A', 'B');
		await until(() => online(a, 'B') && online(b, 'A'), 8000, 'both online');
		await writeText(a.tree, '/Videos/one.mp4', 'video');
		await a.device.localChange(['/Videos/one.mp4']);
		await until(async () => (await readText(b.tree, '/Videos/one.mp4').catch(() => '')) === 'video', 8000, 'video on B');
		// B leaves out /Videos and deletes its copy: A keeps it, and new videos don't reach B
		await b.device.excludeFolder('/Videos');
		await b.tree.remove('/Videos');
		await b.device.localChange(['/Videos']);
		await writeText(a.tree, '/Videos/two.mp4', 'video 2');
		await a.device.localChange(['/Videos/two.mp4']);
		await writeText(a.tree, '/doc.txt', 'doc');
		await a.device.localChange(['/doc.txt']);
		await until(async () => (await readText(b.tree, '/doc.txt').catch(() => '')) === 'doc', 8000, 'doc on B');
		expect(await a.tree.stat('/Videos/one.mp4')).not.toBeNull();
		expect(await b.tree.stat('/Videos')).toBeNull();
		// B takes part again: it gets the videos back, nothing is deleted
		await b.device.includeFolder('/Videos');
		await until(async () => (await b.tree.stat('/Videos/two.mp4')) !== null, 8000, 'videos back on B');
		expect(await a.tree.stat('/Videos/one.mp4')).not.toBeNull();
	});
});
