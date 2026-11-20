import { resolve } from '$app/paths';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { openUrl, type Format } from '@in-browser/files/formats.js';
import { copy, list, mkdir, move, remove, trashOf, write } from '@in-browser/files/fs.js';
import { moveToTrash, deleteToTrash } from '@in-browser/files/trash-browser.js';
import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
import { basename, isConnected, join, nameProblem, parent, uniqueName } from '@in-browser/files/path.js';
import { m } from '#lib/i18n/index.js';
import type { Item } from './items.js';
import { clipboard, lastUndo, type Manager } from './manager.svelte.js';

// Commands of the file manager. Errors are shown as toast and logged; nothing is ever overwritten: name clashes
// get a number (` (2)`). What can be undone (renaming, moving, pasting, duplicating) says so in its message with
// “Undo”, and so does deleting (the trash's message); the last of these is also the ribbon's “Undo” (`lastUndo`).

export function fail(e: unknown, retry?: () => void) {
	console.error(e);
	toast(filesErrorText(e), 'error', 8000, accessAction(e, retry));
}

/** A message about a step with “Undo”, which is also the ribbon's “Undo” until the next step */
function offerUndo(text: string, undo: () => Promise<void>) {
	let done = false;
	const run = async () => {
		if (done) return;
		done = true;
		if (lastUndo.current === run) lastUndo.current = null;
		try {
			await undo();
		} catch (e) {
			fail(e);
		}
	};
	lastUndo.current = run;
	toast(text, 'success', 8000, { label: m.toasts.undo, run });
}

async function takenNames(folder: string) {
	return (await list(folder)).map((e) => e.name);
}

export async function newFolder(manager: Manager) {
	try {
		const path = join(manager.folder, uniqueName(m.list.newFolderName, await takenNames(manager.folder)));
		await mkdir(path);
		await manager.refresh();
		manager.select(path);
		manager.renaming = path;
	} catch (e) {
		fail(e, () => void newFolder(manager));
	}
}

/** Creates an empty text file and starts renaming it */
export async function newTextFile(manager: Manager) {
	try {
		const path = join(manager.folder, uniqueName(m.list.newTextFileName, await takenNames(manager.folder)));
		await write(path, '');
		await manager.refresh();
		manager.select(path);
		manager.renaming = path;
	} catch (e) {
		fail(e, () => void newTextFile(manager));
	}
}

/** Renames; returns the new path, or `null` (and says why) if the name is not allowed or renaming failed. */
export async function rename(manager: Manager, path: string, name: string): Promise<string | null> {
	name = name.trim();
	if (name === basename(path)) return path;
	const problem = nameProblem(name);
	if (problem) {
		toast(filesMessages().names[problem], 'warning', 6000);
		return null;
	}
	try {
		const target = join(parent(path), name);
		await move(path, target);
		// The open folder itself (renamed in the folder path): the page goes there and loads it
		if (!manager.followMove(path, target)) {
			await manager.refresh();
			if (parent(target) === manager.folder) manager.select(target);
		}
		offerUndo(m.toasts.renamed(name), async () => {
			await move(target, path);
			if (!manager.followMove(target, path)) await manager.refresh();
		});
		return target;
	} catch (e) {
		fail(e);
		return null;
	}
}

/** Into the trash (no question: the message offers to undo it, and the trash keeps it) */
export async function removeItems(manager: Manager, items: Item[]) {
	if (items.length === 0) return;
	try {
		// The message of the trash has its own “Undo”, which is also the ribbon's (deleting for good in a connected
		// folder offers none: then an older step must not be undone in its place)
		let offered: (() => Promise<void>) | null = null;
		const deleted = await deleteToTrash(
			items.map((item) => item.path),
			() => void manager.refresh(),
			(undo) => {
				const run = async () => {
					if (lastUndo.current === run) lastUndo.current = null;
					try {
						await undo();
					} catch (e) {
						fail(e);
					}
				};
				offered = run;
			}
		);
		if (deleted) lastUndo.current = offered;
	} catch (e) {
		fail(e);
	}
	await manager.refresh();
}

export function toClipboard(items: Item[], mode: 'copy' | 'cut') {
	if (items.length) clipboard.current = { mode, paths: items.map((i) => i.path) };
}

