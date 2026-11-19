import { isInside, segments } from './path.js';
import type { Tree } from './sync/tree.js';

// The trash: what the user deletes (in Files, or a notebook or project in its tool) is moved into the hidden folder
// `/.in-browser-trash/` of the shared file system instead of being gone. It syncs like everything else – to every
// device, into the synced folder on disk and to the p2p-node – so it can be restored anywhere. One entry per deleted
// file or folder: `/.in-browser-trash/<entry>/.trashinfo.json` (where it was, when) plus the item under its full
// original path (`…/<entry>/Docs/Plan.md`), so the folder choice of a device applies to it without reading anything.
// Entries are removed after the retention the user picked (`/.apps/files/settings.json`, synced as well).
// What the syncs delete or replace because another side did is not kept (like Syncthing without versioning).

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
export const RETENTIONS: Retention[] = [7, 30, 90, null];
export const DEFAULT_RETENTION: Retention = 30;

/** Where the setting lives (synced to every device) */
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

/** Whether an entry is due for removal */
export function expired(entry: string, now: number, retention: Retention): boolean {
	const time = parseEntry(entry);
	if (time === null || retention === null) return false;
	return now - time > retention * 24 * 60 * 60 * 1000;
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

/** The retention as stored (throws when the file exists but can't be read: a cleanup then waits) */
export async function retentionOf(tree: Pick<Tree, 'stat' | 'read'>): Promise<Retention> {
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
		for (const entry of await tree.names(TRASH_ROOT)) if (expired(entry, now, retention)) await tree.remove(entryPath(entry));
	} catch (e) {
		console.warn('[Trash] cleanup failed', e);
	}
}
