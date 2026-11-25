import { debug } from '@in-browser/brand/debug.js';
import { requestPersistence, storageEstimate } from '../cache.js';
import { FilesError, noticed, watch, type FilesErrorCode } from '../fs.js';
import { expectDevices, setDevicesSource } from '../sources/registry.js';
import type { Source } from '../sources/source.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { basename, isConnected } from '../path.js';
import type { Tree } from '../sync/tree.js';
import { liftError } from './live.js';
import { liveSource } from './live-client.js';
import type { Share } from './shares.js';
import type { Json } from './rpc.js';
import { filesMessages } from '../i18n/index.svelte.js';
import type { Device, DeviceEvent } from './device.js';
import type { LiveEnd } from './live-ends.js';
import { OFF_VIEW, type P2pView } from './view.js';
import { ed25519Supported } from './identity.js';
import { journal } from '../sync/journal.svelte.js';

// The P2P sync in the app: one tab per browser runs the device (Web Lock `files:p2p-leader`, independent of the folder
// sync, so it also runs where folders on disk can't be accessed: Firefox, Safari, phones). Every other tab mirrors its
// status and sends its requests (BroadcastChannel `files:p2p`). Started by `startSync()` in every tool's layout.

export interface P2pStatus {
	/** The browser can do it (Ed25519 in WebCrypto, OPFS, WebRTC) */
	supported: boolean;
	view: P2pView;
}


export const p2pStatus = $state<P2pStatus>({ supported: true, view: OFF_VIEW });

type Action =
	| ['createGroup', string]
	| ['invite']
	| ['cancelInvites']
	| ['join', string, string]
	| ['rename', string]
	| ['remove', string]
	| ['leave']
	| ['forget']
	| ['exclude', string]
	| ['include', string]
	| ['syncNow']
	| ['applyDeletes']
	| ['finishSetup', string[]]
	| ['allowFolder', string]
	| ['sizes', string]
	| ['diagnostics']
	| ['live', string, string, Json, Uint8Array | undefined]
	| ['holders', string]
	| ['share', string, Share['mode'], { single?: boolean; duration?: number | null }]
	| ['shareWords', string]
	| ['endShare', string];

type Message =
	| { status: P2pView }
	| { event: DeviceEvent }
	| { request: Action; id: string }
	| { reply: string; value?: unknown; error?: string; code?: FilesErrorCode; path?: string }
	| { hello: true }
	| { handedOver: true };

let channel: BroadcastChannel | null = null;
let device: Device | null = null;
let started = false;
const waiting = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const eventHandlers = new Set<(event: DeviceEvent) => void>();

/** Starts the P2P machinery in this tab (once) */
export function startP2p() {
	if (started || typeof window === 'undefined' || !('RTCPeerConnection' in window) || !navigator.storage?.getDirectory) {
		p2pStatus.supported = typeof window !== 'undefined' && 'RTCPeerConnection' in window;
		return;
	}
	started = true;
	channel = new BroadcastChannel('files:p2p');
	channel.onmessage = (e: MessageEvent<Message>) => {
		const message = e.data;
		if ('status' in message) {
			if (!device) showView(message.status);
		} else if ('event' in message) {
			eventHandlers.forEach((handler) => handler(message.event));
			if (message.event.type === 'remoteChanged') remoteChanged();
		} else if ('request' in message) {
			if (device) run(message.request).then(
				(value) => channel?.postMessage({ reply: message.id, value } satisfies Message),
				(error: unknown) =>
					channel?.postMessage({
						reply: message.id,
						error: error instanceof Error ? error.message : String(error),
						...(error instanceof FilesError ? { code: error.code, path: error.path } : {})
					} satisfies Message)
			);
		} else if ('reply' in message) {
			const pending = waiting.get(message.reply);
			waiting.delete(message.reply);
			if (message.error !== undefined) pending?.reject(message.code ? new FilesError(message.code, message.path ?? '/') : new Error(message.error));
			else pending?.resolve(message.value);
		} else if ('hello' in message && device) {
			channel?.postMessage({ status: device.view() } satisfies Message);
		}
	};
	channel.postMessage({ hello: true } satisfies Message);
	// Paths in folders this device doesn't sync wait for the folder choice before fs.ts routes them
	expectDevices();
	ready = ed25519Supported().then((ok) => {
		p2pStatus.supported = ok;
		if (!ok) return showView(OFF_VIEW);
		askLead(false);
	});
}

