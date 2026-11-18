import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { list, move, readText, remove, stat, write } from './fs.js';
import { filesMessages } from './i18n/index.svelte.js';
import { basename, join, parent, uniqueName } from './path.js';
import { opfsTree } from './sync/opfs-tree.js';
import {
	DEFAULT_RETENTION,
	entryName,
	entryPath,
	infoPath,
	itemPath,
	parseEntry,
	retentionOf,
	SETTINGS_PATH,
	TRASH_ROOT,
	type Retention,
	type TrashInfo
} from './trash.js';

// The trash in the browser (`trash.ts`): moving what the user deletes into it, listing, restoring and removing
// entries, and the retention. Everything goes through fs.ts, so both syncs carry it like any other change.

export interface TrashItem extends TrashInfo {
	/** Name of the entry folder */
	entry: string;
	/** Bytes (a folder: everything inside) */
	size: number;
}

/** Moves files and folders into the trash; returns the entries (for undoing) */
export async function moveToTrash(paths: string[]): Promise<TrashItem[]> {
	const items: TrashItem[] = [];
	for (const path of paths) {
		const entry = await stat(path);
		if (!entry) continue;
		const name = entryName(Date.now());
		const info: TrashInfo = { path, kind: entry.kind, deleted: Date.now() };
		// The info first: an entry without it is not shown, so nothing half-done ever appears
		await write(infoPath(name), JSON.stringify(info));
		await move(path, itemPath(name, path));
		items.push({ ...info, entry: name, size: entry.size ?? 0 });
	}
	return items;
}

/**
 * What a delete action of the user does in every tool: into the trash, with a message offering to undo it
 * (`onUndo`: refresh the view afterwards)
 */
export async function deleteToTrash(paths: string[], onUndo?: () => void): Promise<void> {
	const items = await moveToTrash(paths);
	if (!items.length) return;
	const t = filesMessages().trash;
	toast(items.length === 1 ? t.moved(basename(items[0].path)) : t.movedMany(items.length), 'info', 8000, {
		label: t.undo,
		run: async () => {
			for (const item of items) await restoreFromTrash(item);
			onUndo?.();
		}
	});
}

async function sizeOf(path: string): Promise<number> {
	const entry = await stat(path);
	if (!entry) return 0;
	if (entry.kind === 'file') return entry.size ?? 0;
	let total = 0;
	for (const child of await list(path)) total += child.kind === 'file' ? (child.size ?? 0) : await sizeOf(child.path);
	return total;
}

/** Everything in the trash, newest first (entries still arriving from another device are left out) */
export async function listTrash(): Promise<TrashItem[]> {
	if (!(await stat(TRASH_ROOT))) return [];
	const items: TrashItem[] = [];
	for (const { name, kind } of await list(TRASH_ROOT)) {
		if (kind !== 'directory' || parseEntry(name) === null) continue;
		let info: TrashInfo;
		try {
			info = JSON.parse(await readText(infoPath(name))) as TrashInfo;
		} catch {
			continue;
		}
		if (typeof info.path !== 'string' || !(await stat(itemPath(name, info.path)))) continue;
		items.push({ ...info, entry: name, size: await sizeOf(itemPath(name, info.path)) });
	}
	return items.sort((a, b) => b.deleted - a.deleted || a.path.localeCompare(b.path));
}

/** Puts an item back where it was (under a free name if that is taken now); returns its path */
export async function restoreFromTrash(item: TrashItem): Promise<string> {
	const folder = parent(item.path);
	const taken = (await stat(folder)) ? (await list(folder)).map((entry) => entry.name) : [];
	const target = join(folder, uniqueName(basename(item.path), taken));
	await move(itemPath(item.entry, item.path), target);
	await remove(entryPath(item.entry));
	return target;
}

/** Removes an entry for good */
export async function deleteFromTrash(item: TrashItem): Promise<void> {
	await remove(entryPath(item.entry));
}

/** Removes everything in the trash for good */
export async function emptyTrash(): Promise<void> {
	await remove(TRASH_ROOT);
}

export async function trashRetention(): Promise<Retention> {
	return retentionOf(opfsTree).catch(() => DEFAULT_RETENTION);
}

/** Stores the retention in the synced settings (other settings in the file stay) */
export async function setTrashRetention(retention: Retention): Promise<void> {
	let settings: Record<string, unknown> = {};
	if (await stat(SETTINGS_PATH)) {
		try {
			settings = JSON.parse(await readText(SETTINGS_PATH)) as Record<string, unknown>;
		} catch {
			// Broken file: replaced by a fresh one
		}
	}
	await write(SETTINGS_PATH, JSON.stringify({ ...settings, trashDays: retention }, null, '\t'));
}
