import type { ChangeSpec } from '@codemirror/state';
import {
	columnLetter,
	removeLine,
	rewriteRows,
	sortedRows,
	type Cell,
	type Row,
	type TableFormat,
	type TableOptions,
	type TableParse
} from './model.js';

// CSV and TSV (RFC 4180: quotes, doubled quotes, line breaks inside quoted cells). The delimiter is detected from
// the first lines unless the user picks one; cells are only quoted where they must be – or always, when the file
// quotes most of its cells already.

export const DELIMITERS = [',', ';', '\t', '|'] as const;
const SAMPLE_LINES = 20;

/** The delimiter that splits the first lines most consistently into more than one cell (default: comma) */
export function detectDelimiter(doc: string): string {
	let best = ',';
	let bestScore = 0;
	for (const delimiter of DELIMITERS) {
		const counts: number[] = [];
		let count = 0;
		let quoted = false;
		for (let i = 0; i < doc.length && counts.length < SAMPLE_LINES; i++) {
			const ch = doc[i];
			if (ch === '"') quoted = !quoted;
			else if (!quoted && ch === delimiter) count++;
			else if (!quoted && ch === '\n') {
				counts.push(count);
				count = 0;
			}
		}
		if (count || !counts.length) counts.push(count);
		const first = counts[0];
		if (!first) continue;
		// Lines that agree with the first one, weighted by how many cells they make
		const score = counts.filter((c) => c === first).length * Math.log2(first + 1);
		if (score > bestScore) {
			bestScore = score;
			best = delimiter;
		}
	}
	return best;
}

interface Records {
	records: Row[];
	error: number | null;
	/** Share of non-empty cells that are quoted */
	quotedShare: number;
}

function parseRecords(doc: string, delimiter: string): Records {
	const records: Row[] = [];
	let error: number | null = null;
	let quoted = 0;
	let filled = 0;
	let cells: Cell[] = [];
	let start = 0;
	let i = 0;
	const n = doc.length;
	while (i <= n) {
		// One cell starting at i
		const from = i;
		let text: string;
		if (doc[i] === '"') {
			let j = i + 1;
			let value = '';
			for (;;) {
				const close = doc.indexOf('"', j);
				if (close < 0) {
					error ??= from;
					value += doc.slice(j);
					j = n;
					break;
				}
				value += doc.slice(j, close);
				if (doc[close + 1] === '"') {
					value += '"';
					j = close + 2;
				} else {
					j = close + 1;
					break;
				}
			}
			// Anything between the closing quote and the delimiter is a mistake; it is kept in the text
			let end = j;
			while (end < n && doc[end] !== delimiter && doc[end] !== '\n') end++;
			if (end > j) {
				error ??= j;
				value += doc.slice(j, end);
			}
			text = value;
			i = end;
			quoted++;
		} else {
			let end = i;
			while (end < n && doc[end] !== delimiter && doc[end] !== '\n') end++;
			text = doc.slice(i, end);
			i = end;
		}
		if (text) filled++;
		cells.push({ text, range: { from, to: i } });
		if (i < n && doc[i] === delimiter) {
			i++;
			continue;
		}
		// End of the record (line break or end of text); a final line break doesn't start another one
		records.push({ cells, range: { from: start, to: i } });
		i++;
		start = i;
		cells = [];
		if (i === n) break;
	}
	if (n === 0) records.length = 0;
	return { records, error, quotedShare: filled ? quoted / filled : 0 };
}