/** Whether this browser can sync is known, and this tab asked for the lead */
let ready: Promise<void> = Promise.resolve();

/** Whether this tab asked to lead (a live page that must not depend on a tab the browser may freeze), and whether it
 * holds the lead (its device may still be starting) */
let wantsLead = false;
let leading = false;
/** Counts leads taken and lost (a lead lost while waiting starts nothing) */
let generation = 0;
/** A tab inheriting the lead waits this long before its device starts */
const INHERIT_WAIT = 1500;

/**
 * Asks for the lead (Web Lock `files:p2p-leader`); with `steal` it is taken from the tab leading now, which stops its
 * device, writes what it had and says so (`handedOver`) before this one reads the state. A tab whose lead is taken
 * waits for it again.
 */
function askLead(steal: boolean) {
	const asked = (navigator.locks.query?.() ?? Promise.resolve({ held: [] }))
		.then((state) => !!state.held?.some((lock) => lock.name === 'files:p2p-leader'))
		.catch(() => false);
	navigator.locks
		.request('files:p2p-leader', steal ? { steal: true } : {}, async () => {
			const mine = ++generation;
			leading = true;
			// Inherited from a tab that just closed or reloaded: that page may take it back at once (a live page) – a
			// device started meanwhile would announce itself in the rooms and leave others trying to reach it
			if (!steal && (await asked)) {
				await new Promise((r) => setTimeout(r, INHERIT_WAIT));
				if (mine !== generation) return;
			}
			if (steal) await handedOver();
			if (mine !== generation) return;
			try {
				await lead(mine);
			} catch (e) {
				// A page of an older version (still open after an update) can't read what a newer one keeps: it
				// gives the lead away, so a newer tab syncs
				if (e instanceof Error && e.name === 'StateError') return console.warn('[P2P] this page is older than the sync state – reload it');
				throw e;
			}
			return new Promise<never>(() => {});
		})
		.catch((e: unknown) => {
			// Taken by another tab: this one's device stops, and it waits to lead again
			if (e instanceof Error && e.name === 'AbortError') void giveUp();
			else console.error('[P2P] lead', e);
		});
}

/** The lead went to another tab: the device stops and what it had is written, then that tab is told */
async function giveUp() {
	generation++;
	const d = device;
	device = null;
	leading = false;
	wantsLead = false;
	if (d) {
		d.stop();
		await d.settled();
	}
	channel?.postMessage({ handedOver: true } satisfies Message);
	askLead(false);
}

/** Waits until the tab that led has handed over (at most 3 s: a frozen tab writes nothing) */
function handedOver(): Promise<void> {
	return new Promise((done) => {
		const timer = setTimeout(finish, 3000);
		function finish() {
			clearTimeout(timer);
			removeEventListener('message', heard);
			channel?.removeEventListener('message', heard);
			done();
		}
		function heard(e: MessageEvent) {
			if ((e.data as { handedOver?: boolean })?.handedOver) finish();
		}
		channel?.addEventListener('message', heard);
	});
}

/**
 * Makes this tab lead (if it doesn't): for live pages, which hold connections a background tab would lose when the
 * browser freezes it (phones do). Resolves once this tab's device runs.
 */
export async function takeLead(): Promise<void> {
	if (!started) return;
	await ready;
	if (!p2pStatus.supported) return;
	if (!device && !leading && !wantsLead) {
		wantsLead = true;
		// Only ever from another tab. With nobody leading, this tab's own request (made at the start) is granted any
		// moment: stealing would take the lead from this very page while its device starts – that left a device
		// nobody stops in the rooms, and the next one failed on them
		const held = await (navigator.locks.query?.() ?? Promise.resolve({ held: [] }))
			.then((state) => !!state.held?.some((lock) => lock.name === 'files:p2p-leader'))
			.catch(() => false);
		if (held && !leading && !device) askLead(true);
	}
	// This tab's device runs (or starts already; a tab whose state is too new for it never gets one)
	while (!device) await new Promise((r) => setTimeout(r, 100));
}

/** The live channels' ends of this tab's device (it leads; `takeLead`) */
export const liveEnds = (): LiveEnd[] => device?.liveEnds() ?? [];
/** Tells about ends that open while this tab leads; returns how to stop */
export function onLiveEnd(listener: (end: LiveEnd) => void): () => void {
	const offs: (() => void)[] = [];
	let current: Device | null = null;
	const watch = setInterval(() => {
		if (device === current) return;
		current = device;
		offs.splice(0).forEach((off) => off());
		if (device) offs.push(device.onLiveEnd(listener));
	}, 500);
	if (device) {
		current = device;
		offs.push(device.onLiveEnd(listener));
	}
	return () => {
		clearInterval(watch);
		offs.forEach((off) => off());
	};
}

