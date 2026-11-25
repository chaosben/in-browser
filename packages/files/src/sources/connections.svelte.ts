import { FilesError, noticed } from '../fs.js';
import { filesMessages } from '../i18n/index.svelte.js';
import { connectionOf, connectionRoot, join } from '../path.js';
import {
	listConnections,
	onConnectionsChanged,
	remoteSource,
	saveConnections,
	type Connection,
	type FolderConnection,
	type RemoteConnection,
	type S3Connection,
	type WebDavConnection
} from './registry.js';
import { seal } from './secrets.js';
import { allowShareSync, beginShare, codeFromWords, endShareSession, onShareSync, shareSyncState } from './share.js';
import type { ShareSyncState } from './share-sync.js';
import { parseWords, wordLists } from '../p2p/words.js';
import { syncedFolder } from '../sync/sync.svelte.js';
import { diskFoldersSupported, folderAccess } from '../handles.js';

// Connections for the UI (“Connected” in Files, the file dialog): list with access state, connect, rename,
// disconnect, allow access again, connect and edit servers (WebDAV, S3). Each tab watches its connected folders itself
// and announces outside changes locally (`noticed`); servers can't tell, so their roots are announced when the tab
// comes to the front and every 30 s while it is visible (views reload calmly, showing the old list until the new one).

export interface ConnectionView {
	id: string;
	kind: Connection['kind'];
	name: string;
	/** Root path (`/:c/<id>`) */
	path: string;
	/** `granted`: usable; otherwise “Allow access” needs a click */
	access: PermissionState;
	/** Guest share: the device that shares it and whether it can be changed (`null` until signed in) */
	host?: string;
	mode?: 'view' | 'edit' | null;
	/** Guest share: the sharing device ended it, or it ran out */
	ended?: boolean;
	/** Guest share of one file or package (it opens in its tool) */
	single?: boolean;
	/** Guest share: when it runs out (ms since 1970) */
	expires?: number | null;
	/** Guest share: how the sync of its copy here stands (`null`: not known yet) */
	sync?: ShareSyncState | null;
}

const folders = (list: Connection[]) => list.filter((c): c is FolderConnection => c.kind === 'folder');

export const connections = $state<{ list: ConnectionView[]; loaded: boolean }>({ list: [], loaded: false });

/** Name to show for a connection (a guest share names its folder and the device sharing it) */
export function connectionLabel(c: ConnectionView): string {
	const t = filesMessages().share;
	if (c.kind !== 'share') return c.name;
	return c.name ? t.connection(c.name, c.host ?? '') : t.pending;
}

/** Something can be connected: servers in every browser */
export const connectionsSupported = () => true;

/** Folders on disk can be connected (Chromium on a computer) */
export const diskConnectionsSupported = diskFoldersSupported;

/** How often the roots of server connections are announced as changed while the tab is visible */
const REMOTE_INTERVAL = 30_000;

type Observer = { observe(handle: FileSystemHandle, options: { recursive: boolean }): Promise<void>; disconnect(): void };
type ObserverRecord = { type: string; relativePathComponents: string[] };
const ObserverClass = (globalThis as { FileSystemObserver?: new (cb: (records: ObserverRecord[]) => void) => Observer }).FileSystemObserver;
const observers = new Map<string, Observer>();

let started = false;

/** Loads the connections and keeps them current in this tab (called by `startSync()` in every tool) */
export function startConnections() {
	if (started || typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
	started = true;
	onConnectionsChanged(() => void refresh());
	// The copy of a guest share: its sync's state
	onShareSync(() => {
		const share = connections.list.find((c) => c.kind === 'share');
		if (share) share.sync = shareSyncState();
	});
	// Access may have been allowed meanwhile (another tab, the browser's site settings)
	window.addEventListener('focus', () => {
		void refresh();
		noticeRemote();
	});
	document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && noticeRemote());
	setInterval(() => document.visibilityState === 'visible' && noticeRemote(), REMOTE_INTERVAL);
	void refresh();
}