function encoder(delimiter: string, quoteAll: boolean) {
	return (text: string) =>
		quoteAll || text.includes(delimiter) || /["\n\r]/.test(text) || (text !== text.trim() && delimiter !== '\t')
			? `"${text.replaceAll('"', '""')}"`
			: text;
}

/** Everything an edit needs: parsed records plus how to write cells */
interface Parsed extends TableParse {
	delimiter: string;
	encode: (text: string) => string;
}

export function csvFormat(defaultDelimiter?: string): TableFormat {
	const delimiterOf = (doc: string, options: TableOptions) => options.delimiter ?? defaultDelimiter ?? detectDelimiter(doc);

	const all = (table: TableParse) => (table.header ? [table.header, ...table.rows] : table.rows);
	const width = (table: TableParse) => table.columns.length;

	/** Raw texts of a record's cells, padded to `length` */
	const rawCells = (doc: string, row: Row, length: number) =>
		Array.from({ length: Math.max(length, row.cells.length) }, (_, i) => {
			const cell = row.cells[i];
			return cell ? doc.slice(cell.range.from, cell.range.to) : '';
		});

	function setCell(doc: string, table: TableParse, row: Row, column: number, text: string): ChangeSpec | null {
		const { delimiter, encode } = table as Parsed;
		const cell = row.cells[column];
		if (cell) return cell.text === text ? null : { ...cell.range, insert: encode(text) };
		if (!text) return null;
		return { from: row.range.to, insert: delimiter.repeat(column - row.cells.length + 1) + encode(text) };
	}

	return {
		delimited: true,
		delimiterOf,

		parse(doc, options) {
			const delimiter = delimiterOf(doc, options);
			const { records, error, quotedShare } = parseRecords(doc, delimiter);
			const header = options.header && records.length ? records[0] : null;
			const rows = header ? records.slice(1) : records;
			const count = records.reduce((max, r) => Math.max(max, r.cells.length), 0);
			const columns = Array.from({ length: count }, (_, i) => header?.cells[i]?.text || columnLetter(i));
			const parsed: Parsed = { header, rows, columns, error, delimiter, encode: encoder(delimiter, quotedShare > 0.5) };
			return parsed;
		},

		setCell,

		renameColumn(doc, table, column, name) {
			return table.header ? setCell(doc, table, table.header, column, name) : null;
		},

		insertRow(doc, table, index) {
			const { delimiter } = table as Parsed;
			const empty = delimiter.repeat(Math.max(width(table), 1) - 1);
			const next = table.rows[index];
			if (next) return { from: next.range.from, insert: `${empty}\n` };
			const last = all(table).at(-1);
			if (!last) return { from: 0, insert: `${empty}\n` };
			return { from: last.range.to, insert: `\n${empty}` };
		},

		removeRow(doc, _table, row) {
			return removeLine(doc, row.range);
		},

		moveRow(doc, table, row, delta) {
			const i = table.rows.indexOf(row);
			const other = table.rows[i + delta];
			if (i < 0 || !other) return null;
			const order = [...table.rows];
			[order[i], order[i + delta]] = [other, row];
			return rewriteRows(doc, table.rows, order);
		},

		insertColumn(doc, table, index, name) {
			const { delimiter, encode } = table as Parsed;
			const changes: ChangeSpec[] = [];
			for (const row of all(table)) {
				const value = row === table.header ? encode(name) : '';
				const cell = row.cells[index];
				if (cell) changes.push({ from: cell.range.from, insert: value + delimiter });
				else if (row === table.header) {
					changes.push({ from: row.range.to, insert: delimiter.repeat(index - row.cells.length + 1) + value });
				}
			}
			return changes;
		},

		removeColumn(_doc, table, column) {
			const changes: ChangeSpec[] = [];
			for (const row of all(table)) {
				const { cells } = row;
				const cell = cells[column];
				if (!cell) continue;
				if (cells.length === 1) changes.push(cell.range);
				else if (column < cells.length - 1) changes.push({ from: cell.range.from, to: cells[column + 1]!.range.from });
				else changes.push({ from: cells[column - 1]!.range.to, to: cell.range.to });
			}
			return changes;
		},

		moveColumn(doc, table, column, delta) {
			const other = column + delta;
			if (other < 0 || other >= width(table)) return null;
			const { delimiter } = table as Parsed;
			const changes: ChangeSpec[] = [];
			for (const row of all(table)) {
				const a = row.cells[column];
				const b = row.cells[other];
				if (a && b) {
					changes.push({ ...a.range, insert: doc.slice(b.range.from, b.range.to) });
					changes.push({ ...b.range, insert: doc.slice(a.range.from, a.range.to) });
				} else if (a || b) {
					// A short row: written anew, padded up to the column
					const raw = rawCells(doc, row, Math.max(column, other) + 1);
					[raw[column], raw[other]] = [raw[other], raw[column]];
					while (raw.length > 1 && raw.at(-1) === '' && raw.length > row.cells.length) raw.pop();
					changes.push({ ...row.range, insert: raw.join(delimiter) });
				}
			}
			return changes;
		},

		sort(doc, table, column, descending, locale) {
			return rewriteRows(doc, table.rows, sortedRows(table.rows, column, descending, locale));
		}
	};
}