let watching = false;

/** Starts this tab's device; `mine` is the lead it starts for – taken away meanwhile, nothing starts (or stays) */
async function lead(mine: number) {
	const log = await journal('p2p');
	// Loaded only in the leading tab (Trystero and its Nostr crypto are not needed elsewhere)
	const [{ Device }, { idbStore }, { opfsTree }, { trysteroNetwork }] = await Promise.all([
		import('./device.js'),
		import('./store.js'),
		import('../sync/opfs-tree.js'),
		import('./trystero.js')
	]);
	if (mine !== generation) return;
	const made = (device = new Device({
		store: idbStore,
		tree: opfsTree,
		network: trysteroNetwork,
		conflictLabel: (name) => filesMessages().p2p.conflictLabel(name),
		log: log.add,
		holdLarge: true,
		freeSpace: async () => {
			const { quota, usage } = await storageEstimate();
			return quota === undefined ? null : quota - (usage ?? 0);
		},
		onChange: (view) => {
			showView(view);
			channel?.postMessage({ status: view } satisfies Message);
		},
		onEvent: (event) => {
			eventHandlers.forEach((handler) => handler(event));
			if (event.type === 'remoteChanged') remoteChanged();
			channel?.postMessage({ event } satisfies Message);
		}
	}));
	// Connected folders are no part of My files: their changes never reach the other devices (once per page)
	if (!watching) watch((paths) => void device?.localChange(paths.filter((path) => !isConnected(path))));
	watching = true;
	await made.start();
	// The lead went while it started: it must not stay in the rooms
	if (mine !== generation) {
		made.stop();
		if (device === made) device = null;
		return;
	}
	const rooms = made.roomCount();
	debug(`[p2p] device started: ${rooms.devices} rooms of the devices (${rooms.old} of them replaced ones), ${rooms.shares} of shares`);
	void dropOldCopies(opfsTree);
}

async function run(action: Action): Promise<unknown> {
	const d = device!;
	switch (action[0]) {
		case 'createGroup':
			return d.createGroup(action[1]);
		case 'invite':
			return d.invite();
		case 'cancelInvites':
			return d.cancelInvites();
		case 'join':
			// A browser that joins first shows what would come and lets the user choose (`finishSetup`)
			return d.join(action[1], action[2], undefined, { setup: true });
		case 'finishSetup':
			return d.finishSetup(action[1]);
		case 'allowFolder':
			return d.allowFolder(action[1]);
		case 'rename':
			return d.rename(action[1]);
		case 'remove':
			return d.remove(action[1]);
		case 'leave':
			return d.leave();
		case 'forget':
			return d.forget();
		case 'exclude':
			return d.excludeFolder(action[1]);
		case 'include':
			return d.includeFolder(action[1]);
		case 'syncNow':
			return d.syncNow();
		case 'applyDeletes':
			return d.applyDeletes();
		case 'sizes':
			return d.remoteSizes(action[1]);
		case 'diagnostics':
			return diagnosticsHere();
		case 'live':
			// Answers of the other device about files keep their code across tabs
			return d.live(action[2], action[3], action[4]).catch((e: unknown) => liftError(e, action[1]));
		case 'holders':
			return d.holdersOf(action[1]);
		case 'share':
			return d.share(action[1], action[2], action[3]);
		case 'shareWords':
			return d.shareWords(action[1]);
		case 'endShare':
			return d.endShare(action[1]);
	}
}

// --- Folders this device doesn't sync, opened live from the others ---

/** A request may wait this long for the leading tab (pieces are at most 1 MiB) */
const LIVE_TIMEOUT = 60_000;

const devicesSource: Source = liveSource(
	(method, params, upload) => {
		const p = (params ?? {}) as { path?: string; from?: string };
		const path = p.path ?? p.from ?? '/';
		return withTimeout(request<{ value: Json; bytes?: Uint8Array }>('live', path, method, params, upload), path);
	},
	{ readOnly: false, trash: true }
);

function withTimeout<T>(promise: Promise<T>, path: string, ms = LIVE_TIMEOUT): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new FilesError('offline', path)), ms);
		promise.then(
			(value) => (clearTimeout(timer), resolve(value)),
			(error) => (clearTimeout(timer), reject(error))
		);
	});
}

