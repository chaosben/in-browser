import type { Entry } from '@in-browser/files/fs.js';
import { formatsOf, type Format } from '@in-browser/files/formats.js';
import { extname } from '@in-browser/files/path.js';

export { previewKind, type PreviewKind } from '@in-browser/files/kinds.js';

// What Files shows per entry: plain folder, package of a tool (shown like a file), or file with a preview kind.

export interface Item extends Entry {
	/** Plain folder (packages count as files) */
	folder: boolean;
	/** Tools that open it (package or file format); the first one opens on double-click */
	formats: Format[];
}

export function toItem(entry: Entry): Item {
	const formats = formatsOf(entry.name, entry.kind);
	return { ...entry, folder: entry.kind === 'directory' && formats.length === 0, formats };
}

export type SortKey = 'name' | 'kind' | 'size' | 'modified';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Folders first, then by the key (names naturally: "2" before "10"); ties by name */
export function sortItems(items: Item[], key: SortKey, desc: boolean): Item[] {
	const kindOf = (item: Item) => (item.folder ? '' : item.formats[0]?.ext ?? extname(item.name));
	const compare = (a: Item, b: Item) => {
		let result = 0;
		if (key === 'kind') result = collator.compare(kindOf(a), kindOf(b));
		else if (key === 'size') result = (a.size ?? -1) - (b.size ?? -1);
		else if (key === 'modified') result = (a.modified ?? 0) - (b.modified ?? 0);
		result ||= collator.compare(a.name, b.name);
		return desc ? -result : result;
	};
	return [...items].sort((a, b) => Number(b.folder) - Number(a.folder) || compare(a, b));
}

/** Search in the current folder: every word must occur in the name */
export function matches(item: Item, query: string): boolean {
	const name = item.name.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => name.includes(word));
}
