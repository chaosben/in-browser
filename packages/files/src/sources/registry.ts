import { FilesError } from '../entry.js';
import { basename, connectionOf } from '../path.js';
import { idbGet, idbSet } from '../sync/idb.js';
import { folderSource } from './folder.js';
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

/** Foreseen: `'device' | 'share' | 'webdav'` */
export type Connection = FolderConnection;

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
	return folderSource(connection.handle);
}

function load() {
	ensureChannel();
	loaded ??= idbGet<Connection[]>(KEY).then((list) => {
		names.clear();
		const map = new Map<string, { connection: Connection; source: Source }>();
		for (const connection of list ?? []) {
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
	await idbSet(KEY, list);
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

/** Source of a connected path and the path inside it; `notFound` for an unknown connection */
export async function sourceAt(path: string): Promise<{ source: Source; root: string; inner: string } | null> {
	const at = connectionOf(path);
	if (!at) return null;
	const entry = (await load()).get(at.id);
	if (!entry) throw new FilesError('notFound', path);
	return { source: entry.source, root: at.root, inner: at.inner };
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
