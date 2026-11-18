import type { ChangeSpec } from '@codemirror/state';
import { encodeValue, insertRaw, jsonFormat, parseJson, removeEntry } from '../tree/json.js';
import { guessKind, swap, type TreeNode } from '../tree/model.js';
import { removeLine, rewriteRows, sortedRows, type Cell, type Row, type TableFormat, type TableParse } from './model.js';

// JSON Lines (one JSON value per line) as a table: one row per line, the columns are the keys of the objects in the
// order they first appear. A cell edit changes that value in its line only; lines that aren't objects (or don't
// parse) are shown but not edited.

export interface JsonLine {
	/** Parsed line; positions are offsets in the whole text */
	root: TreeNode;
	error: number | null;
	range: { from: number; to: number };
}

/** Every non-empty line, parsed on its own */
export function parseLines(doc: string): JsonLine[] {
	const lines: JsonLine[] = [];
	let from = 0;
	let index = 0;
	while (from <= doc.length) {
		let to = doc.indexOf('\n', from);
		if (to < 0) to = doc.length;
		const text = doc.slice(from, to);
		if (text.trim()) {
			const { root, error } = parseJson(text, from, `/#${index}`);
			lines.push({ root, error, range: { from, to } });
		}
		index++;
		from = to + 1;
	}
	return lines;
}

/** A value as shown in a cell: strings without quotes, everything else as JSON */
function cellOf(doc: string, node: TreeNode): Cell {
	const range = node.valueRange ?? node.range;
	return { text: node.kind === 'string' ? node.value! : doc.slice(range.from, range.to), range, kind: node.kind };
}

/** What a typed cell becomes: a string stays a string, otherwise valid JSON is taken as is */
export function cellJson(text: string, kind: string | undefined): string {
	if (kind !== 'string' && guessKind(text) !== 'string') return text.trim();
	if (kind !== 'string' && /^\s*[[{"]/.test(text)) {
		try {
			JSON.parse(text);
			return text.trim();
		} catch {
			// Not JSON: a string
		}
	}
	return encodeValue({ kind: 'string', text });
}

interface Parsed extends TableParse {
	/** Parsed line of every row */
	lines: Map<Row, JsonLine>;
}

const objectOf = (table: TableParse, row: Row) => {
	const line = (table as Parsed).lines.get(row);
	return line && !line.error && line.root.kind === 'object' ? line.root : null;
};

const entry = (root: TreeNode, key: string) => root.children?.find((c) => c.key === key);

export const jsonlFormat: TableFormat = {
	delimited: false,

	parse(doc) {
		const lines = parseLines(doc);
		const columns: string[] = [];
		const seen = new Set<string>();
		for (const line of lines) {
			if (line.error || line.root.kind !== 'object') continue;
			for (const child of line.root.children!) {
				if (!seen.has(child.key!)) {
					seen.add(child.key!);
					columns.push(child.key!);
				}
			}
		}
		const map = new Map<Row, JsonLine>();
		const rows = lines.map((line): Row => {
			const { root } = line;
			let row: Row;
			if (line.error || root.kind !== 'object') {
				// Not an object: the whole line in the first column, read-only
				const text = doc.slice(line.range.from, line.range.to).trim();
				row = { cells: [{ text, range: line.range, kind: root.children?.[0]?.kind }], range: line.range, broken: true };
			} else row = { cells: columns.map((key) => ((n) => (n ? cellOf(doc, n) : null))(entry(root, key))), range: line.range };
			map.set(row, line);
			return row;
		});
		return { header: null, rows, columns, error: null, lines: map } satisfies Parsed;
	},

	setCell(doc, table, row, column, text) {
		const root = objectOf(table, row);
		if (!root) return null;
		const key = table.columns[column];
		const node = entry(root, key);
		if (node) {
			const insert = cellJson(text, node.kind);
			const range = node.valueRange!;
			return insert === doc.slice(range.from, range.to) ? null : { ...range, insert };
		}
		if (!text) return null;
		return insertRaw(doc, root, root.children!.length, `${JSON.stringify(key)}: ${cellJson(text, undefined)}`, true);
	},

	renameColumn(doc, table, column, name) {
		const key = table.columns[column];
		if (!name || name === key || table.columns.includes(name)) return null;
		const changes: ChangeSpec[] = [];
		for (const row of table.rows) {
			const node = ((root) => root && entry(root, key))(objectOf(table, row));
			if (node) changes.push(jsonFormat.rename(doc, node, name)!);
		}
		return changes;
	},

	insertRow(_doc, table, index) {
		const next = table.rows[index];
		if (next) return { from: next.range.from, insert: '{}\n' };
		const last = table.rows.at(-1);
		return last ? { from: last.range.to, insert: '\n{}' } : { from: 0, insert: '{}\n' };
	},

	removeRow: (doc, _table, row) => removeLine(doc, row.range),

	moveRow(doc, table, row, delta) {
		const i = table.rows.indexOf(row);
		const other = table.rows[i + delta];
		if (i < 0 || !other) return null;
		const order = [...table.rows];
		[order[i], order[i + delta]] = [other, row];
		return rewriteRows(doc, table.rows, order);
	},

	insertColumn(doc, table, _index, name) {
		if (!name || table.columns.includes(name)) return null;
		const changes: ChangeSpec[] = [];
		for (const row of table.rows) {
			const root = objectOf(table, row);
			if (root) changes.push(insertRaw(doc, root, root.children!.length, `${JSON.stringify(name)}: null`, true)!);
		}
		return changes;
	},

	removeColumn(_doc, table, column) {
		const key = table.columns[column];
		const changes: ChangeSpec[] = [];
		for (const row of table.rows) {
			const root = objectOf(table, row);
			const node = root && entry(root, key);
			if (root && node) changes.push(removeEntry(root, node)!);
		}
		return changes;
	},

	moveColumn(doc, table, column, delta) {
		const a = table.columns[column];
		const b = table.columns[column + delta];
		if (b === undefined) return null;
		const changes: ChangeSpec[] = [];
		for (const row of table.rows) {
			const root = objectOf(table, row);
			const x = root && entry(root, a);
			const y = root && entry(root, b);
			if (x && y) changes.push(swap(doc, x.range, y.range));
		}
		return changes;
	},

	sort(doc, table, column, descending, locale) {
		// Lines that aren't objects have no value in the column: they go last
		const sorted = sortedRows(table.rows.filter((r) => !r.broken), column, descending, locale);
		return rewriteRows(doc, table.rows, [...sorted, ...table.rows.filter((r) => r.broken)]);
	}
};
