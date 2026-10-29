import { SvelteSet } from 'svelte/reactivity';
import { list, stat } from '@in-browser/files/fs.js';
import { PACKAGE_MANIFEST } from '@in-browser/files/formats.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { join, segments } from '@in-browser/files/path.js';
import { matches, sortItems, toItem, type Item, type SortKey } from './items.js';

// State of the file manager: the open folder, its entries, selection, sorting, search and view.

const VIEW_KEY = 'files:view';

function storedView(): 'list' | 'grid' {
	try {
		return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
	} catch {
		return 'list';
	}
}

/** Folders open in the tree on the left (shared by all tree nodes) */
export const expanded = new SvelteSet<string>(['/']);
/** Bumped on every change in the file system: tree nodes reload their children */
export const treeVersion = $state({ current: 0 });

/** Copied or cut entries (inside Files only, not the system clipboard) */
export const clipboard = $state<{ current: { mode: 'copy' | 'cut'; paths: string[] } | null }>({ current: null });

export class Manager {
	folder = $state('/');
	items = $state.raw<Item[] | null>(null);
	error = $state<string | null>(null);
	selection = new SvelteSet<string>();
	/** Entry with the keyboard focus (start of Shift ranges) */
	focus = $state<string | null>(null);
	renaming = $state<string | null>(null);
	sortKey = $state<SortKey>('name');
	desc = $state(false);
	query = $state('');
	view = $state<'list' | 'grid'>(storedView());

	/** Shown entries: without hidden ones (`.name`), filtered by the search, sorted */
	visible = $derived(
		sortItems((this.items ?? []).filter((i) => !i.name.startsWith('.') && matches(i, this.query)), this.sortKey, this.desc)
	);
	selected = $derived(this.visible.filter((i) => this.selection.has(i.path)));

	async load(folder: string) {
		if (folder !== this.folder) {
			this.selection.clear();
			this.focus = null;
			this.query = '';
			this.items = null;
		}
		this.folder = folder;
		this.renaming = null;
		// Show the way to the folder in the tree
		segments(folder).forEach((_, i, all) => expanded.add('/' + all.slice(0, i + 1).join('/')));
		await this.refresh();
	}

	async refresh() {
		const folder = this.folder;
		try {
			const entries = await list(folder);
			const items = await Promise.all(entries.map(withDate));
			if (folder !== this.folder) return;
			this.items = items;
			this.error = null;
			// Drop what is gone from the selection
			const present = new Set(items.map((i) => i.path));
			for (const path of this.selection) if (!present.has(path)) this.selection.delete(path);
		} catch (e) {
			if (folder !== this.folder) return;
			console.error(e);
			this.items = [];
			this.error = filesErrorText(e);
		}
	}

	setView(view: 'list' | 'grid') {
		this.view = view;
		try {
			localStorage.setItem(VIEW_KEY, view);
		} catch {
			// Storage blocked: the choice just isn't remembered
		}
	}

	sortBy(key: SortKey) {
		if (this.sortKey === key) this.desc = !this.desc;
		else {
			this.sortKey = key;
			this.desc = key === 'modified' || key === 'size';
		}
	}

	/** Click on an entry: alone, toggled (Ctrl/Cmd) or as a range from the focus (Shift) */
	select(path: string, { ctrl = false, shift = false } = {}) {
		if (shift && this.focus) {
			const paths = this.visible.map((i) => i.path);
			const [a, b] = [paths.indexOf(this.focus), paths.indexOf(path)].sort((x, y) => x - y);
			if (a >= 0 && b >= 0) {
				if (!ctrl) this.selection.clear();
				paths.slice(a, b + 1).forEach((p) => this.selection.add(p));
				return;
			}
		}
		if (ctrl) {
			if (this.selection.has(path)) this.selection.delete(path);
			else this.selection.add(path);
		} else {
			this.selection.clear();
			this.selection.add(path);
		}
		this.focus = path;
	}

	selectAll() {
		this.visible.forEach((i) => this.selection.add(i.path));
	}

	/** Moves the focus by `step` entries (arrow keys); Shift extends the selection */
	step(step: number, shift: boolean) {
		const paths = this.visible.map((i) => i.path);
		if (paths.length === 0) return;
		const current = this.focus ? paths.indexOf(this.focus) : -1;
		const next = paths[Math.max(0, Math.min(paths.length - 1, current < 0 ? 0 : current + step))];
		if (shift) {
			this.selection.add(next);
			this.focus = next;
		} else this.select(next);
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
