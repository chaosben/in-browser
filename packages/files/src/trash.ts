import { FilesError } from './entry.js';
import { basename, isInside, join, normalize, parent, segments, uniqueName } from './path.js';
import { parseRaw, SCHEMA, storedValue, SUITE_SETTINGS } from './settings.js';
import type { Tree } from './sync/tree.js';

// The trash: what the user deletes (in Files, or a project in its tool) is moved into the hidden folder
// `/.in-browser-trash/` of the shared file system instead of being gone. It syncs like everything else – to every
// device, into the synced folder on disk and to the p2p-node – so it can be restored anywhere. One entry per deleted
// file or folder: `/.in-browser-trash/<entry>/.trashinfo.json` (where it was, when) plus the item under its full
// original path (`…/<entry>/Docs/Plan.md`), so the folder choice of a device applies to it without reading anything.
// Entries are removed after the retention the user picked (suite settings, `settings.ts` – synced as well).
// What the syncs delete or replace because another side did is not kept (the syncs keep no versions).

export const TRASH_ROOT = '/.in-browser-trash';
export const TRASH_INFO = '.trashinfo.json';

export interface TrashInfo {
	/** Where the item was */
	path: string;
	kind: 'file' | 'directory';
	/** When it was deleted (ms) */
	deleted: number;
}

/** Days entries stay; `null`: until the user empties the trash */
export type Retention = number | null;
export const RETENTIONS: readonly Retention[] = SCHEMA.trash.settings.days.options;
export const DEFAULT_RETENTION: Retention = SCHEMA.trash.settings.days.default;

/** Where earlier versions kept the setting (`trashDays`; still read while the suite settings don't hold it) */
export const SETTINGS_PATH = '/.apps/files/settings.json';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Name of a new entry (sortable by time; valid on every system) */
export function entryName(now: number): string {
	const d = new Date(now);
	const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}-${pad(d.getUTCMilliseconds(), 3)}`;
	return `${stamp}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;
}

/** Time of an entry, `null` for anything else in the trash folder */
export function parseEntry(name: string): number | null {
	const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})-[a-z0-9]{4}$/.exec(name);
	if (!match) return null;
	const [y, mo, d, h, mi, s, ms] = match.slice(1).map(Number);
	return Date.UTC(y, mo - 1, d, h, mi, s, ms);
}

export const entryPath = (entry: string) => `${TRASH_ROOT}/${entry}`;
export const infoPath = (entry: string) => `${TRASH_ROOT}/${entry}/${TRASH_INFO}`;
/** Where an item deleted from `original` lies in its entry */
export const itemPath = (entry: string, original: string) => `${TRASH_ROOT}/${entry}${original}`;

/** The path lies in the trash */
export const inTrash = (path: string) => isInside(path, TRASH_ROOT);

/** For a path inside a trash entry: where it was before (`null` for the trash folder, entries and their info) */
export function originalPath(path: string): string | null {
	if (!inTrash(path)) return null;
	const rest = segments(path).slice(2);
	if (!rest.length || (rest.length === 1 && rest[0] === TRASH_INFO)) return null;
	return '/' + rest.join('/');
}

/**
 * Whether an entry is due for removal. Clocks of devices differ, and removing an entry syncs to all of them: so an
 * entry counts from the later of two times – the one in its name (the deleting device's clock) and `seen`, when this
 * device got it (its info file's time here, this device's own clock). A device whose clock is ahead then keeps what
 * arrives for the whole retention instead of emptying everybody's trash; an entry named by a clock that is behind
 * lasts as long on the others.
 */
export function expired(entry: string, now: number, retention: Retention, seen = 0): boolean {
	const time = parseEntry(entry);
	if (time === null || retention === null) return false;
	return now - Math.max(time, seen) > retention * 24 * 60 * 60 * 1000;
}

/** The retention from the settings file's text (default when unset; a broken file keeps everything) */
export function parseRetention(text: string | null): Retention {
	if (text === null) return DEFAULT_RETENTION;
	try {
		const value = (JSON.parse(text) as { trashDays?: unknown }).trashDays;
		if (value === null) return null;
		if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
	} catch {
		return null;
	}
	return DEFAULT_RETENTION;
}

