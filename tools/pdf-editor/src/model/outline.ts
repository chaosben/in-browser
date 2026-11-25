// The bookmarks of a PDF (its outline) as the editor changes them: a tree of entries, each with a title, a style and
// where it leads. Pure: every change gives a new tree and leaves the old one as it was (undo keeps both); entries that
// don't change stay the same objects.

/** Where a bookmark leads */
export type BookmarkTarget =
	/** Kept from the file: its page there (number from 1; null: none or another document) and the top edge (user
	 * space; null: where the view is), or a web address */
	| { kind: 'file'; ref: string; number: number | null; top: number | null; uri?: string }
	/** A page of the document (its id, so it follows the page when pages move) and the top edge there (page points
	 * as shown, from the top) */
	| { kind: 'page'; page: string; y: number }
	/** As PDF.js read it (only shown, before the file is parsed for writing or when it can't be written) */
	| { kind: 'dest'; dest: string | unknown[] };

export interface Bookmark {
	id: string;
	title: string;
	bold?: boolean;
	italic?: boolean;
	/** `#rrggbb` */
	color?: string;
	target: BookmarkTarget | null;
	items: Bookmark[];
}

/** Where an entry is: the list holding it, its index there and its parent (null at the top) */
export interface Place {
	parent: string | null;
	index: number;
}

/** Every entry in order, depth first */
export function* walk(tree: readonly Bookmark[], depth = 0): Generator<{ bookmark: Bookmark; depth: number }> {
	for (const bookmark of tree) {
		yield { bookmark, depth };
		yield* walk(bookmark.items, depth + 1);
	}
}

export const find = (tree: readonly Bookmark[], id: string): Bookmark | null => {
	for (const { bookmark } of walk(tree)) if (bookmark.id === id) return bookmark;
	return null;
};

export function placeOf(tree: readonly Bookmark[], id: string, parent: string | null = null): Place | null {
	for (let i = 0; i < tree.length; i++) {
		if (tree[i].id === id) return { parent, index: i };
		const inner = placeOf(tree[i].items, id, tree[i].id);
		if (inner) return inner;
	}
	return null;
}

/** The entries shown: those below an open one (`open` holds the ids of the open ones) */
export function visible(tree: readonly Bookmark[], open: ReadonlySet<string>, depth = 0): { bookmark: Bookmark; depth: number; parent: string | null }[] {
	return tree.flatMap((bookmark) => [
		{ bookmark, depth, parent: null as string | null },
		...(open.has(bookmark.id) ? visible(bookmark.items, open, depth + 1).map((v) => (v.depth === depth + 1 ? { ...v, parent: bookmark.id } : v)) : [])
	]);
}

/** The ids without those inside another one of them (moving or deleting an entry takes its entries along) */
export function outermost(tree: readonly Bookmark[], ids: ReadonlySet<string>): string[] {
	const out: string[] = [];
	const visit = (list: readonly Bookmark[]) => {
		for (const b of list) {
			if (ids.has(b.id)) out.push(b.id);
			else visit(b.items);
		}
	};
	visit(tree);
	return out;
}

/** Each entry given to `change` (null: as it is); the others stay the same objects */
export function mapTree(tree: readonly Bookmark[], change: (b: Bookmark) => Bookmark | null): Bookmark[] {
	let changed = false;
	const next = tree.map((b) => {
		const items = mapTree(b.items, change);
		const inner = items !== b.items ? { ...b, items } : b;
		const own = change(inner) ?? inner;
		if (own !== b) changed = true;
		return own;
	});
	return changed ? next : (tree as Bookmark[]);
}

/** The tree without the entries `ids` (with what is inside them) */
export function removeAll(tree: readonly Bookmark[], ids: ReadonlySet<string>): Bookmark[] {
	let changed = false;
	const next: Bookmark[] = [];
	for (const b of tree) {
		if (ids.has(b.id)) {
			changed = true;
			continue;
		}
		const items = removeAll(b.items, ids);
		if (items !== b.items) changed = true;
		next.push(items !== b.items ? { ...b, items } : b);
	}
	return changed ? next : (tree as Bookmark[]);
}

