import { requestPersistence } from '../cache.js';
import { watch } from '../fs.js';
import { filesMessages } from '../i18n/index.svelte.js';
import type { Device, DeviceEvent, P2pView } from './device.js';
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

const EMPTY: P2pView = { state: 'off', self: null, devices: [], invite: null, scope: [], pendingDeletes: 0, failed: 0, lastSync: 0 };

export const p2pStatus = $state<P2pStatus>({ supported: true, view: EMPTY });

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
	| ['sizes', string]
	| ['diagnostics'];

type Message =
	| { status: P2pView }
	| { event: DeviceEvent }
	| { request: Action; id: string }
	| { reply: string; value?: unknown; error?: string }
	| { hello: true };

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
			if (!device) p2pStatus.view = message.status;
		} else if ('event' in message) {
			eventHandlers.forEach((handler) => handler(message.event));
		} else if ('request' in message) {
			if (device) run(message.request).then(
				(value) => channel?.postMessage({ reply: message.id, value } satisfies Message),
				(error: unknown) => channel?.postMessage({ reply: message.id, error: error instanceof Error ? error.message : String(error) } satisfies Message)
			);
		} else if ('reply' in message) {
			const pending = waiting.get(message.reply);
			waiting.delete(message.reply);
			if (message.error !== undefined) pending?.reject(new Error(message.error));
			else pending?.resolve(message.value);
		} else if ('hello' in message && device) {
			channel?.postMessage({ status: device.view() } satisfies Message);
		}
	};
	channel.postMessage({ hello: true } satisfies Message);
	ed25519Supported().then((ok) => {
		p2pStatus.supported = ok;
		if (!ok) return;
		navigator.locks.request('files:p2p-leader', async () => {
			await lead();
			return new Promise<never>(() => {});
		});
	});
}

async function lead() {
	const log = await journal('p2p');
	// Loaded only in the leading tab (Trystero and its Nostr crypto are not needed elsewhere)
	const [{ Device }, { idbStore }, { opfsTree }, { trysteroNetwork }] = await Promise.all([
		import('./device.js'),
		import('./store.js'),
		import('../sync/opfs-tree.js'),
		import('./trystero.js')
	]);
	device = new Device({
		store: idbStore,
		tree: opfsTree,
		network: trysteroNetwork,
		conflictLabel: (name) => filesMessages().p2p.conflictLabel(name),
		log: log.add,
		onChange: (view) => {
			p2pStatus.view = view;
			channel?.postMessage({ status: view } satisfies Message);
		},
		onEvent: (event) => {
			eventHandlers.forEach((handler) => handler(event));
			channel?.postMessage({ event } satisfies Message);
		}
	});
	watch((paths) => void device?.localChange(paths));
	await device.start();
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
			return d.join(action[1], action[2]);
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
	}
}

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
/** Sizes of the subfolders of `folder` per device (connected ones and this one) */
export const folderSizes = (folder: string) => request<Record<string, Record<string, number>>>('sizes', folder);
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