/** Servers don't report changes: views of their folders load again */
function noticeRemote() {
	const remote = connections.list.filter((c) => c.kind === 'webdav' || c.kind === 's3');
	if (remote.length) noticed(...remote.map((c) => c.path));
}

async function accessOf(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
	return folderAccess(handle);
}

/** Reads the connections and their access state again */
export async function refresh(): Promise<void> {
	const list = await listConnections().catch((e: unknown) => {
		console.error(e);
		return [];
	});
	const views = await Promise.all(
		list.map(
			async (c): Promise<ConnectionView> =>
				c.kind === 'share'
					? { id: c.id, kind: c.kind, name: c.name, path: connectionRoot(c.id), access: 'granted', host: c.host, mode: c.mode, ended: c.ended, single: c.single, expires: c.expires, sync: shareSyncState() }
					: c.kind === 'folder'
						? { id: c.id, kind: c.kind, name: c.name, path: connectionRoot(c.id), access: await accessOf(c.handle) }
						: { id: c.id, kind: c.kind, name: c.name, path: connectionRoot(c.id), access: 'granted' }
		)
	);
	const changedAccess = views.some((v) => connections.list.find((o) => o.id === v.id)?.access !== v.access);
	connections.list = views;
	connections.loaded = true;
	watchFolders(list, views);
	// Newly allowed or withdrawn: views of these folders load again
	if (changedAccess) noticed(...views.map((v) => v.path));
}

function watchFolders(list: Connection[], views: ConnectionView[]) {
	for (const [id, observer] of observers) {
		if (!views.some((v) => v.id === id && v.access === 'granted')) {
			observer.disconnect();
			observers.delete(id);
		}
	}
	if (!ObserverClass) return;
	for (const connection of folders(list)) {
		if (observers.has(connection.id) || views.find((v) => v.id === connection.id)?.access !== 'granted') continue;
		const root = connectionRoot(connection.id);
		const observer = new ObserverClass((records) => {
			const paths = new Set<string>();
			for (const record of records) {
				const parts = record.relativePathComponents ?? [];
				paths.add(join(root, ...parts));
				paths.add(join(root, ...parts.slice(0, -1)));
			}
			noticed(...paths);
		});
		observers.set(connection.id, observer);
		observer.observe(connection.handle, { recursive: true }).catch((e: unknown) => console.error(e));
	}
}

/**
 * Lets the user pick a folder on disk and connects it (needs a click). Returns its root path and whether it is also
 * the folder My files sync with; `null` if canceled.
 */
export async function connectFolder(): Promise<{ path: string; alsoSynced: boolean } | null> {
	let handle: FileSystemDirectoryHandle;
	try {
		handle = await window.showDirectoryPicker({ id: 'in-browser-connected', mode: 'readwrite' });
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') return null;
		throw e;
	}
	const list = await listConnections();
	for (const c of folders(list)) if (await c.handle.isSameEntry(handle)) return { path: connectionRoot(c.id), alsoSynced: false };
	const synced = await syncedFolder();
	const alsoSynced = !!synced && (await synced.isSameEntry(handle));
	const id = crypto.randomUUID().slice(0, 8);
	await saveConnections([...list, { id, kind: 'folder', name: handle.name, handle }]);
	return { path: connectionRoot(id), alsoSynced };
}

/** What the user types to connect a server (the secret is the password or secret access key) */
export type RemoteInput =
	| { kind: 'webdav'; name: string; url: string; username: string; secret: string }
	| { kind: 's3'; name: string; endpoint: string; region: string; bucket: string; prefix: string; pathStyle: boolean; accessKeyId: string; secret: string };

/** A stored server connection without its secret (to fill the edit dialog) */
export type RemoteDetails = Omit<WebDavConnection, 'secret'> | Omit<S3Connection, 'secret'>;

export async function remoteDetails(id: string): Promise<RemoteDetails | null> {
	const found = (await listConnections()).find((c): c is RemoteConnection => c.id === id && (c.kind === 'webdav' || c.kind === 's3'));
	if (!found) return null;
	const { secret: _, ...details } = found;
	return details;
}

