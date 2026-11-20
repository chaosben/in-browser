import type { ChangeSpec } from '@codemirror/state';
import type { NodeKind, Range } from '../tree/model.js';

// The table behind the table view (CSV, TSV, JSON Lines). As with the tree, the text stays the only source: every
// cell knows its place in the text, and every edit changes only what it has to. Positions are offsets in the
// editor's text (line breaks always `\n`).

export interface Cell {
	/** As shown (decoded: no quotes, no escapes) */
	text: string;
	/** Raw cell in the text, quotes included */
	range: Range;
	/** Kind of a JSON value; numbers are aligned right */
	kind?: NodeKind;
}

export interface Row {
	/** Cells by column; `null`: the row has no value there (short CSV row, missing JSON key) */
	cells: (Cell | null)[];
	/** The whole record without its line break */
	range: Range;
	/** The row can't be edited (a JSON line that isn't an object or doesn't parse) */
	broken?: boolean;
}

export interface TableParse {
	/** First record when it holds the column names (CSV with header on); JSON Lines have none */
	header: Row | null;
	rows: Row[];
	/** Column titles: header cells, keys, or A, B, C … */
	columns: string[];
	/** Position of the first syntax error (the table is then not edited) */
	error: number | null;
}

export interface TableOptions {
	/** The first record holds the column names (CSV only) */
	header: boolean;
	/** Delimiter instead of the detected one (CSV only) */
	delimiter?: string;
}

/** One file format of the table view; every edit returns the changes for CodeMirror (`null`: not possible) */
export interface TableFormat {
	/** The view lets the user pick a delimiter and whether there is a header (CSV) */
	readonly delimited: boolean;
	parse(doc: string, options: TableOptions): TableParse;
	/** Delimiter actually used for the last parse (CSV) */
	delimiterOf?(doc: string, options: TableOptions): string;
	setCell(doc: string, table: TableParse, row: Row, column: number, text: string): ChangeSpec | null;
	renameColumn(doc: string, table: TableParse, column: number, name: string): ChangeSpec | null;
	/** New empty row at `index` among the data rows */
	insertRow(doc: string, table: TableParse, index: number): ChangeSpec | null;
	removeRow(doc: string, table: TableParse, row: Row): ChangeSpec | null;
	moveRow(doc: string, table: TableParse, row: Row, delta: -1 | 1): ChangeSpec | null;
	insertColumn(doc: string, table: TableParse, index: number, name: string): ChangeSpec | null;
	removeColumn(doc: string, table: TableParse, column: number): ChangeSpec | null;
	moveColumn(doc: string, table: TableParse, column: number, delta: -1 | 1): ChangeSpec | null;
	/** Rewrites the data rows in the order of a column */
	sort(doc: string, table: TableParse, column: number, descending: boolean, locale: string): ChangeSpec | null;
}

/** Column letters like a spreadsheet: A … Z, AA … */
export function columnLetter(index: number): string {
	let name = '';
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
	return name;
}

/** Removes a record together with one line break next to it */
export function removeLine(doc: string, range: Range): ChangeSpec {
	if (doc[range.to] === '\n') return { from: range.from, to: range.to + 1 };
	return { from: Math.max(0, range.from - 1), to: range.to };
}

const NUMBER = /^\s*[-+]?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?\s*$/;

/**
 * Order of cells for sorting: numbers by value (also with a decimal comma), other text naturally in the user's
 * language ("2" before "10"); empty cells always last.
 */
export function cellComparer(locale: string, descending: boolean) {
	const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
	const sign = descending ? -1 : 1;
	return (a: string | undefined, b: string | undefined) => {
		const emptyA = !a?.trim();
		const emptyB = !b?.trim();
		if (emptyA || emptyB) return Number(emptyA) - Number(emptyB);
		if (NUMBER.test(a!) && NUMBER.test(b!)) {
			const x = Number(a!.replace(',', '.'));
			const y = Number(b!.replace(',', '.'));
			if (x !== y) return sign * (x - y);
		}
		return sign * collator.compare(a!, b!);
	};
}

/** Changes that put the given records (raw texts) in place of the data rows */
export function rewriteRows(doc: string, rows: Row[], order: Row[]): ChangeSpec | null {
	if (rows.length < 2) return null;
	const text = order.map((r) => doc.slice(r.range.from, r.range.to)).join('\n');
	const from = rows[0].range.from;
	const to = rows[rows.length - 1].range.to;
	return text === doc.slice(from, to) ? null : { from, to, insert: text };
}

/** Rows sorted by a column, stable (equal cells keep their order) */
export function sortedRows(rows: Row[], column: number, descending: boolean, locale: string): Row[] {
	const compare = cellComparer(locale, descending);
	return rows
		.map((row, i) => ({ row, i }))
		.sort((a, b) => compare(a.row.cells[column]?.text, b.row.cells[column]?.text) || a.i - b.i)
		.map((x) => x.row);
}

/** Removes several records as one change: neighbours together, each run of them with one line break */
export function removeRows(doc: string, rows: readonly Row[], picked: readonly Row[]): ChangeSpec | null {
	const remove = new Set(picked);
	const changes: ChangeSpec[] = [];
	let run: Row[] = [];
	const flush = () => {
		if (run.length) changes.push(removeLine(doc, { from: run[0].range.from, to: run[run.length - 1].range.to }));
		run = [];
	};
	for (const row of rows) {
		if (remove.has(row)) run.push(row);
		else flush();
	}
	flush();
	return changes.length ? changes : null;
}

/**
 * New order of `count` rows when the picked ones (indices) move one place up (`-1`) or down: each passes the
 * neighbour that isn't picked; a block at the edge stays. Returns the old indices in their new order.
 */
export function moveOrder(count: number, picked: ReadonlySet<number>, delta: -1 | 1): number[] {
	const order = Array.from({ length: count }, (_, i) => i);
	const swap = (i: number, j: number) => ([order[i], order[j]] = [order[j], order[i]]);
	if (delta < 0) {
		for (let i = 1; i < count; i++) if (picked.has(order[i]) && !picked.has(order[i - 1])) swap(i, i - 1);
	} else {
		for (let i = count - 2; i >= 0; i--) if (picked.has(order[i]) && !picked.has(order[i + 1])) swap(i, i + 1);
	}
	return order;
}
