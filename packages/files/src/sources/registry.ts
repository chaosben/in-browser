import { FilesError } from '../entry.js';
import { basename, connectionOf, isInside } from '../path.js';
import { inTrash } from '../trash.js';
import { idbGet, idbSet } from '../sync/idb.js';
import { folderSource } from './folder.js';
import { shareSession, shareSource } from './share.js';
import type { Source } from './source.js';

// The connections of this device (only here, never synced), kept in IndexedDB – the only storage that keeps a
// folder handle across visits. Every tab reads them itself (folders need no leading tab); changes reach the other tabs
// through `files:connections`.

export interface FolderConnection {
	id: string;
	kind: 'folder';
	/** Shown name (the folder's name at first, can be renamed) */
	name: string;
	handle: FileSystemDirectoryHandle;
}

/** A guest share opened in this tab (`share.ts`, from `sessionStorage`, never stored) */
export interface ShareConnection {
	id: 'share';
	kind: 'share';
	/** The shared folder's name (`''` until signed in) */
	name: string;
	host: string;
	mode: 'view' | 'edit' | null;
	/** The sharing device ended it */
	ended: boolean;
}

/** Foreseen: `'webdav'` */
export type Connection = FolderConnection | ShareConnection;

const KEY = 'connections';

let loaded: Promise<Map<string, { connection: Connection; source: Source }>> | null = null;
/** Names known so far (for messages, which can't wait) */
const names = new Map<string, string>();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function ensureChannel() {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel('files:connections');
	channel.onmessage = () => {
		loaded = null;
		listeners.forEach((l) => l());
	};
}

function sourceOf(connection: Connection): Source {
	if (connection.kind === 'share') {
		const session = shareSession();
		if (!session) throw new FilesError('ended', '/');
		return shareSource(session, () => {
			loaded = null;
			listeners.forEach((l) => l());
		});
	}
	return folderSource(connection.handle);
}

/** The guest share of this tab as a connection */
function shareConnection(): ShareConnection | null {
	if (typeof sessionStorage === 'undefined') return null;
	const session = shareSession();
	return session && { id: 'share', kind: 'share', name: session.folder ?? '', host: session.host ?? '', mode: session.mode ?? null, ended: !!session.ended };
}

function load() {
	ensureChannel();
	loaded ??= idbGet<Connection[]>(KEY).then((stored) => {
		names.clear();
		const map = new Map<string, { connection: Connection; source: Source }>();
		const share = shareConnection();
		for (const connection of [...(stored ?? []), ...(share ? [share] : [])]) {
			names.set(connection.id, connection.name);
			map.set(connection.id, { connection, source: sourceOf(connection) });
		}
		return map;
	});
	return loaded;
}

export async function listConnections(): Promise<Connection[]> {
	return [...(await load()).values()].map((entry) => entry.connection);
}

/** Stores the connections and tells every tab */
export async function saveConnections(list: Connection[]): Promise<void> {
	// A guest share lives only in its tab
	await idbSet(
		KEY,
		list.filter((c) => c.kind !== 'share')
	);
	loaded = null;
	ensureChannel();
	channel?.postMessage('changed');
	listeners.forEach((l) => l());
}

/** Calls `listener` when connections were added, removed or renamed (in any tab) */
export function onConnectionsChanged(listener: () => void): () => void {
	ensureChannel();
	listeners.add(listener);
	return () => listeners.delete(listener);
}

// --- Folders this device doesn't sync: opened live from another device ---

let devices: { source: Source; excluded: readonly string[] } | null = null;
let pending: { promise: Promise<void>; resolve: () => void } | null = null;
/** How long a call waits for the folder choice of this device before working locally */
const READY_TIMEOUT = 3000;

/** The device sync is starting: until `setDevicesSource`, calls wait (at most 3 s) for the folder choice */
export function expectDevices(): void {
	if (devices || pending) return;
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	pending = { promise, resolve };
	setTimeout(resolve, READY_TIMEOUT);
}

/** The source for folders this device doesn't sync and the current list of them (called on every change) */
export function setDevicesSource(source: Source, excluded: readonly string[]): void {
	devices = { source, excluded };
	pending?.resolve();
	pending = null;
}

/** The folder this device doesn't sync that `path` lies in (the trash never counts), `null` otherwise */
export function excludedFolderOf(path: string): string | null {
	if (!devices || inTrash(path) || connectionOf(path)) return null;
	return devices.excluded.find((folder) => isInside(path, folder)) ?? null;
}

/** Folders this device doesn't sync that lie directly in `folder` (shown there although they aren't here) */
export function excludedIn(folder: string): string[] {
	if (!devices) return [];
	return devices.excluded.filter((f) => f !== folder && isInside(f, folder) && f.slice(folder === '/' ? 1 : folder.length + 1).indexOf('/') === -1);
}

export interface At {
	source: Source;
	/** Root of the place in the path space (`/:c/<id>`; `/` for devices) */
	root: string;
	inner: string;
	/** Same key = same place (moves stay inside it) */
	key: string;
}

/** Where a path lives if not in My files on this device: a connected folder or another device; `null` for local */
export async function sourceAt(path: string): Promise<At | null> {
	const at = connectionOf(path);
	if (at) {
		const entry = (await load()).get(at.id);
		if (!entry) throw new FilesError('notFound', path);
		return { source: entry.source, root: at.root, inner: at.inner, key: at.id };
	}
	if (pending) await pending.promise;
	if (devices && excludedFolderOf(path)) return { source: devices.source, root: '/', inner: path, key: 'devices' };
	return null;
}

/** Name to show for a path: the connection's name for its root, otherwise the last part */
export function displayName(path: string): string {
	const at = connectionOf(path);
	if (at && at.inner === '/') return names.get(at.id) ?? at.id;
	return basename(path);
}

/** Location to show for a path: `rootName` (“My files”) for `/`, the connection's name instead of `/:c/<id>` */
export function displayPath(path: string, rootName: string): string {
	const at = connectionOf(path);
	if (!at) return path === '/' ? rootName : path;
	const name = names.get(at.id) ?? at.id;
	return at.inner === '/' ? name : name + at.inner;
}