/** Folders this device doesn't sync (opened live from the other devices); none while not online */
export const excludedNow = (view: P2pView = p2pStatus.view) => (view.state === 'online' ? view.scope : []);

function showView(view: P2pView) {
	p2pStatus.view = view;
	setDevicesSource(devicesSource, excludedNow(view));
}

/**
 * Copies of folders this device doesn't sync that are still here (“keep copy” of earlier versions): into the trash of
 * this device – there they stay restorable (restoring writes to a device that has the folder); once per start
 */
async function dropOldCopies(tree: Tree) {
	const { trashInTree } = await import('../trash.js');
	for (const folder of device ? excludedNow(device.view()) : []) {
		try {
			if (!(await tree.stat(folder))) continue;
			await trashInTree(tree, folder);
			toast(filesMessages().p2p.oldCopy(basename(folder)), 'info', 10000);
		} catch (e) {
			console.warn('[P2P] old copy', folder, e);
		}
	}
}

/** Another device changed files: views of folders opened from it load again */
function remoteChanged() {
	if (p2pStatus.view.scope.length) noticed(...p2pStatus.view.scope);
}

/** Shares a folder – or with `single` one file or package – with a guest (a browser outside your devices) until
 * ended or for `duration` ms; its link carries the code */
export const shareFolder = (folder: string, mode: Share['mode'], options: { single?: boolean; duration?: number | null } = {}) => request<Share>('share', folder, mode, options);
/** Four words handing a share's key to a guest (`words.ts`): their numbers and when they run out */
export const shareWords = (id: string) => request<{ code: number[]; expires: number }>('shareWords', id);
export const endShare = (id: string) => request<void>('endShare', id);

/** Devices that have `path` (for “can't be reached right now”) */
export const holdersOf = (path: string) => request<string[]>('holders', path);

/** Runs an action in the leading tab (this one or another) */
function request<T>(...action: Action): Promise<T> {
	if (device) return run(action) as Promise<T>;
	if (!channel) return Promise.reject(new Error('P2P not started'));
	const id = crypto.randomUUID();
	return new Promise<T>((resolve, reject) => {
		waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
		channel!.postMessage({ request: action, id } satisfies Message);
	});
}

// --- Requests from the UI (any tab) ---

// Joining a group asks the browser to keep the storage (it must not clear the OPFS under storage pressure)
export const createGroup = (name: string) => (void requestPersistence(), request<void>('createGroup', name));
export const invite = () => request<{ code: string; expires: number }>('invite');
export const cancelInvites = () => request<void>('cancelInvites');
export const joinGroup = (code: string, name: string) => (void requestPersistence(), request<void>('join', code, name));
export const renameDevice = (name: string) => request<void>('rename', name);
export const removeDevice = (id: string) => request<void>('remove', id);
export const leaveGroup = () => request<void>('leave');
/** After this device was removed: back to “not connected” */
export const forgetGroup = () => request<void>('forget');
export const excludeFolder = (folder: string) => request<void>('exclude', folder);
export const includeFolder = (folder: string) => request<void>('include', folder);
export const syncDevicesNow = () => request<void>('syncNow');
export const applyDeviceDeletes = () => request<void>('applyDeletes');
/** After joining: the folders this device leaves out; then syncing starts */
export const finishSetup = (scope: string[]) => request<void>('finishSetup', scope);
/** A new folder held for confirmation comes to this device after all */
export const allowDeviceFolder = (folder: string) => request<void>('allowFolder', folder);
/** Sizes of the subfolders of `folder` per device (connected ones and this one) */
export const folderSizes = (folder: string) => withTimeout(request<Record<string, Record<string, number>>>('sizes', folder), folder, 15_000);
export const diagnostics = () => request<Diagnostics>('diagnostics');

/** Events of the sync (conflict copies, devices added/removed) in every tab */
export function onP2pEvent(handler: (event: DeviceEvent) => void): () => void {
	eventHandlers.add(handler);
	return () => eventHandlers.delete(handler);
}

// --- Diagnostics (expert view) ---

export interface Diagnostics {
	self: string;
	stun: string;
	relays: { url: string; connected: boolean }[];
	peers: { id: string; name: string; connection: string; rtt: number | null }[];
}

async function diagnosticsHere(): Promise<Diagnostics> {
	const d = device!;
	const { relayStates, STUN } = await import('./trystero.js');
	return {
		self: d.identity.id,
		stun: STUN,
		relays: relayStates(),
		peers: await d.connectionStats()
	};
}
