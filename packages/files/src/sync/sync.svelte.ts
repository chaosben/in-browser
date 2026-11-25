import { askAccess, startConnections } from '../sources/connections.svelte.js';
import { watch } from '../fs.js';
import { filesMessages } from '../i18n/index.svelte.js';
import { diskFoldersSupported, folderAccessAnswer, isStuck, setStuck } from '../handles.js';
import { idbDelete, idbGet, idbSet } from './idb.js';
import { runSync } from './apply.js';
import { treeSide } from './tree-ops.js';
import { handleTree } from './handle-tree.js';
import { opfsTree } from './opfs-tree.js';
import type { Base, BaseEntry, HeldFolder, Op } from './plan.js';
import { askAboveOf } from '../settings.js';
import { storageEstimate } from '../cache.js';
import { cleanTrash } from '../trash.js';
import { journal } from './journal.svelte.js';
import type { LogFn } from './log.js';
import { excludedNow, startP2p } from '../p2p/p2p.svelte.js';
import { exclude, intersect } from '../p2p/scope.js';

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
// - The folder has its own excluded folders (`folderScope`): excluding deletes nothing on either side, the folder
//   just isn't compared anymore (it falls out of the base too, so taking it in again merges like a first run).
// - A newly chosen folder starts in `setup`: nothing is transferred until the user picked the folders.
// - New folders arriving in the browser that reach the suite setting `sync.askAbove` or don't fit into the browser's
//   free space wait for confirmation (`pendingFolders`: `allowFolder` / `excludeFromFolderSync`).

export interface SyncStatus {
	/** Name of the synced folder, `null` without one */
	folder: string | null;
	/** `paused`: no access (permission needed); `setup`: waits for the folder choice; `idle`: waiting for the next run */
	state: 'off' | 'paused' | 'setup' | 'idle' | 'syncing';
	lastSync: number | null;
	/** Files that could not be synced in the last run */
	failed: number;
	/** Files deleted in the folder, waiting for confirmation to be deleted in the browser too */
	pendingDeletes: number;
	/** New folders from the folder on disk waiting for confirmation before they come into the browser */
	pendingFolders: HeldFolder[];
	/** The folder's own excluded folders */
	scope: string[];
}

export const syncStatus = $state<SyncStatus>({
	folder: null,
	state: 'off',
	lastSync: null,
	failed: 0,
	pendingDeletes: 0,
	pendingFolders: [],
	scope: []
});

/** This tab runs the sync (otherwise another tab does) */
export const syncLeader = $state({ current: false });

/** A folder on disk can be synced */
export const syncSupported = diskFoldersSupported;

const HANDLE = 'handle';
const BASE = 'base';
/** Excluded folders of the synced folder */
const SCOPE = 'folder-scope';
/** The folder was chosen, the folder choice is still open */
const SETUP = 'folder-setup';
/** New folders the user let through */
const ALLOWED = 'folder-allowed';
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
	startConnections();
	startTrashCleaning();
	if (started || !syncSupported()) return;
	started = true;
	channel = new BroadcastChannel('files:sync');
	channel.onmessage = (e: MessageEvent<Message>) => {
		if ('status' in e.data) {
			if (!syncLeader.current) Object.assign(syncStatus, e.data.status);
		} else if (syncLeader.current) onRequest(e.data.request);
	};
	// Show the synced folder right away; the leader fills in the rest
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
export async function chooseSyncFolder(): Promise<void> {
	const folder = await window.showDirectoryPicker({ id: 'in-browser-files', mode: 'readwrite' });
	const previous = await idbGet<FileSystemDirectoryHandle>(HANDLE);
	// Another folder: start from scratch (first run merges both sides, the newer version wins)
	if (!previous || !(await previous.isSameEntry(folder))) {
		await idbDelete(BASE);
		await idbDelete(SCOPE);
		await idbDelete(ALLOWED);
		// Nothing moves until the user has seen what would
		await idbSet(SETUP, true);
	}
	await idbSet(HANDLE, folder);
	Object.assign(syncStatus, { folder: folder.name, state: (await idbGet<boolean>(SETUP)) ? 'setup' : 'idle', failed: 0, pendingDeletes: 0, pendingFolders: [] });
	send('run');
}

/** The synced folder's excluded folders */
export const folderScope = async () => (await idbGet<string[]>(SCOPE)) ?? [];

/** Sets the folders the synced folder leaves out and ends the setup: syncing starts */
export async function setFolderScope(scope: string[]): Promise<void> {
	await idbSet(SCOPE, [...scope].sort());
	await idbDelete(SETUP);
	Object.assign(syncStatus, { scope, state: syncStatus.state === 'setup' ? 'idle' : syncStatus.state });
	send('run');
}

/** A new folder waiting for confirmation comes into the browser after all */
export async function allowFolder(path: string): Promise<void> {
	const allowed = (await idbGet<string[]>(ALLOWED)) ?? [];
	await idbSet(ALLOWED, [...new Set([...allowed, path])]);
	send('run');
}