/** Where each entry went: `[from, to]` */
type Done = [string, string][];

/** Moves or copies `paths` into `folder`; returns what succeeded. */
async function transferPaths(manager: Manager, paths: string[], folder: string, mode: 'copy' | 'move'): Promise<{ done: Done; relocated: boolean }> {
	const taken = await takenNames(folder);
	const done: Done = [];
	let relocated = false;
	for (const path of paths) {
		// Moving into the same folder changes nothing
		if (mode === 'move' && parent(path) === folder) continue;
		try {
			const name = uniqueName(basename(path), taken);
			taken.push(name);
			const target = join(folder, name);
			await (mode === 'copy' ? copy : move)(path, target);
			if (mode === 'move' && manager.followMove(path, target)) relocated = true;
			done.push([path, target]);
		} catch (e) {
			fail(e);
		}
	}
	return { done, relocated };
}

/** Undoing a copy: the copies go into the trash (quietly – they were just made) */
async function dropCopies(paths: string[]) {
	const local: string[] = [];
	for (const path of paths) {
		// A folder of another device or a guest share has its own trash; a folder on disk none
		const other = await trashOf(path);
		if (other) await other.trash(path);
		else if (isConnected(path)) await remove(path);
		else local.push(path);
	}
	await moveToTrash(local);
}

/**
 * Moves or copies `paths` into `folder` (drag and drop, cut/copy and paste, “Move to …”, “Duplicate”) with a
 * message offering to undo it (`text`: the message for how many succeeded). Returns the new paths.
 */
export async function transfer(manager: Manager, paths: string[], folder: string, mode: 'copy' | 'move', text: (n: number) => string): Promise<string[]> {
	let done: Done = [];
	try {
		const result = await transferPaths(manager, paths, folder, mode);
		done = result.done;
		// The open folder was moved: the page goes there and loads it
		if (!result.relocated) await manager.refresh();
	} catch (e) {
		fail(e);
	}
	if (!done.length) return [];
	offerUndo(text(done.length), async () => {
		let relocated = false;
		if (mode === 'copy') await dropCopies(done.map(([, to]) => to));
		else
			for (const [from, to] of done.toReversed()) {
				await move(to, from);
				if (manager.followMove(to, from)) relocated = true;
			}
		if (!relocated) await manager.refresh();
	});
	return done.map(([, to]) => to);
}

export async function paste(manager: Manager, folder = manager.folder) {
	const content = clipboard.current;
	if (!content) return;
	const cut = content.mode === 'cut';
	const done = await transfer(manager, content.paths, folder, cut ? 'move' : 'copy', m.toasts.pasted);
	// Cut entries live at the new place now
	if (cut) clipboard.current = null;
	if (folder === manager.folder && done.length) manager.selectPaths(done);
}

/** Copies next to the originals (all from one folder: the open one, or a folder in the tree) */
export async function duplicate(manager: Manager, items: Item[]) {
	if (!items.length) return;
	const folder = parent(items[0].path);
	const done = await transfer(
		manager,
		items.map((i) => i.path),
		folder,
		'copy',
		m.toasts.duplicated
	);
	if (folder === manager.folder && done.length) manager.selectPaths(done);
}

/** Address that opens the item in its tool (or in `format`, from "Open with …"), `null` if no tool opens it */
export function toolUrl(item: Item, format: Format | undefined = item.formats[0]): string | null {
	return format ? openUrl(format, item.path) : null;
}

/** Where an entry opens in a browser tab of its own: a folder in Files, a file in its tool (`null`: nothing opens it) */
export function tabUrl(item: Item): string | null {
	return item.folder ? folderUrl(item.path) : toolUrl(item);
}

/** A folder's address in Files */
export const folderUrl = (path: string) => (path === '/' ? resolve('/files') : `${resolve('/files')}?path=${encodeURIComponent(path)}`);

/** Opens an address in a new browser tab (the middle mouse button on a folder in a tree, the trash …) */
export function openTab(url: string) {
	window.open(url, '_blank', 'noopener');
}

/** “Open in new tab” – also the middle mouse button on an entry */
export function openInNewTab(item: Item) {
	const url = tabUrl(item);
	if (url) openTab(url);
}
