import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { openUrl } from '@in-browser/files/formats.js';
import { copy, list, mkdir, move, remove, write } from '@in-browser/files/fs.js';
import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
import { basename, join, nameProblem, parent, uniqueName } from '@in-browser/files/path.js';
import { m } from '#lib/i18n/index.js';
import type { Item } from './items.js';
import { clipboard, type Manager } from './manager.svelte.js';

// Commands of the file manager. Errors are shown as toast and logged; nothing is ever overwritten: name clashes
// get a number (` (2)`).

function fail(e: unknown) {
	console.error(e);
	toast(filesErrorText(e), 'error', 8000);
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
		fail(e);
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
		fail(e);
	}
}

/** Renames; returns `false` (and says why) if the name is not allowed. */
export async function rename(manager: Manager, path: string, name: string): Promise<boolean> {
	name = name.trim();
	if (name === basename(path)) return true;
	const problem = nameProblem(name);
	if (problem) {
		toast(filesMessages().names[problem], 'warning', 6000);
		return false;
	}
	try {
		const target = join(parent(path), name);
		await move(path, target);
		await manager.refresh();
		manager.select(target);
		return true;
	} catch (e) {
		fail(e);
		return false;
	}
}

export async function removeItems(manager: Manager, items: Item[]) {
	if (items.length === 0) return;
	const ok = await ask({
		title: m.confirm.deleteTitle,
		message: items.length === 1 ? m.confirm.deleteOne(items[0].name) : m.confirm.deleteMany(items.length),
		confirm: m.common.delete,
		danger: true
	});
	if (!ok) return;
	for (const item of items) {
		try {
			await remove(item.path);
		} catch (e) {
			fail(e);
		}
	}
	await manager.refresh();
}

export function toClipboard(items: Item[], mode: 'copy' | 'cut') {
	if (items.length) clipboard.current = { mode, paths: items.map((i) => i.path) };
}

/** Moves or copies `paths` into `folder`; returns how many succeeded. */
export async function transfer(paths: string[], folder: string, mode: 'copy' | 'move'): Promise<number> {
	const taken = await takenNames(folder);
	let done = 0;
	for (const path of paths) {
		// Moving into the same folder changes nothing
		if (mode === 'move' && parent(path) === folder) continue;
		try {
			const name = uniqueName(basename(path), taken);
			taken.push(name);
			await (mode === 'copy' ? copy : move)(path, join(folder, name));
			done++;
		} catch (e) {
			fail(e);
		}
	}
	return done;
}

export async function paste(manager: Manager, folder = manager.folder) {
	const content = clipboard.current;
	if (!content) return;
	const done = await transfer(content.paths, folder, content.mode === 'cut' ? 'move' : 'copy');
	// Cut entries live at the new place now
	if (content.mode === 'cut') clipboard.current = null;
	if (done) toast(m.toasts.pasted(done), 'success');
	await manager.refresh();
}

export async function duplicate(manager: Manager, items: Item[]) {
	await transfer(
		items.map((i) => i.path),
		manager.folder,
		'copy'
	);
	await manager.refresh();
}

/** Address that opens the item in its tool, `null` if no tool opens it */
export function toolUrl(item: Item, index = 0): string | null {
	const format = item.formats[index];
	return format ? openUrl(format, item.path) : null;
}