/** A folder isn't compared with the synced folder anymore (deletes nothing on either side) */
export async function excludeFromFolderSync(path: string): Promise<void> {
	await setFolderScope(exclude(await folderScope(), path));
}

/** Asks for access again (needs a click), then syncs. */
/** Key of the synced folder among the handles the browser doesn't answer for (`isStuck`) */
const STUCK_KEY = 'sync';

/**
 * Asks the browser for access to the synced folder again (needs a click). Never a dead end: a no or an error offers
 * to choose the folder anew, a question left unanswered a reload, after which this picks the folder anew. Choosing
 * the same folder keeps everything (`chooseSyncFolder`); `onSetup` runs when another folder now waits for its setup.
 */
export async function renewAccess(onSetup?: () => void): Promise<void> {
	const folder = await idbGet<FileSystemDirectoryHandle>(HANDLE);
	if (!folder) return;
	const again = async () => {
		try {
			await chooseSyncFolder();
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			throw e;
		}
		setStuck(STUCK_KEY, false);
		if (syncStatus.state === 'setup') onSetup?.();
	};
	if (isStuck(STUCK_KEY)) return again();
	const t = filesMessages().connected;
	const allowed = await askAccess(folder, {
		again: { label: t.chooseAgain, run: again },
		// The hanging question keeps the picker from opening: after a reload “Allow access” picks the folder anew
		silent: {
			label: t.reload,
			run: () => {
				setStuck(STUCK_KEY, true);
				location.reload();
			}
		}
	});
	if (allowed) send('run');
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

/** The synced folder, if one is chosen */
export const syncedFolder = () => idbGet<FileSystemDirectoryHandle>(HANDLE);

/** Stops syncing; deletes nothing. */
export async function stopFolderSync(): Promise<void> {
	for (const key of [HANDLE, BASE, SCOPE, SETUP, ALLOWED]) await idbDelete(key);
	Object.assign(syncStatus, { folder: null, state: 'off', lastSync: null, failed: 0, pendingDeletes: 0, pendingFolders: [], scope: [] });
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
	// The folder at once (other tabs ask for the status right away – before the first run it said “none”)
	void idbGet<FileSystemDirectoryHandle>(HANDLE).then((h) => h && !syncStatus.folder && publish({ folder: h.name }));
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
		// (unanswered counts as not allowed: the folder shows as paused, and “Allow access” asks again with a click)
		const answer = await folderAccessAnswer(folder);
		// Not answered: asking would hang too, so “Allow access” in this tab picks the folder anew
		if (answer === 'silent') setStuck(STUCK_KEY, true);
		const permission = answer === 'silent' ? 'prompt' : answer;
		if (permission !== 'granted') {
			log('folder.paused', { folder: folder.name, reason: 'no permission' });
			return publish({ folder: folder.name, state: 'paused' });
		}
		const scope = await folderScope();
		if (await idbGet<boolean>(SETUP)) {
			log('folder.paused', { folder: folder.name, reason: 'waiting for the folder choice' });
			return publish({ folder: folder.name, state: 'setup', scope });
		}
		publish({ folder: folder.name, state: 'syncing', scope });
		observe(folder);
		const disk = handleTree(folder);
		// Folders this device doesn't sync with the other devices aren't here: the folder on disk keeps them as they are.
		// Neither are the folder's own excluded ones (both sides keep them, they're just not compared)
		const excluded = excludedNow();
		const base: Base = intersect(new Map((await idbGet<[string, BaseEntry][]>(BASE)) ?? []), excluded, scope);
		const local = intersect(await opfsTree.scan(), excluded, scope);
		const remote = intersect(await disk.scan(), excluded, scope);
		const allowed = (await idbGet<string[]>(ALLOWED)) ?? [];
		const limit = await askAboveOf(opfsTree);
		const estimate = await storageEstimate().catch(() => null);
		const free = estimate?.quota !== undefined ? estimate.quota - (estimate.usage ?? 0) : null;
		log('folder.start', { folder: folder.name, local: local.size, disk: remote.size, base: base.size, scope });

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
				// Only what comes into the browser counts (its storage is limited; the disk's isn't ours to judge)
				holdLarge: { limit: { in: limit, out: null }, free: { in: free }, allowed, directions: ['in'] },
				// The log of the folder sync names its events `folder.…`
				log: (event, data) => log(event.replace(/^sync\./, 'folder.'), data)
			});
		} finally {
			applying = false;
		}
		pending = result.held;
		// A let-through folder that exists here now is no longer new: its entry can go
		const stillAllowed = [];
		for (const path of allowed) if (!(await opfsTree.stat(path).catch(() => null))) stillAllowed.push(path);
		if (stillAllowed.length !== allowed.length) await idbSet(ALLOWED, stillAllowed);
		publish({ state: 'idle', lastSync: Date.now(), failed: result.failed, pendingDeletes: result.pendingDeletes, pendingFolders: result.heldFolders });
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
