import { afterEach, describe, expect, it } from 'vitest';
import { shareClient } from '../sources/share.js';
import { trashInTree, untrashInTree } from '../trash.js';
import { Device } from './device.js';
import type { Network } from './network.js';
import { memoryStore } from './store.js';
import { folderTree, hub, readText, until, writeText } from './testing.js';

// Guest shares: a device shares one folder; a browser outside the group opens it live with the link's key

const stops: (() => Promise<void> | void)[] = [];

afterEach(async () => {
	for (const stop of stops.splice(0)) await stop();
});

async function host(network: Network) {
	const tree = await folderTree('share-host');
	const device = new Device({ store: memoryStore(), tree, network, conflictLabel: (n) => `conflict ${n}` });
	await device.start();
	stops.push(() => device.stop(), () => tree.clear());
	await writeText(tree, '/Trip/photo.txt', 'sunny');
	await writeText(tree, '/Trip/.hidden', 'no');
	await writeText(tree, '/Private/secret.txt', 'no');
	return { device, tree };
}

function guest(network: Network, code: string, token = 'guest-1', onEnded = () => {}) {
	return guestClient(network, code, token, onEnded).source;
}

function guestClient(network: Network, code: string, token = 'guest-1', onEnded = () => {}) {
	const client = shareClient({ code, token }, async () => network, { timeout: 1500, onEnded, backoff: [0] });
	stops.push(() => client.close());
	return client;
}

