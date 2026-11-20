import { FilesError, noticed } from '../fs.js';
import { filesMessages } from '../i18n/index.svelte.js';
import { connectionOf, connectionRoot, join } from '../path.js';
import { listConnections, onConnectionsChanged, saveConnections, type Connection, type FolderConnection } from './registry.js';
import { beginShare, endShareSession } from './share.js';
import { syncedFolder } from '../sync/sync.svelte.js';
import { diskFoldersSupported } from '../handles.js';

// Connections for the UI (“Connected” in Files, the file dialog): list with access state, connect, rename,
// disconnect, allow access again. Each tab watches its connected folders itself and announces outside changes
// locally (`noticed`).

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
	/** Guest share: the sharing device ended it */
	ended?: boolean;
}

const folders = (list: Connection[]) => list.filter((c): c is FolderConnection => c.kind === 'folder');

export const connections = $state<{ list: ConnectionView[]; loaded: boolean }>({ list: [], loaded: false });

/** Name to show for a connection (a guest share names its folder and the device sharing it) */
export function connectionLabel(c: ConnectionView): string {
	const t = filesMessages().share;
	if (c.kind !== 'share') return c.name;
	return c.name ? t.connection(c.name, c.host ?? '') : t.pending;
}

/** Folders on disk can be connected */
export const connectionsSupported = diskFoldersSupported;

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
	// Access may have been allowed meanwhile (another tab, the browser's site settings)
	window.addEventListener('focus', () => void refresh());
	void refresh();
}

async function accessOf(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
	try {
		return (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
	} catch {
		return 'denied';
	}
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
					? { id: c.id, kind: c.kind, name: c.name, path: connectionRoot(c.id), access: 'granted', host: c.host, mode: c.mode, ended: c.ended }
					: { id: c.id, kind: c.kind, name: c.name, path: connectionRoot(c.id), access: await accessOf(c.handle) }
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
	if (!(e instanceof FilesError) || e.code !== 'denied') return undefined;
	const at = connectionOf(e.path);
	if (!at) return undefined;
	return {
		label: filesMessages().connected.allow,
		run: async () => {
			if (await allowAccess(at.id)) onAllowed?.();
		}
	};
}

/** Removes the connection; nothing in the folder is deleted (a guest share of this tab ends here) */
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
