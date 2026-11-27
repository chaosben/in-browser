import { afterEach, describe, expect, it } from 'vitest';
import { codeFromWords, shareClient } from '../sources/share.js';
import { shareSync, type ShareSyncState } from '../sources/share-sync.js';
import { handleTree } from '../sync/handle-tree.js';
import type { Base } from '../sync/plan.js';
import type { Rpc } from './rpc.js';
import { trashInTree, untrashInTree } from '../trash.js';
import { roomId } from './auth.js';
import { Device } from './device.js';
import type { Link } from './link.js';
import type { Network, NetworkRoom } from './network.js';
import { memoryStore, type Store } from './store.js';
import type { LiveEnd } from './live-ends.js';
import { folderTree, hub, readText, until, writeText } from './testing.js';

// Guest shares: a device shares one folder (or one file); a browser outside the group signs in with the link's key
// and keeps a synced copy of it – a mirror when the share is for viewing

const stops: (() => Promise<void> | void)[] = [];

/** A network whose rooms are entered only after `ms` (links of this device come last) */
function later(network: Network, ms: number): Network {
	return {
		join(roomId, password) {
			const handlers: ((link: Link, peerId: string) => void)[] = [];
			let room: NetworkRoom | null = null;
			const timer = setTimeout(() => {
				room = network.join(roomId, password);
				handlers.forEach((h) => room!.onLink(h));
			}, ms);
			return {
				onLink(handler) {
					handlers.push(handler);
					room?.onLink(handler);
				},
				leave() {
					clearTimeout(timer);
					room?.leave();
				}
			};
		}
	};
}

afterEach(async () => {
	for (const stop of stops.splice(0)) await stop();
});

async function host(network: Network, now?: () => number, store: Store = memoryStore()) {
	const tree = await folderTree('share-host');
	const device = new Device({ store, tree, network, conflictLabel: (n) => `conflict ${n}`, now });
	await device.start();
	stops.push(() => device.stop(), () => tree.clear());
	await writeText(tree, '/Trip/photo.txt', 'sunny');
	await writeText(tree, '/Trip/.hidden', 'no');
	await writeText(tree, '/Private/secret.txt', 'no');
	return { device, tree };
}

let guests = 0;

/** The connection of a guest alone (no copy): who gets in */
function guestClient(network: Network, code: string, token = 'guest-1', onEnded = () => {}) {
	const got: { rpc: Rpc | null } = { rpc: null };
	const client = shareClient({ code, token }, async () => network, { timeout: 5000, onEnded, backoff: [0], onRpc: (rpc) => (got.rpc = rpc), onDown: () => (got.rpc = null) });
	stops.push(() => client.close());
	return { ...client, got };
}

/** A guest with its copy of the share in a folder of its own */
async function guest(network: Network, code: string, { limit = null as number | null, allowed = () => Infinity } = {}) {
	const name = `share-guest-${guests++}`;
	const opfs = await navigator.storage.getDirectory();
	await opfs.removeEntry(name, { recursive: true }).catch(() => {});
	const dir = await opfs.getDirectoryHandle(name, { create: true });
	let base: Base = new Map();
	const states: ShareSyncState[] = [];
	const got = { ended: false };
	const sync = shareSync({
		session: { code, token: 'guest-1' },
		network: async () => network,
		dir,
		base: { load: async () => base, save: async (b) => void (base = b) },
		limits: async () => ({ limit, free: null }),
		allowed,
		conflictLabel: (side) => (side === 'mine' ? 'conflict guest' : 'conflict host'),
		onState: (state) => states.push(state),
		onEnded: () => (got.ended = true),
		timeout: 5000,
		backoff: [0]
	});
	stops.push(() => sync.close(), () => opfs.removeEntry(name, { recursive: true }).catch(() => {}));
	const tree = handleTree(dir);
	/** Syncs once more and waits until the copy is as the share */
	const again = async () => {
		const seen = states.length;
		sync.syncNow();
		await until(() => states.length > seen && states.at(-1)?.phase === 'synced', 8000, 'synced again');
	};
	return { sync, tree, states, got, again, synced: () => until(() => states.at(-1)?.phase === 'synced', 8000, 'synced') };
}

const paths = async (tree: { scan(): Promise<Map<string, unknown>> }) => [...(await tree.scan()).keys()].sort();