/**
 * Connects a server, or changes the connection `id` (an empty secret keeps the stored one). It is tried first – the
 * top folder must list – and stored only when that works. Returns its root path.
 */
export async function connectRemote(input: RemoteInput, id?: string): Promise<string> {
	const list = await listConnections();
	const previous = id ? list.find((c): c is RemoteConnection => c.id === id && c.kind === input.kind) : undefined;
	const secret = input.secret ? await seal(input.secret) : previous?.secret;
	if (!secret) throw new FilesError('credentials', '/');
	const connectionId = previous?.id ?? crypto.randomUUID().slice(0, 8);
	const { secret: _, ...fields } = input;
	const connection = { ...fields, id: connectionId, secret } as RemoteConnection;
	// Errors name the root of the new connection
	try {
		await remoteSource(connection).list('/');
	} catch (e) {
		if (e instanceof FilesError) throw new FilesError(e.code, connectionRoot(connectionId));
		throw e;
	}
	await saveConnections(previous ? list.map((c) => (c.id === connectionId ? connection : c)) : [...list, connection]);
	noticed(connectionRoot(connectionId));
	return connectionRoot(connectionId);
}

/** Opens the dialog that changes a server connection (set by Files; elsewhere Files opens in a new tab) */
export const connectionEditor = { open: null as ((id: string) => void) | null };

/** Asks the browser for access again (needs a click) */
export async function allowAccess(id: string): Promise<boolean> {
	const connection = folders(await listConnections()).find((c) => c.id === id);
	const state = await connection?.handle.requestPermission?.({ mode: 'readwrite' });
	await refresh();
	return state === 'granted';
}

/**
 * For error messages: when `e` says the browser no longer allows access to a connected folder, the action that asks
 * again (a click on it is the user activation the browser needs) – `onAllowed` runs once access is back.
 */
export function accessAction(e: unknown, onAllowed?: () => void): { label: string; run: () => Promise<void> } | undefined {
	if (!(e instanceof FilesError) || (e.code !== 'denied' && e.code !== 'credentials')) return undefined;
	const at = connectionOf(e.path);
	if (!at) return undefined;
	// A server refused the sign-in data: change them (Files' dialog; in another tool, Files opens next to it)
	if (e.code === 'credentials') {
		return {
			label: filesMessages().connected.editCredentials,
			run: async () => {
				if (connectionEditor.open) connectionEditor.open(at.id);
				else window.open(`/files?edit=${encodeURIComponent(at.id)}`, '_blank', 'noopener');
			}
		};
	}
	return {
		label: filesMessages().connected.allow,
		run: async () => {
			if (await allowAccess(at.id)) onAllowed?.();
		}
	};
}

/** The guest agrees to fetch a share it was asked about (large, or not fitting the free storage) */
export const fetchShare = allowShareSync;

/** Removes the connection; nothing in the folder is deleted (the guest share of this browser ends here, with its
 * copy in this browser) */
export async function disconnect(id: string): Promise<void> {
	if (id === 'share') endShareSession();
	await saveConnections((await listConnections()).filter((c) => c.id !== id));
}

/** Opens a guest share from its link in this tab; its root path */
export async function openShare(code: string): Promise<string> {
	beginShare(code);
	await saveConnections(await listConnections());
	return connectionRoot('share');
}

/**
 * Opens a guest share from its four words (`p2p/words.ts`): the sharing device hands its key over, then it opens like
 * a link. Its root path; throws `FilesError` `ended` (unknown, used or run-out words) or `offline` (nobody answered),
 * and `notFound` for text that isn't four known words.
 */
export async function openShareByWords(text: string): Promise<string> {
	const code = parseWords(text, await wordLists());
	if (!code) throw new FilesError('notFound', '/');
	const key = await codeFromWords(code, async () => (await import('../p2p/trystero.js')).trysteroNetwork);
	return openShare(key);
}
