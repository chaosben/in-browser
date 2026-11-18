import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { createPolyfillRTCPeerConnection } from 'werift/polyfill';
import { parseInviteCode } from '@in-browser/files/p2p/auth.js';
import { Device, type P2pView } from '@in-browser/files/p2p/device.js';
import { resolve } from '@in-browser/files/p2p/members.js';
import { createTrysteroNetwork } from '@in-browser/files/p2p/trystero.js';
import { cleanTrash, retentionOf, TRASH_ROOT } from '@in-browser/files/trash.js';
import de from '@in-browser/files/i18n/de.js';
import en from '@in-browser/files/i18n/en.js';
import { EXIT_REMOVED, type FromPeer, type ToPeer } from './ipc.js';
import { fileStore } from './store.js';
import { fsTree } from './tree.js';
import { ICE_PORTS, keepForwarded } from './upnp.js';
import { watchTree } from './watch.js';

// The sync process of one p2p-node instance (the bundle the site serves as `/p2p-node/peer-<commit>.js`). The
// starter runs it with Node's permission model: it may read and write only its instance folder and the synced
// folder. Usage: `peer.js run|pair|status <instance folder> <synced folder> [link] [device name]`.

const [command, instanceDir, folder, ...rest] = process.argv.slice(2);
const send = (message: FromPeer) => process.send?.(message);
const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

const german = /^de\b/i.test(process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale);
const messages = german ? de : en;

const tree = fsTree(folder);
/** Expired entries of the trash go this often (the retention chosen in Files is synced into this folder too) */
const TRASH_INTERVAL = 60 * 60 * 1000;
/** Fixed WebRTC ports forwarded by the router (`IN_BROWSER_ICE_PORTS=off`: random ports, no forwarding – tests) */
const icePorts = process.env.IN_BROWSER_ICE_PORTS === 'off' ? undefined : ICE_PORTS;

async function device(onChange?: (view: P2pView) => void) {
	await mkdir(folder, { recursive: true });
	const relays = process.env.IN_BROWSER_RELAYS?.split(',').filter(Boolean);
	// werift's polyfill implements what Trystero uses, not every static member of the DOM type
	const rtcPolyfill = createPolyfillRTCPeerConnection(icePorts ? { icePortRange: icePorts } : undefined) as unknown as typeof RTCPeerConnection;
	return new Device({
		store: await fileStore(instanceDir),
		tree,
		network: createTrysteroNetwork({ rtcPolyfill, relays }),
		conflictLabel: (name) => messages.p2p.conflictLabel(name),
		onChange,
		onEvent: (event) => {
			if (event.type === 'conflicts') log(`Conflict copies kept for: ${event.paths.join(', ')}`);
			else if (event.type === 'added') log(`Device added: ${event.name}`);
			else if (event.type === 'removed') log(`Device removed: ${event.name}`);
		},
		onOutdated: (version) => send({ type: 'outdated', version }),
		log: process.env.IN_BROWSER_DEBUG ? (event, data) => log(event, JSON.stringify(data)) : undefined
	});
}

/** One line whenever the online devices or the state change */
function reporter() {
	let last = '';
	return (view: P2pView) => {
		const online = view.devices.filter((d) => !d.self && d.online).map((d) => d.name);
		const outdated = view.devices.filter((d) => d.outdated).map((d) => d.name);
		const line = [
			`state: ${view.state}`,
			`online: ${online.join(', ') || '–'}`,
			outdated.length ? `other version: ${outdated.join(', ')}` : '',
			view.failed ? `failed: ${view.failed}` : '',
			view.pendingDeletes ? `deletions waiting for confirmation in a browser: ${view.pendingDeletes}` : ''
		]
			.filter(Boolean)
			.join(' · ');
		if (line !== last) log(line);
		last = line;
		if (view.state === 'removed') {
			log('This device was removed from its devices. Pair it again to keep syncing.');
			process.exit(EXIT_REMOVED);
		}
	};
}

async function run() {
	const d = await device(reporter());
	await d.start();
	if (!d.group) {
		log('Not paired yet: run "pair" first.');
		process.exit(EXIT_REMOVED);
	}
	const unwatch = watchTree(folder, (paths) => void d.localChange(paths));
	if (icePorts) keepForwarded(icePorts, (line) => log(line));
	void cleanTrash(tree);
	setInterval(() => void cleanTrash(tree), TRASH_INTERVAL);
	let stopping = false;
	const stop = async () => {
		if (stopping) return;
		stopping = true;
		unwatch();
		// Let a running sync finish (transfers are atomic, so cutting one off after a while is safe too)
		for (let waited = 0; d.busy && waited < 60_000; waited += 500) await new Promise((r) => setTimeout(r, 500));
		d.stop();
		process.exit(0);
	};
	process.on('message', (message: ToPeer) => message.type === 'stop' && void stop());
	process.on('SIGTERM', () => void stop());
	process.on('SIGINT', () => void stop());
}

async function pair() {
	const code = parseInviteCode(rest[0] ?? '');
	if (!code) throw new Error('Expected the link "Add device" shows in Files (…/files#pair=…)');
	const name = rest[1] || hostname();
	const d = await device();
	await d.start();
	if (d.group) throw new Error('This instance is already paired. Use another name for a second one.');
	log(`Pairing as "${name}" – keep the browser with the link open …`);
	await d.join(code, name, 10 * 60_000);
	log(`Paired with: ${[...d.group!.members.values()].map((m) => m.name).join(', ')}`);
	d.stop();
	process.exit(0);
}

async function status() {
	const store = await fileStore(instanceDir);
	const [identity, state] = await Promise.all([store.identity(), store.load()]);
	const group = resolve(state.ops);
	console.log(`Device ID: ${identity.id}`);
	console.log(`Folder: ${folder}`);
	const trashDir = join(folder, ...TRASH_ROOT.split('/').filter(Boolean));
	const trash = await trashSize(trashDir);
	const days = await retentionOf(tree).catch(() => undefined);
	console.log(
		`Trash: ${trash.files} files, ${(trash.bytes / 1e6).toFixed(1)} MB in ${trashDir}` +
			(days === undefined ? '' : days === null ? ' (kept until emptied)' : ` (kept ${days} days)`)
	);
	if (state.removed) console.log('Removed from its devices – pair it again.');
	else if (!group) console.log('Not paired yet.');
	else {
		console.log('Devices:');
		for (const [id, member] of group.members) console.log(`  ${member.name}${id === identity.id ? ' (this one)' : ''}`);
	}
	process.exit(0);
}

/** Files and bytes in the trash (what the user deleted, synced from the other devices) */
async function trashSize(dir: string): Promise<{ files: number; bytes: number }> {
	const total = { files: 0, bytes: 0 };
	const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		total.files++;
		total.bytes += (await stat(join(entry.parentPath, entry.name)).catch(() => ({ size: 0 }))).size;
	}
	return total;
}

const commands: Record<string, () => Promise<void>> = { run, pair, status };
if (!commands[command] || !instanceDir || !folder) {
	console.error('Usage: peer.js run|pair|status <instance folder> <synced folder> [link] [device name]');
	process.exit(2);
}
commands[command]().catch((e: unknown) => {
	console.error(e instanceof Error ? e.message : e);
	process.exit(1);
});
