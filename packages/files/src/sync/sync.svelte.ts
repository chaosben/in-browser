import { mkdir, remove, rootHandle, watch, writable } from '../fs.js';
import { basename, nameProblem, parent, segments } from '../path.js';
import { idbDelete, idbGet, idbSet } from './idb.js';
import { deletedLocalFiles, ignored, plan, type Base, type BaseEntry, type FileState, type Op, type Snapshot } from './plan.js';

// Sync of the shared file system with a folder on disk (File System Access API, Chromium only).
// - The folder handle and the state after the last run (`Base`) live in IndexedDB.
// - Every tool calls `startSync()`; one tab at a time (Web Lock `files:sync-leader`) runs the sync: on start,
//   after changes in the browser (`watch`), when the folder changes (`FileSystemObserver`, where available) and
//   every 30 s. The other tabs show its status (BroadcastChannel `files:sync`) and send it their requests.
// - It only runs while the browser grants access (`queryPermission`); asking again needs a click (`renewAccess`).
// - Deletions in the browser (Files, tools) always reach the folder. Deletions in the folder reach the browser
//   right away only when they are few; many at once, or a folder emptied completely, wait for confirmation
//   (`applyDeletes`/`restoreDeleted`) – it could also be a sync tool or drive acting up. No check is needed for the
//   browser side: when the browser clears its site data, the base in IndexedDB goes too, and the next run is a
//   first run that restores everything from the folder.

export interface SyncStatus {
	/** Name of the connected folder, `null` without one */
	folder: string | null;
	/** `paused`: no access (permission needed); `idle`: waiting for the next run */
	state: 'off' | 'paused' | 'idle' | 'syncing';
	lastSync: number | null;
	/** Files that could not be synced in the last run */
	failed: number;
	/** Files deleted in the folder, waiting for confirmation to be deleted in the browser too */
	pendingDeletes: number;
}

export const syncStatus = $state<SyncStatus>({
	folder: null,
	state: 'off',
	lastSync: null,
	failed: 0,
	pendingDeletes: 0
});

/** This tab runs the sync (otherwise another tab does) */
export const syncLeader = $state({ current: false });

