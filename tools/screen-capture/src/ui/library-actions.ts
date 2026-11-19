// Inserting copied items (clipboard, library) into the open project and moving entries between the libraries

import { m } from '#lib/i18n/index.js';
import type { Player } from '#lib/preview/player.svelte.js';
import { clipboard } from '#lib/project/clipboard.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import { mediaOf } from '#lib/project/library.js';
import { globalLibrary } from '#lib/project/library.svelte.js';
import { prepareMedia, type ItemsWithMedia } from '#lib/project/transfer.js';
import type { Item } from '#lib/project/types.js';
import { libraryMediaFile, mediaFile } from '#lib/storage/store.js';
import { toolState } from '#lib/tools/state.svelte.js';
import type { DropPlace } from '#lib/tools/types.js';
import { libraryUi, type LibraryScope } from '#lib/ui/library.svelte.js';
import { errorMessage } from '#lib/util/format.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';

function failed(e: unknown) {
	console.error(e);
	toast(errorMessage(e), 'error', 8000);
}

/** After new sources: the preview loads their videos and redraws */
export async function sourcesAdded(player: Player) {
	await player.syncSources();
	player.refresh();
}

/**
 * Inserts copied items at `at`; media they lack is copied into the project first (`read` opens it where it is,
 * `null`: already in this project's folder)
 */
async function insertWithMedia(
	editor: Editor,
	player: Player,
	data: ItemsWithMedia,
	at: number,
	read: ((file: string) => Promise<File>) | null
) {
	if (!data.items.length) return;
	try {
		const { items, sources, images, skipped } = await prepareMedia(data, editor.project, read, () =>
			toast(m.editor.copyingMedia)
		);
		if (items.length) editor.paste(items, at, sources, images);
		if (sources.length) await sourcesAdded(player);
		if (skipped) toast(m.editor.pasteSkipped(skipped), 'warning', 6000);
	} catch (e) {
		failed(e);
	}
}

/** Pastes at the playhead; media from another project is copied into this one first */
export function pasteClipboard(editor: Editor, player: Player) {
	const data = clipboard.data;
	if (!data) return;
	const from = data.projectId;
	insertWithMedia(editor, player, data, player.time, from === editor.project.id ? null : (file) => mediaFile(from, file));
}

function libraryEntry(editor: Editor, scope: LibraryScope, id: string) {
	return (scope === 'project' ? editor.project.library : globalLibrary.entries).find((e) => e.id === id);
}

/** Library entry at the playhead or the dropped time (it keeps its place in the picture) */
export async function insertLibrary(editor: Editor, player: Player, scope: LibraryScope, id: string, at?: DropPlace) {
	const entry = libraryEntry(editor, scope, id);
	if (!entry) return;
	const start = at?.start ?? player.time;
	await insertWithMedia(editor, player, entry, start, scope === 'project' ? null : libraryMediaFile);
	if (at?.start !== undefined) player.seek(at.start);
}

/** Adds items to a library: in the project, or globally with copies of their media */
async function addToLibrary(editor: Editor, name: string, scope: LibraryScope, items: Item[]) {
	if (scope === 'project') editor.addToLibrary(name, items);
	else await globalLibrary.add(name, { items, ...mediaOf(items, editor.project.sources, editor.project.images) }, editor.project.id);
}

/** Saves items in a library and shows it */
export async function saveToLibrary(editor: Editor, name: string, scope: LibraryScope, items: Item[]) {
	try {
		await addToLibrary(editor, name, scope, items);
		libraryUi.scope = scope;
		toolState.group = 'library';
		toast(m.library.added(name), 'success');
	} catch (e) {
		failed(e);
	}
}

/** Copies or moves an entry into the other library; on errors it stays where it was */
export async function transferLibrary(editor: Editor, player: Player, scope: LibraryScope, id: string, move: boolean) {
	const entry = libraryEntry(editor, scope, id);
	if (!entry) return;
	const target: LibraryScope = scope === 'project' ? 'global' : 'project';
	try {
		if (target === 'global') await addToLibrary(editor, entry.name, 'global', entry.items);
		else {
			const { items, sources, images, skipped } = await prepareMedia(entry, editor.project, libraryMediaFile, () =>
				toast(m.editor.copyingMedia)
			);
			// Not complete: keep the global entry
			if (skipped) return toast(m.editor.pasteSkipped(skipped), 'warning', 6000);
			editor.addMedia(sources, images);
			if (sources.length) await sourcesAdded(player);
			editor.addToLibrary(entry.name, items);
		}
		if (move) {
			if (scope === 'project') editor.removeLibraryEntry(id);
			else await globalLibrary.remove(id);
		}
		const where = target === 'project' ? m.library.project : m.library.global;
		toast(move ? m.library.moved(entry.name, where) : m.library.copied(entry.name, where), 'success');
	} catch (e) {
		failed(e);
	}
}
