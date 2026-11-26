import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { basename, parent } from '@in-browser/files/path.js';
import { deleteFromTrash, emptyTrash, listTrash, restoreFromTrash, type TrashItem } from '@in-browser/files/trash-browser.js';
import { m } from '#lib/i18n/index.js';
import type { Item } from '#lib/items.js';

// The trash as a special folder of Files (`/files?trash`, the last entry of the panel “Folders”): what you deleted,
// here or on another device, to restore where it was or delete for good. Its entries are shown by the list of a
// folder (`Manager` with the folder `TRASH`, `FileList` with `trash`), picked and sorted like any; the ribbon tab
// “Trash” and the menus act on the pick.

/** The `Manager`'s folder while the trash is shown (no path: `:` can't occur in names) */
export const TRASH = ':trash';

/** Rows shown at most (a full trash stays usable; the rest after restoring or deleting some) */
export const TRASH_LIMIT = 300;

/** An entry of the trash as an entry of the list: its old name, where it came from, when it was deleted */
export function trashEntry(item: TrashItem): Item {
	return {
		name: basename(item.path),
		path: `${TRASH}/${item.entry}`,
		kind: item.kind,
		size: item.size,
		modified: item.deleted,
		folder: false,
		formats: [],
		openWith: [],
		origin: parent(item.path),
		...(item.versions ? { localOnly: true } : {})
	};
}

class TrashState {
	/** Everything in the trash (newest first), `null` before the first listing */
	items = $state.raw<TrashItem[] | null>(null);
	busy = $state(false);

	/** Lists the trash; the entries for the list (at most `TRASH_LIMIT`) */
	async list(): Promise<Item[]> {
		this.items = await listTrash();
		return this.items.slice(0, TRASH_LIMIT).map(trashEntry);
	}

	/** The trash entries behind entries of the list */
	of(items: Item[]): TrashItem[] {
		const ids = new Set(items.map((item) => item.path.slice(TRASH.length + 1)));
		return (this.items ?? []).filter((item) => ids.has(item.entry));
	}

	private async run(action: () => Promise<void>) {
		this.busy = true;
		try {
			await action();
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			this.busy = false;
		}
	}

	/** Back where they were (under a free name); the message says where one ended up */
	restore(chosen: TrashItem[]) {
		if (!chosen.length) return;
		return this.run(async () => {
			let last = '';
			for (const item of chosen) last = await restoreFromTrash(item);
			toast(chosen.length === 1 ? m.trash.restored(last) : m.trash.restoredMany(chosen.length), 'success');
		});
	}

	/** Deleting for good can't be undone: asked first */
	async remove(chosen: TrashItem[]) {
		if (!chosen.length) return;
		const message = chosen.length === 1 ? m.trash.removeMessage(basename(chosen[0].path)) : m.trash.removeMessageMany(chosen.length);
		if (!(await ask({ title: m.trash.removeTitle, message, confirm: m.trash.remove, danger: true }))) return;
		await this.run(async () => {
			for (const item of chosen) await deleteFromTrash(item);
		});
	}

	async empty() {
		const items = this.items ?? (await listTrash());
		if (!items.length) return;
		const ok = await ask({ title: m.trash.emptyTitle, message: m.trash.emptyMessage(items.length), confirm: m.trash.empty, danger: true });
		if (ok) await this.run(emptyTrash);
	}
}

export const trash = new TrashState();
