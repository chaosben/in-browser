// The commands on bookmarks (`model/outline.ts`): the contextual tab “Bookmarks” while their panel is open, and the
// menu of an entry there. They act on the picked bookmarks, else on the current one (`EditorState.bookmarksToChange`);
// every change is one undo step.

import type { Command } from '@in-browser/brand/commands.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { m } from '#lib/i18n/index.js';
import type { EditorState } from './editor.svelte.js';
import { find, indent, insertAt, mapTree, moveBy, outdent, placeOf, removeAll, walk, type Bookmark } from './outline.js';

/** The longest name a new bookmark takes from the selected text */
const NAME_FROM_TEXT = 120;

export function bookmarkCommands(ed: EditorState) {
	const doc = () => (ed.doc?.canEditBookmarks ? ed.doc : null);
	const targets = () => ed.bookmarksToChange();
	const some = () => !!doc() && targets().size > 0;
	const one = () => {
		const t = targets();
		return t.size === 1 ? [...t][0] : null;
	};

	/** The top of the view: the current page and its height there (page points) */
	function here() {
		const page = ed.doc?.pages[ed.current];
		const stage = ed.stage;
		if (!page || !stage) return null;
		const [, y] = stage.toPage(ed.current, 0, 0);
		return { page: page.id, y: Math.max(0, Math.min(page.h, Math.round(y))) };
	}

	function add() {
		const d = doc();
		const at = here();
		if (!d || !at) return;
		const selected = getSelection()?.toString().replace(/\s+/g, ' ').trim().slice(0, NAME_FROM_TEXT) ?? '';
		const bookmark: Bookmark = { id: `n${crypto.randomUUID()}`, title: selected || m.bookmarks.page(ed.current + 1), target: { kind: 'page', ...at }, items: [] };
		// After the current one, at its level; else at the end
		const current = ed.bookmarkCurrent && placeOf(d.bookmarks, ed.bookmarkCurrent);
		d.changeBookmarks(current ? insertAt(d.bookmarks, [bookmark], current.parent, current.index + 1) : [...d.bookmarks, bookmark]);
		ed.bookmarkPick.clear();
		ed.bookmarkCurrent = bookmark.id;
		ed.bookmarkRename = { id: bookmark.id, fresh: true };
	}

	/** The targets changed by `change` (one step) */
	const restyle = (change: (b: Bookmark) => Bookmark) => {
		const d = doc();
		const ids = targets();
		if (d) d.changeBookmarks(mapTree(d.bookmarks, (b) => (ids.has(b.id) ? change(b) : null)));
	};
	const all = (test: (b: Bookmark) => boolean) => {
		const ids = targets();
		const picked = [...walk(ed.doc?.bookmarks ?? [])].filter((w) => ids.has(w.bookmark.id));
		return picked.length > 0 && picked.every((w) => test(w.bookmark));
	};
	const toggle = (key: 'bold' | 'italic') => {
		const on = all((b) => !!b[key]);
		restyle(({ [key]: _, ...b }) => (on ? b : { ...b, [key]: true }));
	};

	const commands = {
		addBookmark: { id: 'addBookmark', label: m.bookmarks.add, tip: m.bookmarks.addTip, icon: 'icon-[material-symbols-light--bookmark-add-outline]', enabled: () => !!doc(), run: add },
		renameBookmark: {
			id: 'renameBookmark',
			label: m.bookmarks.rename,
			icon: 'icon-[material-symbols-light--drive-file-rename-outline]',
			enabled: () => !!doc() && !!one(),
			run: () => {
				const id = one();
				if (id) ed.bookmarkRename = { id, fresh: false };
			}
		},
		bookmarkTarget: {
			id: 'bookmarkTarget',
			label: m.bookmarks.target,
			tip: m.bookmarks.targetTip,
			icon: 'icon-[material-symbols-light--my-location-outline]',
			enabled: some,
			run: () => {
				const at = here();
				if (at) restyle((b) => ({ ...b, target: { kind: 'page', ...at } }));
			}
		},
		removeBookmarks: {
			id: 'removeBookmarks',
			label: m.bookmarks.remove,
			icon: 'icon-[material-symbols-light--delete-outline]',
			enabled: some,
			run: () => {
				const d = doc();
				if (!d) return;
				d.changeBookmarks(removeAll(d.bookmarks, targets()));
				ed.bookmarkPick.clear();
				ed.bookmarkCurrent = null;
			}
		},
		bookmarkUp: { id: 'bookmarkUp', label: m.bookmarks.up, icon: 'icon-[material-symbols-light--arrow-upward]', enabled: () => some() && !!moveBy(ed.doc!.bookmarks, targets(), -1), run: () => doc()?.changeBookmarks(moveBy(doc()!.bookmarks, targets(), -1)) },
		bookmarkDown: { id: 'bookmarkDown', label: m.bookmarks.down, icon: 'icon-[material-symbols-light--arrow-downward]', enabled: () => some() && !!moveBy(ed.doc!.bookmarks, targets(), 1), run: () => doc()?.changeBookmarks(moveBy(doc()!.bookmarks, targets(), 1)) },
		indentBookmarks: {
			id: 'indentBookmarks',
			label: m.bookmarks.indent,
			icon: 'icon-[material-symbols-light--format-indent-increase]',
			enabled: () => some() && !!indent(ed.doc!.bookmarks, targets()),
			run: () => {
				const d = doc();
				if (!d) return;
				const ids = targets();
				d.changeBookmarks(indent(d.bookmarks, ids));
				// The bookmarks they went into open, so they stay in sight
				const parents = [...ids].flatMap((id) => placeOf(d.bookmarks, id)?.parent ?? []);
				if (parents.some((p) => !d.bookmarksOpen.has(p))) d.setBookmarksOpen(new Set([...d.bookmarksOpen, ...parents]));
			}
		},
		outdentBookmarks: { id: 'outdentBookmarks', label: m.bookmarks.outdent, icon: 'icon-[material-symbols-light--format-indent-decrease]', enabled: () => some() && !!outdent(ed.doc!.bookmarks, targets()), run: () => doc()?.changeBookmarks(outdent(doc()!.bookmarks, targets())) },
		bookmarkBold: { id: 'bookmarkBold', label: m.bookmarks.bold, icon: 'icon-[material-symbols-light--format-bold]', enabled: some, active: () => some() && all((b) => !!b.bold), run: () => toggle('bold') },
		bookmarkItalic: { id: 'bookmarkItalic', label: m.bookmarks.italic, icon: 'icon-[material-symbols-light--format-italic]', enabled: some, active: () => some() && all((b) => !!b.italic), run: () => toggle('italic') },
		expandBookmarks: {
			id: 'expandBookmarks',
			label: m.bookmarks.expandAll,
			icon: 'icon-[material-symbols-light--unfold-more]',
			enabled: () => [...walk(ed.doc?.bookmarks ?? [])].some((w) => w.bookmark.items.length && !ed.doc!.bookmarksOpen.has(w.bookmark.id)),
			run: () => ed.doc?.setBookmarksOpen(new Set([...walk(ed.doc.bookmarks)].filter((w) => w.bookmark.items.length).map((w) => w.bookmark.id)))
		},
		collapseBookmarks: {
			id: 'collapseBookmarks',
			label: m.bookmarks.collapseAll,
			icon: 'icon-[material-symbols-light--unfold-less]',
			enabled: () => !!ed.doc?.bookmarksOpen.size,
			run: () => ed.doc?.setBookmarksOpen(new Set())
		}
	} satisfies Record<string, Command>;

	/** The color of the targets (the first one's), and setting it (null: none) */
	const color = () => {
		const id = [...targets()][0];
		return (id && find(ed.doc?.bookmarks ?? [], id)?.color) || null;
	};
	const setColor = (value: string | null) => restyle(({ color: _, ...b }) => (value ? { ...b, color: value.slice(0, 7) } : b));

	/** The complete menu of a bookmark (right click, long press, ⋯) */
	function menu(): MenuEntry[] {
		const entry = (c: Command): MenuEntry => ({ label: c.label, icon: c.icon, disabled: c.enabled ? !c.enabled() : false, checked: c.active?.(), run: () => c.run?.() });
		const c = commands;
		return [
			entry(c.renameBookmark),
			entry(c.bookmarkTarget),
			{ separator: true },
			entry(c.bookmarkUp),
			entry(c.bookmarkDown),
			entry(c.indentBookmarks),
			entry(c.outdentBookmarks),
			{ separator: true },
			entry(c.bookmarkBold),
			entry(c.bookmarkItalic),
			{ separator: true },
			entry(c.addBookmark),
			entry(c.removeBookmarks)
		];
	}

	return { ...commands, color, setColor, menu };
}

export type BookmarkCommands = ReturnType<typeof bookmarkCommands>;
