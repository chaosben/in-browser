import { watch } from '../fs.js';
import { filesMessages } from '../i18n/index.svelte.js';
import { idbDelete, idbGet, idbSet } from './idb.js';
import { runSync, treeSide } from './apply.js';
import { handleTree } from './handle-tree.js';
import { opfsTree } from './opfs-tree.js';
import type { Base, BaseEntry, Op } from './plan.js';
import { cleanTrash } from '../trash.js';
import { journal } from './journal.svelte.js';
import type { LogFn } from './log.js';
import { startP2p } from '../p2p/p2p.svelte.js';

// Sync of the shared file system with a folder on disk (File System Access API, Chromium only).
// `startSync()` also starts the P2P sync with other devices (`p2p/p2p.svelte.ts`), in every browser.
// - The folder handle and the state after the last run (`Base`) live in IndexedDB.
// - Every tool calls `startSync()`; one tab at a time (Web Lock `files:sync-leader`) runs the sync: on start,
//   after changes in the browser (`watch`), when the folder changes (`FileSystemObserver`, where available) and
//   every 30 s. The other tabs show its status (BroadcastChannel `files:sync`) and send it their requests.
// - It only runs while the browser grants access (`queryPermission`); asking again needs a click (`renewAccess`).
// - Planning and carrying out is shared with the P2P sync (`apply.ts`): nothing that changed since the plan is
//   overwritten or deleted, the losing version of a change on both sides becomes a conflict copy. The trash
//   (`/.in-browser-trash/`, `trash.ts`) is synced into the folder like any other folder.
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
/** Expired trash entries are removed this often */
const TRASH_INTERVAL = 60 * 60 * 1000;

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
	startP2p();
	startTrashCleaning();
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

let cleaning = false;

/** Expired trash entries go, in one tab at a time (every browser, also without a folder or other devices) */
function startTrashCleaning() {
	if (cleaning || typeof navigator === 'undefined' || !navigator.locks || !navigator.storage?.getDirectory) return;
	cleaning = true;
	const clean = () => navigator.locks.request('files:trash-clean', { ifAvailable: true }, async (lock) => lock && cleanTrash(opfsTree));
	setTimeout(clean, 5000);
	setInterval(clean, TRASH_INTERVAL);
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

/** Opt-in log (no-op until the leading tab has loaded it) */
let log: LogFn = () => {};

function lead() {
	void journal('folder').then((l) => (log = l.add));
	watch((paths) => {
		if (applying) return;
		log('folder.trigger', { reason: 'change in the browser', paths });
		schedule(2000);
	});
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
	await new Observer(() => {
		if (applying) return;
		log('folder.trigger', { reason: 'change in the folder' });
		schedule(2000);
	})
		.observe(folder, { recursive: true })
		.catch(() => {});
}

async function run(): Promise<void> {
	running = true;
	try {
		const folder = await idbGet<FileSystemDirectoryHandle>(HANDLE);
		if (!folder) return publish({ folder: null, state: 'off' });
		if ((await folder.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
			log('folder.paused', { folder: folder.name, reason: 'no permission' });
			return publish({ folder: folder.name, state: 'paused' });
		}
		publish({ folder: folder.name, state: 'syncing' });
		observe(folder);
		const disk = handleTree(folder);
		const base: Base = new Map((await idbGet<[string, BaseEntry][]>(BASE)) ?? []);
		const local = await opfsTree.scan();
		const remote = await disk.scan();
		log('folder.start', { folder: folder.name, local: local.size, disk: remote.size, base: base.size });

		const m = filesMessages();
		const allowDeletes = deletesAllowed;
		deletesAllowed = false;
		applying = true;
		let result;
		try {
			result = await runSync(opfsTree, treeSide(disk), local, remote, {
				base,
				saveBase,
				conflictLabel: (side) => m.p2p.conflictLabel(side === 'mine' ? m.folderSync.browser : m.folderSync.folder),
				hold: ['deleteLocal'],
				allowDeletes,
				// The log of the folder sync names its events `folder.…`
				log: (event, data) => log(event.replace(/^sync\./, 'folder.'), data)
			});
		} finally {
			applying = false;
		}
		pending = result.held;
		publish({ state: 'idle', lastSync: Date.now(), failed: result.failed, pendingDeletes: result.pendingDeletes });
		// Something changed while the run went on: plan again soon instead of waiting for the interval
		if (result.skipped) schedule(2000);
	} finally {
		running = false;
		if (again) {
			again = false;
			schedule(0);
		}
	}
}

/** Instead of deleting: drop the pending paths from the base, so the next run copies them back as new */
async function restorePending() {
	const base: Base = new Map((await idbGet<[string, BaseEntry][]>(BASE)) ?? []);
	for (const op of pending) base.delete(op.path);
	pending = [];
	await saveBase(base);
	publish({ pendingDeletes: 0 });
}

const saveBase = (base: Base) => idbSet(BASE, [...base]);