export function syncSupported() {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

const HANDLE = 'handle';
const BASE = 'base';
const INTERVAL = 30_000;
/** From this many files deleted in the folder (and a quarter of all synced ones) deletions wait for confirmation */
const MANY_DELETES = 20;

type Request = 'run' | 'applyDeletes' | 'restoreDeleted' | 'status?';
type Message = { status: SyncStatus } | { request: Request };

let channel: BroadcastChannel | null = null;
let started = false;

function publish(patch: Partial<SyncStatus>) {
	Object.assign(syncStatus, patch);
	if (syncLeader.current) channel?.postMessage({ status: $state.snapshot(syncStatus) } satisfies Message);
}

function send(request: Request) {
	if (syncLeader.current) onRequest(request);
	else channel?.postMessage({ request } satisfies Message);
}

/** Starts the sync machinery in this tab (once per tab; call in the layout of every tool). */
export function startSync() {
	if (started || !syncSupported()) return;
	started = true;
	channel = new BroadcastChannel('files:sync');
	channel.onmessage = (e: MessageEvent<Message>) => {
		if ('status' in e.data) {
			if (!syncLeader.current) Object.assign(syncStatus, e.data.status);
		} else if (syncLeader.current) onRequest(e.data.request);
	};
	// Show the connected folder right away; the leader fills in the rest
	idbGet<FileSystemDirectoryHandle>(HANDLE).then((h) => h && !syncLeader.current && Object.assign(syncStatus, { folder: h.name }));
	channel.postMessage({ request: 'status?' } satisfies Message);
	navigator.locks.request('files:sync-leader', () => {
		syncLeader.current = true;
		lead();
		// Hold the lock as long as the tab lives
		return new Promise<never>(() => {});
	});
}

// --- Requests from the UI (any tab) ---

/** Lets the user pick the folder and starts syncing with it (needs a click). */
export async function connectFolder(): Promise<void> {
	const folder = await window.showDirectoryPicker({ id: 'in-browser-files', mode: 'readwrite' });
	const previous = await idbGet<FileSystemDirectoryHandle>(HANDLE);
	// Another folder: start from scratch (first run merges both sides, the newer version wins)
	if (!previous || !(await previous.isSameEntry(folder))) await idbDelete(BASE);
	await idbSet(HANDLE, folder);
	Object.assign(syncStatus, { folder: folder.name, state: 'idle', failed: 0, pendingDeletes: 0 });
	send('run');
}

/** Asks for access again (needs a click), then syncs. */
export async function renewAccess(): Promise<void> {
	const folder = await idbGet<FileSystemDirectoryHandle>(HANDLE);
	if ((await folder?.requestPermission?.({ mode: 'readwrite' })) === 'granted') send('run');
}

export function syncNow() {
	send('run');
}

/** Deletes the files waiting for confirmation in the browser as well. */
export function applyDeletes() {
	send('applyDeletes');
}

/** Copies the files waiting for confirmation back into the folder instead of deleting them. */
export function restoreDeleted() {
	send('restoreDeleted');
}

/** Stops syncing; deletes nothing. */
export async function disconnect(): Promise<void> {
	await idbDelete(HANDLE);
	await idbDelete(BASE);
	Object.assign(syncStatus, { folder: null, state: 'off', lastSync: null, failed: 0, pendingDeletes: 0 });
	send('status?');
}

// --- Leader ---

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;
/** The browser-side changes of a run itself must not trigger the next one */
let applying = false;
let deletesAllowed = false;
let pending: Op[] = [];

function onRequest(request: Request) {
	if (request === 'status?') publish({});
	if (request === 'applyDeletes') deletesAllowed = true;
	if (request === 'restoreDeleted') restorePending();
	schedule(0);
}

function lead() {
	watch(() => !applying && schedule(2000));
	setInterval(() => schedule(0), INTERVAL);
	schedule(0);
}

function schedule(delay: number) {
	clearTimeout(timer);
	timer = setTimeout(() => {
		if (running) again = true;
		else run().catch((e) => console.error('[Sync]', e));
	}, delay);
}

let observed: FileSystemDirectoryHandle | null = null;

/** Folder changes on disk trigger a run (Chromium 129+); otherwise the interval catches them */
async function observe(folder: FileSystemDirectoryHandle) {
	const Observer = (globalThis as { FileSystemObserver?: new (cb: () => void) => { observe(h: FileSystemHandle, o: { recursive: boolean }): Promise<void> } }).FileSystemObserver;
	if (!Observer || (observed && (await observed.isSameEntry(folder)))) return;
	observed = folder;
	await new Observer(() => !applying && schedule(2000)).observe(folder, { recursive: true }).catch(() => {});
}

async function run(): Promise<void> {
	running = true;
	try {
		const folder = await idbGet<FileSystemDirectoryHandle>(HANDLE);
		if (!folder) return publish({ folder: null, state: 'off' });
		if ((await folder.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
			return publish({ folder: folder.name, state: 'paused' });
		}
		publish({ folder: folder.name, state: 'syncing' });
		observe(folder);
		const base: Base = new Map((await idbGet<[string, BaseEntry][]>(BASE)) ?? []);
		const local = await scan(await rootHandle());
		const disk = await scan(folder);

		let ops = plan(local, disk, base);
		const deletes = deletedLocalFiles(ops);
		const emptied = deletes > 0 && countFiles(disk) === 0;
		let pendingDeletes = 0;
		if (!deletesAllowed && (emptied || (deletes >= MANY_DELETES && deletes * 4 > countBaseFiles(base)))) {
			pending = ops.filter(isLocalDelete);
			ops = ops.filter((op) => !isLocalDelete(op));
			pendingDeletes = deletes;
		} else pending = [];
		deletesAllowed = false;

		let failed = 0;
		applying = true;
		try {
			for (const [i, op] of ops.entries()) {
				try {
					await apply(op, folder, local, disk, base);
				} catch (e) {
					failed++;
					console.error('[Sync]', op, e);
				}
				if (i % 50 === 49) await saveBase(base);
			}
		} finally {
			applying = false;
		}
		await saveBase(base);
		publish({
			state: 'idle',
			lastSync: Date.now(),
			failed: failed + ops.filter((op) => op.type === 'conflict').length,
			pendingDeletes
		});
	} finally {
		running = false;
		if (again) {
			again = false;
			schedule(0);
		}
	}
}

const isLocalDelete = (op: Op) => op.type === 'deleteLocal';

/** Instead of deleting: drop the pending paths from the base, so the next run copies them back as new */
async function restorePending() {
	const base: Base = new Map((await idbGet<[string, BaseEntry][]>(BASE)) ?? []);
	for (const op of pending) base.delete(op.path);
	pending = [];
	await saveBase(base);
	publish({ pendingDeletes: 0 });
}

const saveBase = (base: Base) => idbSet(BASE, [...base]);
const countFiles = (snapshot: Snapshot) => [...snapshot.values()].filter((s) => s.kind === 'file').length;
const countBaseFiles = (base: Base) => [...base.values()].filter((b) => b.local.kind === 'file').length;

/** All files and folders below `dir` (paths from its root), without ignored ones */
async function scan(dir: FileSystemDirectoryHandle, prefix = '', into: Snapshot = new Map()): Promise<Snapshot> {
	for await (const [name, handle] of dir.entries()) {
		const path = `${prefix}/${name}`;
		if (ignored(path)) continue;
		if (handle.kind === 'directory') {
			into.set(path, { kind: 'directory', size: 0, modified: 0 });
			await scan(handle as FileSystemDirectoryHandle, path, into);
		} else {
			into.set(path, stateOf(await (handle as FileSystemFileHandle).getFile()));
		}
	}
	return into;
}

const stateOf = (file: File): FileState => ({ kind: 'file', size: file.size, modified: file.lastModified });
const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };

async function diskDir(root: FileSystemDirectoryHandle, path: string, create = false) {
	let dir = root;
	for (const name of segments(path)) dir = await dir.getDirectoryHandle(name, { create });
	return dir;
}

async function apply(op: Op, folder: FileSystemDirectoryHandle, local: Snapshot, disk: Snapshot, base: Base) {
	const { path } = op;
	switch (op.type) {
		case 'toDisk': {
			const source = await (await fileIn(await rootHandle(), path)).getFile();
			const target = await (await diskDir(folder, parent(path), true)).getFileHandle(basename(path), { create: true });
			await source.stream().pipeTo(await target.createWritable());
			base.set(path, { local: stateOf(source), disk: stateOf(await target.getFile()) });
			break;
		}
		case 'toLocal': {
			// Names that are fine on this disk but not everywhere (e.g. `a:b` on Linux) stay out of the browser
			if (segments(path).some((name) => nameProblem(name))) throw new Error(`Invalid name: ${path}`);
			const source = await (await fileIn(folder, path)).getFile();
			await source.stream().pipeTo(await writable(path));
			const target = await (await fileIn(await rootHandle(), path)).getFile();
			base.set(path, { local: stateOf(target), disk: stateOf(source) });
			break;
		}
		case 'mkdirDisk':
			await diskDir(folder, path, true);
			base.set(path, { local: DIR, disk: DIR });
			break;
		case 'mkdirLocal':
			if (segments(path).some((name) => nameProblem(name))) throw new Error(`Invalid name: ${path}`);
			await mkdir(path);
			base.set(path, { local: DIR, disk: DIR });
			break;
		case 'deleteLocal':
			// Folders only when empty: files that are new inside them stay (and get copied to the other side)
			if (op.kind === 'file' || (await isEmpty(await diskDir(await rootHandle(), path)))) await remove(path);
			base.delete(path);
			break;
		case 'deleteDisk': {
			const dir = await diskDir(folder, parent(path)).catch(() => null);
			if (dir && (op.kind === 'file' || (await isEmpty(await dir.getDirectoryHandle(basename(path)))))) {
				await dir.removeEntry(basename(path));
			}
			base.delete(path);
			break;
		}
		case 'remember':
			base.set(path, { local: local.get(path)!, disk: disk.get(path)! });
			break;
		case 'forget':
			base.delete(path);
			break;
		case 'conflict':
			break;
	}
}

async function fileIn(root: FileSystemDirectoryHandle, path: string) {
	return (await diskDir(root, parent(path))).getFileHandle(basename(path));
}

async function isEmpty(dir: FileSystemDirectoryHandle) {
	for await (const _ of dir.keys()) return false;
	return true;
}
