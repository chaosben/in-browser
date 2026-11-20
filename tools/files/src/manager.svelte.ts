import { SvelteSet } from 'svelte/reactivity';
import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
import { readStored, writeStored } from '@in-browser/brand/storage.js';
import { FilesError, list, stat } from '@in-browser/files/fs.js';
import { PACKAGE_MANIFEST } from '@in-browser/files/formats.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { isInside, join, segments } from '@in-browser/files/path.js';
import { matches, sortItems, toItem, type Item, type SortKey } from './items.js';
import { trash, TRASH } from './trash.svelte.js';

// State of the file manager: the open folder, its entries, selection, sorting, search and view.

const VIEW_KEY = 'files:view';

const storedView = (): 'list' | 'grid' => (readStored(VIEW_KEY) === 'grid' ? 'grid' : 'list');

/** Folders open in the tree on the left (shared by all tree nodes) */
export const expanded = new SvelteSet<string>(['/']);
/** Bumped on every change in the file system: tree nodes reload their children */
export const treeVersion = $state({ current: 0 });

/** Copied or cut entries (inside Files only, not the system clipboard) */
export const clipboard = $state<{ current: { mode: 'copy' | 'cut'; paths: string[] } | null }>({ current: null });

/** The last step that can be undone (the ribbon's “Undo”); null after deleting (its message has its own “Undo”) */
export const lastUndo = $state<{ current: (() => Promise<void>) | null }>({ current: null });

export class Manager {
	folder = $state('/');
	items = $state.raw<Item[] | null>(null);
	error = $state<string | null>(null);
	/** Code of a known failure (`FilesError`), e.g. `offline` for a folder of another device or a guest share */
	errorCode = $state<string | null>(null);
	/** Picked entries (`ui.md` Selection: click, Ctrl/Shift+click, touch selection mode) */
	readonly pick = new Picker<string>();
	/** Entry with the keyboard focus (arrow keys move it; Shift extends the pick from the anchor) */
	focus = $state<string | null>(null);
	renaming = $state<string | null>(null);
	/** Goes to another folder (set by the page): follows the open folder when it is moved or renamed */
	relocate: ((path: string) => void) | null = null;
	sortKey = $state<SortKey>('name');
	desc = $state(false);
	query = $state('');
	view = $state<'list' | 'grid'>(storedView());

	/** Shown entries: without hidden ones (`.name`), filtered by the search, sorted */
	visible = $derived(
		sortItems((this.items ?? []).filter((i) => !i.name.startsWith('.') && matches(i, this.query)), this.sortKey, this.desc)
	);
	/** Paths as shown (the order of Shift ranges) */
	order = $derived(this.visible.map((i) => i.path));
	selected = $derived(this.visible.filter((i) => this.pick.has(i.path)));

	async load(folder: string) {
		if (folder !== this.folder) {
			this.pick.clear();
			this.focus = null;
			this.query = '';
			this.items = null;
		}
		this.folder = folder;
		this.renaming = null;
		// Show the way to the folder in the tree
		if (folder !== TRASH) segments(folder).forEach((_, i, all) => expanded.add('/' + all.slice(0, i + 1).join('/')));
		await this.refresh();
	}

	async refresh() {
		const folder = this.folder;
		try {
			// The trash is shown like a folder (`trash.svelte.ts`)
			const items = folder === TRASH ? await trash.list() : await Promise.all((await list(folder)).map(withDate));
			if (folder !== this.folder) return;
			this.items = items;
			this.error = null;
			this.errorCode = null;
			// Drop what is gone from the selection
			this.pick.keep(items.map((i) => i.path));
		} catch (e) {
			if (folder !== this.folder) return;
			// Known states (not reachable, no access, gone) are shown in place; anything else is a bug worth logging
			if (!(e instanceof FilesError)) console.error(e);
			this.items = [];
			this.error = filesErrorText(e);
			this.errorCode = e instanceof FilesError ? e.code : null;
		}
	}

	setView(view: 'list' | 'grid') {
		this.view = view;
		writeStored(VIEW_KEY, view);
	}

	/** Click on a column heading: by that key, again reverses the order */
	sortBy(key: SortKey) {
		if (this.sortKey === key) this.desc = !this.desc;
		else this.setSort(key);
	}

	/** By `key`, in its natural direction (dates and sizes: newest and largest first) */
	setSort(key: SortKey, desc = key === 'modified' || key === 'size') {
		this.sortKey = key;
		this.desc = desc;
	}

	/** Picks exactly this entry (new, renamed, pasted) */
	select(path: string) {
		this.pick.only(path);
		this.focus = path;
	}

	/** Picks these (e.g. what was pasted), keeping the selection mode */
	selectPaths(paths: string[]) {
		this.pick.set(paths);
		this.focus = paths.at(-1) ?? null;
	}

	selectAll() {
		this.pick.selectAll(this.order);
	}

	/** Clears the pick and ends the touch selection mode */
	clearSelection() {
		this.pick.clear();
	}

	/** Moves the focus by `step` entries (arrow keys); Shift extends the pick from the anchor */
	step(step: number, shift: boolean) {
		const paths = this.order;
		if (paths.length === 0) return;
		const current = this.focus ? paths.indexOf(this.focus) : -1;
		const next = paths[Math.max(0, Math.min(paths.length - 1, current < 0 ? 0 : current + step))];
		if (shift) this.pick.extend(next, paths);
		else this.pick.only(next);
		this.focus = next;
	}

	/** `from` was moved to `to`: the open folder follows when it was in it (returns whether it did) */
	followMove(from: string, to: string): boolean {
		if (!this.relocate || !isInside(this.folder, from)) return false;
		this.relocate(to + this.folder.slice(from.length));
		return true;
	}
}

/** Packages get the date of their `project.json` (folders have none) */
async function withDate(entry: Parameters<typeof toItem>[0]): Promise<Item> {
	const item = toItem(entry);
	if (entry.kind === 'directory' && !item.folder) {
		const manifest = await stat(join(entry.path, PACKAGE_MANIFEST)).catch(() => null);
		if (manifest) item.modified = manifest.modified;
	}
	return item;
}