describe('guest shares', () => {
	it('shows only the shared folder, read-only when viewing', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const share = await device.share('/Trip', 'view');
		const source = guest(network, share.code);
		expect((await source.list('/')).map((e) => e.name)).toEqual(['photo.txt']);
		expect(await (await source.read('/photo.txt')).text()).toBe('sunny');
		await expect(source.stat('/../Private/secret.txt')).resolves.toBeNull();
		await expect(source.read('/.hidden')).rejects.toMatchObject({ code: 'notFound' });
		await expect(source.mkdir('/New')).rejects.toMatchObject({ code: 'readOnly' });
		expect(await tree.stat('/Trip/New')).toBeNull();
		await until(() => device.view().shares[0]?.connected === true, 4000, 'guest shown as connected');
	});

	it('lets the guest edit when allowed', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const share = await device.share('/Trip', 'edit');
		const source = guest(network, share.code);
		const writer = (await source.writable('/note.txt')).getWriter();
		await writer.write(new TextEncoder().encode('from the guest'));
		await writer.close();
		expect(await readText(tree, '/Trip/note.txt')).toBe('from the guest');
		const ref = await source.trash!('/photo.txt');
		expect(await tree.stat('/Trip/photo.txt')).toBeNull();
		// The guest never learns where the shared folder lies
		expect(ref.path).toBe('/photo.txt');
		await source.untrash!(ref);
		expect(await readText(tree, '/Trip/photo.txt')).toBe('sunny');
	});

	it('keeps an editing guest inside the shared folder and its own deletions', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const share = await device.share('/Trip', 'edit');
		const source = guest(network, share.code);
		await writeText(tree, '/Other/Trip/photo.txt', 'elsewhere');

		// Made-up trash references never reach outside (`..` would name the root of My files)
		for (const entry of ['..', '../Private', '../Other']) {
			await expect(source.untrash!({ entry, path: '/photo.txt' })).rejects.toMatchObject({ code: 'notFound' });
		}
		expect(await readText(tree, '/Private/secret.txt')).toBe('no');
		expect(await readText(tree, '/Other/Trip/photo.txt')).toBe('elsewhere');
		expect(await readText(tree, '/Trip/photo.txt')).toBe('sunny');

		// Deleting goes into the trash, the shared folder itself stays
		await expect(source.remove('/')).rejects.toMatchObject({ code: 'root' });
		await expect(source.move('/', '/x')).rejects.toBeTruthy();
		await source.remove('/photo.txt');
		expect(await tree.stat('/Trip/photo.txt')).toBeNull();
		expect((await tree.names('/.in-browser-trash')).length).toBe(1);

		// Writes without gaps (a far position would make a huge file on the host)
		const writer = (await source.writable('/big.bin')).getWriter();
		await writer.write({ type: 'write', position: 1e12, data: new Uint8Array(4) });
		// Pieces are sent when complete: the refusal comes with closing
		await expect(writer.close()).rejects.toBeTruthy();
		expect(await tree.stat('/Trip/big.bin')).toBeNull();
	});

	it('restores only real trash entries of exactly that path (references may come from other devices)', async () => {
		const tree = await folderTree('share-untrash');
		stops.push(() => tree.clear());
		await writeText(tree, '/Trip/photo.txt', 'sunny');
		await writeText(tree, '/Other/Trip/photo.txt', 'elsewhere');
		const ref = await trashInTree(tree, '/Trip/photo.txt');
		const bad = [
			{ entry: '..', path: '/Trip/photo.txt' },
			{ entry: '../Other', path: '/Trip/photo.txt' },
			{ entry: `${ref.entry}/..`, path: '/Trip/photo.txt' },
			{ entry: ref.entry, path: '/Other/Trip/photo.txt' }
		];
		for (const r of bad) await expect(untrashInTree(tree, r)).rejects.toMatchObject({ code: 'notFound' });
		expect(await readText(tree, '/Other/Trip/photo.txt')).toBe('elsewhere');
		expect(await untrashInTree(tree, ref)).toBe('/Trip/photo.txt');
	});

	it('lets one guest in at a time, and the same guest again', async () => {
		const network = hub();
		const { device } = await host(network);
		const share = await device.share('/Trip', 'view');
		const first = guestClient(network, share.code, 'guest-1');
		await first.source.list('/');

		// Another browser waits while the first is connected
		const second = guest(network, share.code, 'guest-2');
		await expect(second.list('/')).rejects.toMatchObject({ code: 'taken' });

		// The same guest (a reload: same token) comes in beside its old connection
		const again = guestClient(network, share.code, 'guest-1');
		expect((await again.source.list('/')).map((e) => e.name)).toEqual(['photo.txt']);

		// Once the first guest has gone, the other one gets in
		first.close();
		again.close();
		await until(async () => (await second.list('/').then(() => true, () => false)), 4000, 'second guest in');
		expect(device.view().shares[0]).toMatchObject({ connected: true, used: true });
	});

	it('tells a connected guest right away when the share ends', async () => {
		const network = hub();
		const { device } = await host(network);
		const share = await device.share('/Trip', 'view');
		let ended = false;
		const source = guest(network, share.code, 'guest-1', () => (ended = true));
		await source.list('/');
		await device.endShare(share.id);
		await until(() => ended, 3000, 'guest told');
		const started = Date.now();
		await expect(source.list('/')).rejects.toMatchObject({ code: 'ended' });
		// No waiting for a device that left
		expect(Date.now() - started).toBeLessThan(500);
		expect(device.view().shares).toEqual([]);
	});

	it('waits longer and longer before trying again when nobody answers', async () => {
		let joins = 0;
		const silent: Network = {
			join: () => {
				joins++;
				return { onLink: () => {}, leave: () => {} };
			}
		};
		let time = 0;
		const client = shareClient({ code: 'X'.repeat(20), token: 't' }, async () => silent, { timeout: 10, backoff: [5_000, 15_000], now: () => time });
		stops.push(() => client.close());
		await expect(client.source.list('/')).rejects.toMatchObject({ code: 'offline' });
		// Within the pause: answered at once, no new announcement
		time = 4_000;
		await expect(client.source.list('/')).rejects.toMatchObject({ code: 'offline' });
		expect(joins).toBe(1);
		time = 5_001;
		await expect(client.source.list('/')).rejects.toMatchObject({ code: 'offline' });
		expect(joins).toBe(2);
		time = 15_000;
		await expect(client.source.list('/')).rejects.toMatchObject({ code: 'offline' });
		expect(joins).toBe(2);
	});
});