/** The list `parent` holds (the top for null) changed by `change` */
function withList(tree: readonly Bookmark[], parent: string | null, change: (list: Bookmark[]) => Bookmark[]): Bookmark[] {
	if (parent === null) return change([...tree]);
	return mapTree(tree, (b) => (b.id === parent ? { ...b, items: change([...b.items]) } : null));
}

/** `entries` put into the list of `parent` at `index` */
export function insertAt(tree: readonly Bookmark[], entries: readonly Bookmark[], parent: string | null, index: number): Bookmark[] {
	return withList(tree, parent, (list) => {
		list.splice(Math.max(0, Math.min(index, list.length)), 0, ...entries);
		return list;
	});
}

/** The entries `ids` (outermost ones, in order) taken out and put before or after `to`, or into it as its last ones */
export function moveTo(tree: readonly Bookmark[], ids: ReadonlySet<string>, to: string, where: 'before' | 'after' | 'inside'): Bookmark[] {
	const moving = outermost(tree, ids);
	// Never into itself or what lies inside it
	if (moving.some((id) => id === to || !!find(find(tree, id)?.items ?? [], to))) return tree as Bookmark[];
	const entries = moving.map((id) => find(tree, id)!);
	const rest = removeAll(tree, new Set(moving));
	if (where === 'inside') return mapTree(rest, (b) => (b.id === to ? { ...b, items: [...b.items, ...entries] } : null));
	const place = placeOf(rest, to);
	if (!place) return tree as Bookmark[];
	return insertAt(rest, entries, place.parent, place.index + (where === 'after' ? 1 : 0));
}

/** The entries one place up (-1) or down (+1) among their siblings; null where none of them can move */
export function moveBy(tree: readonly Bookmark[], ids: ReadonlySet<string>, delta: -1 | 1): Bookmark[] | null {
	const moving = outermost(tree, ids);
	let next = tree as Bookmark[];
	let moved = false;
	// The one at the far end first, so neighbours moving the same way don't block each other
	for (const id of delta < 0 ? moving : [...moving].reverse()) {
		const place = placeOf(next, id);
		if (!place) continue;
		const list = place.parent === null ? next : find(next, place.parent)!.items;
		const other = list[place.index + delta];
		if (!other || ids.has(other.id)) continue;
		next = withList(next, place.parent, (l) => {
			[l[place.index], l[place.index + delta]] = [l[place.index + delta], l[place.index]];
			return l;
		});
		moved = true;
	}
	return moved ? next : null;
}

/** The entries one level in: each into the sibling before it, as its last entry; null where none can go */
export function indent(tree: readonly Bookmark[], ids: ReadonlySet<string>): Bookmark[] | null {
	let next = tree as Bookmark[];
	let moved = false;
	for (const id of outermost(tree, ids)) {
		const place = placeOf(next, id);
		if (!place || place.index === 0) continue;
		const list = place.parent === null ? next : find(next, place.parent)!.items;
		next = moveTo(next, new Set([id]), list[place.index - 1].id, 'inside');
		moved = true;
	}
	return moved ? next : null;
}

/** The entries one level out: each right after the entry holding it; null where none can go */
export function outdent(tree: readonly Bookmark[], ids: ReadonlySet<string>): Bookmark[] | null {
	let next = tree as Bookmark[];
	let moved = false;
	// The last first, so they keep their order after their parent
	for (const id of [...outermost(tree, ids)].reverse()) {
		const place = placeOf(next, id);
		if (!place || place.parent === null) continue;
		next = moveTo(next, new Set([id]), place.parent, 'after');
		moved = true;
	}
	return moved ? next : null;
}