// Generous time limits: under the load of a full test run, WebRTC connections take a while
describe('guest shares', { timeout: 30_000 }, () => {
	it('mirrors a share for viewing: only what is shared arrives, and nothing a guest does reaches the sharing device', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const share = await device.share('/Trip', 'view');
		const g = await guest(network, share.code);
		await g.synced();
		expect(await paths(g.tree)).toEqual(['/photo.txt']);
		expect(await readText(g.tree, '/photo.txt')).toBe('sunny');
		await until(() => device.view().shares[0]?.connected === true, 4000, 'guest shown as connected');

		// The copy is changed behind the sync's back (a guest that isn't our page): it only ever follows the share
		await writeText(g.tree, '/photo.txt', 'changed by the guest');
		await writeText(g.tree, '/new.txt', 'from the guest');
		await g.again();
		expect(await readText(g.tree, '/photo.txt')).toBe('sunny');
		expect(await paths(g.tree)).toEqual(['/photo.txt']);
		await g.tree.remove('/photo.txt');
		await g.again();
		expect(await readText(g.tree, '/photo.txt')).toBe('sunny');
		expect(await paths(tree)).toEqual(['/Private', '/Private/secret.txt', '/Trip', '/Trip/.hidden', '/Trip/photo.txt']);

		// A change on the sharing device arrives when it tells
		await writeText(tree, '/Trip/photo.txt', 'rainy now');
		await writeText(tree, '/Trip/Day 2/more.txt', 'more');
		await device.localChange(['/Trip/photo.txt', '/Trip/Day 2/more.txt']);
		await until(async () => (await readText(g.tree, '/photo.txt').catch(() => '')) === 'rainy now' && (await paths(g.tree)).includes('/Day 2/more.txt'), 8000, 'the change at the guest');

		// Requests made by hand: nothing outside the share or hidden is answered, nothing is written
		const raw = guestClient(network, share.code);
		await until(() => !!raw.got.rpc, 5000, 'second connection of the guest');
		const rpc = raw.got.rpc!;
		for (const path of ['/../Private/secret.txt', '/.hidden', '/Private/secret.txt']) await expect(rpc.call('get', path, { download: new WritableStream() })).rejects.toBeTruthy();
		await expect(rpc.call('mkdir', '/New')).rejects.toBeTruthy();
		await expect(rpc.call('remove', { path: '/photo.txt', kind: 'file', expect: { ...(await tree.stat('/Trip/photo.txt'))! } })).rejects.toBeTruthy();
		await expect(rpc.call('put', { path: '/x.txt', expect: null }, { upload: new Blob(['x']).stream() })).rejects.toBeTruthy();
		expect(await paths(tree)).toEqual(['/Private', '/Private/secret.txt', '/Trip', '/Trip/.hidden', '/Trip/Day 2', '/Trip/Day 2/more.txt', '/Trip/photo.txt']);
		expect(await readText(tree, '/Trip/photo.txt')).toBe('rainy now');
	});

	it('syncs a share for editing both ways: a change on both sides keeps both, a guest’s deletion lies in the trash here', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const share = await device.share('/Trip', 'edit');
		const g = await guest(network, share.code);
		await g.synced();
		await writeText(g.tree, '/note.txt', 'from the guest');
		await g.again();
		expect(await readText(tree, '/Trip/note.txt')).toBe('from the guest');

		// Both change the same file: the newer one holds, the other is kept next to it – on both sides
		await writeText(tree, '/Trip/photo.txt', 'host version');
		await new Promise((r) => setTimeout(r, 20));
		await writeText(g.tree, '/photo.txt', 'guest version!');
		await g.again();
		await g.again();
		expect(await readText(tree, '/Trip/photo.txt')).toBe('guest version!');
		expect(await readText(tree, '/Trip/photo (conflict host).txt')).toBe('host version');
		expect(await readText(g.tree, '/photo (conflict host).txt')).toBe('host version');

		// The guest deletes: into this device's trash; what lies outside the share is untouched
		await g.tree.remove('/note.txt');
		await g.again();
		expect(await tree.stat('/Trip/note.txt')).toBeNull();
		expect((await tree.names('/.in-browser-trash')).length).toBe(1);
		expect(await readText(tree, '/Private/secret.txt')).toBe('no');
		// The trash never travels to the guest
		expect((await paths(g.tree)).some((path) => path.includes('trash'))).toBe(false);
	});

	it('lets a guest change nothing beside what is shared, whatever it asks for by hand', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const before = await paths(tree);
		const dir = { kind: 'directory', size: 0, modified: 0 };
		// One file for editing: the guest's root is the folder it lies in – shown, never changed
		const one = await device.share('/Trip/photo.txt', 'edit', { single: true });
		const raw = guestClient(network, one.code);
		await until(() => !!raw.got.rpc, 5000, 'connection of the guest');
		const rpc = raw.got.rpc!;
		for (const kind of ['file', 'directory']) await expect(rpc.call('remove', { path: '/', kind, expect: dir })).rejects.toBeTruthy();
		await expect(rpc.call('rename', { from: '/', to: '/photo.txt/x', expect: dir })).rejects.toBeTruthy();
		await expect(rpc.call('mkdir', '/')).rejects.toBeTruthy();
		raw.close();
		await device.endShare(one.id);

		// A folder for editing: a folder is never deleted as a file, and not while it holds what the guest can't see
		const folder = await device.share('/Trip', 'edit');
		await writeText(tree, '/Trip/Full/a.txt', 'a');
		await writeText(tree, '/Trip/Quiet/.hidden', 'unseen');
		const second = guestClient(network, folder.code);
		await until(() => !!second.got.rpc, 5000, 'connection of the second guest');
		expect(await second.got.rpc!.call('remove', { path: '/Full', kind: 'file', expect: dir })).toBe('stale');
		await expect(second.got.rpc!.call('remove', { path: '/Quiet', kind: 'directory', expect: dir })).rejects.toBeTruthy();
		expect(await paths(tree)).toEqual([...before, '/Trip/Full', '/Trip/Full/a.txt', '/Trip/Quiet', '/Trip/Quiet/.hidden'].sort());
		expect(await tree.names('/.in-browser-trash').catch(() => [])).toEqual([]);
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
		await until(() => !!first.got.rpc, 5000, 'first guest in');

		// Another browser waits while the first is connected
		const second = guestClient(network, share.code, 'guest-2');
		await new Promise((r) => setTimeout(r, 1500));
		expect(second.got.rpc).toBeNull();

		// The same guest (a reload: same token) comes in beside its old connection
		const again = guestClient(network, share.code, 'guest-1');
		await until(() => !!again.got.rpc, 12_000, 'the same guest in again');

		// Once the first guest has gone, the other one gets in
		first.close();
		again.close();
		await until(() => !!second.got.rpc, 8000, 'second guest in');
		expect(device.view().shares[0]).toMatchObject({ connected: true, used: true });
	});

	it('reaches the host past other guests and members that never answer', async () => {
		// Guests of one share see each other in the room; one that answers nothing must not hold a guest forever
		const network = hub();
		const { device } = await host(later(network, 1500));
		const share = await device.share('/Trip', 'view');
		const silent = network.join(await roomId('share', share.code), share.code);
		stops.push(() => silent.leave());
		// The guest's first link is the silent member, then another guest (another tab of it: the host lets both in)
		const one = guestClient(network, share.code, 'guest-1');
		await new Promise((r) => setTimeout(r, 300));
		guestClient(network, share.code, 'guest-1');
		await until(() => !!one.got.rpc, 8000, 'the host found');
		expect(one.live.open).toBe(true);
	});

	it('tells a connected guest right away when the share ends, and answers it nothing more', async () => {
		const network = hub();
		const { device } = await host(network);
		const share = await device.share('/Trip', 'view');
		const g = await guest(network, share.code);
		await g.synced();
		const raw = guestClient(network, share.code);
		await until(() => !!raw.got.rpc, 5000, 'second connection of the guest');
		const rpc = raw.got.rpc!;
		await device.endShare(share.id);
		await until(() => g.got.ended, 3000, 'guest told');
		await expect(rpc.call('snapshot')).rejects.toBeTruthy();
		expect(device.view().shares).toEqual([]);
	});

	it('shares one file alone: the guest gets only it, and can neither delete nor rename it on the sharing device', async () => {
		const network = hub();
		const { device, tree } = await host(network);
		const share = await device.share('/Trip/photo.txt', 'edit', { single: true });
		const g = await guest(network, share.code);
		await g.synced();
		expect(await paths(g.tree)).toEqual(['/photo.txt']);
		// Saved by the guest: it replaces the file here
		await writeText(g.tree, '/photo.txt', 'edited by the guest');
		await g.again();
		expect(await readText(tree, '/Trip/photo.txt')).toBe('edited by the guest');
		// A file put next to it, and the file deleted: neither reaches this device
		await writeText(g.tree, '/other.txt', 'no');
		await g.tree.remove('/photo.txt');
		await g.again();
		expect(await readText(tree, '/Trip/photo.txt')).toBe('edited by the guest');
		expect(await tree.stat('/Trip/other.txt')).toBeNull();
		expect(await tree.names('/.in-browser-trash')).toEqual([]);
	});

	it('asks before a large share is fetched: nothing arrives until the guest agrees', async () => {
		const network = hub();
		const { device } = await host(network);
		const share = await device.share('/Trip', 'view');
		let allowed = 0;
		const g = await guest(network, share.code, { limit: 3, allowed: () => allowed });
		await until(() => g.states.at(-1)?.phase === 'waiting', 8000, 'the question');
		expect(g.states.at(-1)?.ask).toEqual({ bytes: 5, full: false });
		expect(await paths(g.tree)).toEqual([]);
		allowed = 5;
		await g.again();
		expect(await paths(g.tree)).toEqual(['/photo.txt']);
	});

	it('hands the key over to four words once – not after they were used, ran out, or for other words', async () => {
		const network = hub();
		let time = Date.now();
		const { device } = await host(network, () => time);
		const share = await device.share('/Trip', 'view');
		const { code } = await device.shareWords(share.id);
		expect(await codeFromWords(code, async () => network, 5000)).toBe(share.code);
		// Used: gone
		await expect(codeFromWords(code, async () => network, 1500)).rejects.toMatchObject({ code: expect.stringMatching(/ended|offline/) });
		// Other words meet nobody
		await expect(codeFromWords([1, 2, 3, 4], async () => network, 1500)).rejects.toMatchObject({ code: 'offline' });
		// Run out: refused
		const late = await device.shareWords(share.id);
		time += 11 * 60 * 1000;
		await expect(codeFromWords(late.code, async () => network, 5000)).rejects.toMatchObject({ code: 'ended' });
	});

	it('ends a share that ran out: the guest is refused even with the right key', async () => {
		const network = hub();
		let time = Date.now();
		const { device } = await host(network, () => time);
		const share = await device.share('/Trip', 'view', { duration: 60 * 60 * 1000 });
		expect(device.view().shares[0].expires).toBe(share.expires);
		const first = guestClient(network, share.code);
		await until(() => !!first.got.rpc, 5000, 'guest in');
		first.close();
		time += 2 * 60 * 60 * 1000;
		let ended = false;
		guestClient(network, share.code, 'guest-1', () => (ended = true));
		await until(() => ended, 5000, 'refused');
	});

	it('carries live messages both ways in order, tells live sessions with the host\'s path, and comes back after the host reloads', async () => {
		const network = hub();
		const store = memoryStore();
		const { device, tree } = await host(network, undefined, store);
		const share = await device.share('/Trip/photo.txt', 'view', { single: true });
		const guestEnd = guestClient(network, share.code).live;
		const hostEnd = () => device.liveEnds().find((e) => e.peer.kind === 'guest') as LiveEnd | undefined;
		await until(() => !!hostEnd() && guestEnd.open, 8000, 'both ends open');
		const heard: unknown[] = [];
		hostEnd()!.onMessage('test', (m) => heard.push(m));
		for (let i = 0; i < 5; i++) guestEnd.send('test', i);
		await until(() => heard.length === 5, 4000, 'messages heard');
		expect(heard).toEqual([0, 1, 2, 3, 4]);
		const back: unknown[] = [];
		guestEnd.onMessage('test', (m) => back.push(m));
		hostEnd()!.send('test', 'hi');
		await until(() => back.length === 1, 4000, 'answer heard');
		// A live session: the host sees it at its own path
		guestEnd.send('live', { sessions: [{ kind: 'present', path: '/photo.txt', title: 'photo.txt' }] });
		await until(() => device.view().live.length === 1, 4000, 'session told');
		expect(device.view().live[0]).toMatchObject({ kind: 'present', path: '/Trip/photo.txt', peer: '' });

		// The host's page reloads: the guest's end comes back by itself
		device.stop();
		const again = new Device({ store, tree, network, conflictLabel: (n) => `conflict ${n}` });
		await again.start();
		stops.push(() => again.stop());
		const newEnd = () => again.liveEnds().find((e) => e.peer.kind === 'guest');
		await until(() => !!newEnd() && guestEnd.open, 15_000, 'end back');
		const later: unknown[] = [];
		newEnd()!.onMessage('test', (m) => later.push(m));
		guestEnd.send('test', 'after');
		await until(() => later.length === 1, 4000, 'heard after the reload');
	});
});
