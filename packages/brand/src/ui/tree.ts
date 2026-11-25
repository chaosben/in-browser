// The keys of a tree shown as rows, the same in every tool (the Text Editor's tree, the PDF Editor's bookmarks):
// ↑/↓ to the row above or below, Home/End to the first or last, → opens an entry or goes to its first entry, ← closes
// it or goes to the entry holding it. The tree decides what a step means for its selection (Shift extends).

export interface TreeRow<K> {
	id: K;
	/** The entry holding it (null at the top) */
	parent: K | null;
	/** It holds entries (it can be opened) */
	container: boolean;
	open: boolean;
}

/** What a key does: go to a row (its index), open or close an entry, nothing (`stay`: the key is the tree's all the
 * same); null: not a key of the tree */
export type TreeStep<K> = { go: number } | { open: K } | { close: K } | { stay: true } | null;

export function treeKey<K>(key: string, rows: readonly TreeRow<K>[], index: number): TreeStep<K> {
	if (key === 'ArrowDown') return { go: Math.min(rows.length - 1, index + 1) };
	if (key === 'ArrowUp') return { go: Math.max(0, index - 1) };
	if (key === 'Home') return { go: 0 };
	if (key === 'End') return { go: rows.length - 1 };
	const row = rows[index];
	if (!row) return null;
	if (key === 'ArrowRight') {
		if (row.container && !row.open) return { open: row.id };
		return rows[index + 1]?.parent === row.id ? { go: index + 1 } : { stay: true };
	}
	if (key === 'ArrowLeft') {
		if (row.open) return { close: row.id };
		const parent = rows.findIndex((r) => r.id === row.parent);
		return parent >= 0 ? { go: parent } : { stay: true };
	}
	return null;
}