/** The retention in the suite settings' text: `undefined` when it holds none, `null` (keep everything) when broken */
export function suiteRetention(text: string): Retention | undefined {
	const raw = parseRaw(text);
	if (!raw) return null;
	return storedValue(raw, 'trash', 'days') as Retention | undefined;
}

/** The retention as stored (throws when a file exists but can't be read: a cleanup then waits) */
export async function retentionOf(tree: Pick<Tree, 'stat' | 'read'>): Promise<Retention> {
	if (await tree.stat(SUITE_SETTINGS)) {
		const days = suiteRetention(await (await tree.read(SUITE_SETTINGS)).text());
		if (days !== undefined) return days;
	}
	if (!(await tree.stat(SETTINGS_PATH))) return DEFAULT_RETENTION;
	return parseRetention(await (await tree.read(SETTINGS_PATH)).text());
}

/**
 * Removes the expired entries (on every device alike – the removals sync like any deletion; errors are only logged,
 * the next round tries again)
 */
export async function cleanTrash(tree: Pick<Tree, 'stat' | 'read' | 'names' | 'remove'>, now = Date.now()): Promise<void> {
	try {
		const retention = await retentionOf(tree);
		if (retention === null) return;
		for (const entry of await tree.names(TRASH_ROOT)) {
			// No info: still arriving (or not an entry) – never judged by its name alone
			const info = await tree.stat(infoPath(entry));
			if (info && expired(entry, now, retention, info.modified)) await tree.remove(entryPath(entry));
		}
	} catch (e) {
		console.warn('[Trash] cleanup failed', e);
	}
}

/** The info of a trash entry, `null` when it is missing or unreadable (not an entry to show or restore) */
export async function readTrashInfo(tree: Pick<Tree, 'read'>, entry: string): Promise<TrashInfo | null> {
	try {
		const info = JSON.parse(await (await tree.read(infoPath(entry))).text()) as Partial<TrashInfo>;
		return typeof info?.path === 'string' ? (info as TrashInfo) : null;
	} catch {
		return null;
	}
}

/** An item moved into the trash of a tree (for undoing) */
export interface TrashRef {
	entry: string;
	/** Where the item was */
	path: string;
}

/** Moves a file or folder of a tree into its trash: what deleting does in the browser (`moveToTrash`) and when another device or a guest asks */
export async function trashInTree(tree: Pick<Tree, 'stat' | 'write' | 'move'>, path: string, now = Date.now()): Promise<TrashRef> {
	const state = await tree.stat(path);
	if (!state) throw new FilesError('notFound', path);
	const entry = entryName(now);
	const info: TrashInfo = { path, kind: state.kind, deleted: now };
	// The info first: an entry without it is not shown, so nothing half-done ever appears
	const writer = (await tree.write(infoPath(entry))).getWriter();
	await writer.write(new TextEncoder().encode(JSON.stringify(info)));
	await writer.close();
	await tree.move(path, itemPath(entry, path));
	return { entry, path };
}

/**
 * Puts an item back where it was (under a free name if that is taken now) and removes its entry. `ref` may come from
 * another device or a guest: only a real entry whose info names exactly `ref.path` is touched.
 */
export async function untrashInTree(tree: Pick<Tree, 'stat' | 'read' | 'names' | 'move' | 'remove'>, ref: TrashRef): Promise<string> {
	const entry = typeof ref?.entry === 'string' ? ref.entry : '';
	const path = typeof ref?.path === 'string' ? normalize(ref.path) : '/';
	if (parseEntry(entry) === null || path === '/' || inTrash(path)) throw new FilesError('notFound', path);
	const info = await readTrashInfo(tree, entry);
	if (!info || normalize(info.path) !== path) throw new FilesError('notFound', path);
	ref = { entry, path };
	const item = itemPath(ref.entry, ref.path);
	if (!(await tree.stat(item))) throw new FilesError('notFound', ref.path);
	const target = join(parent(ref.path), uniqueName(basename(ref.path), await tree.names(parent(ref.path))));
	await tree.move(item, target);
	await tree.remove(entryPath(ref.entry));
	return target;
}
