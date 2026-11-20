import { describe, expect, it } from 'vitest';
import { applyChanges } from '../tree/model';
import { csvFormat } from './csv';
import { moveOrder, removeRows, rewriteRows } from './model';

const csv = csvFormat();
const texts = (doc: string, header = true) => {
	const t = csv.parse(doc, { header });
	return { columns: t.columns, rows: t.rows.map((r) => r.cells.map((c) => c?.text)) };
};

const DOC = 'name,age,city\nAnna,31,"Berlin, Mitte"\nBen,4,Köln\n"Carl ""C""",10,\n';

describe('csv parse', () => {
	it('reads quotes, doubled quotes, empty cells and the header', () => {
		expect(texts(DOC)).toEqual({
			columns: ['name', 'age', 'city'],
			rows: [
				['Anna', '31', 'Berlin, Mitte'],
				['Ben', '4', 'Köln'],
				['Carl "C"', '10', '']
			]
		});
		expect(texts('a,b\n1,2', false).columns).toEqual(['A', 'B']);
	});
	it('keeps line breaks inside quoted cells and reports an open quote', () => {
		expect(texts('a\n"x\ny"\n').rows).toEqual([['x\ny']]);
		expect(csv.parse('a\n"open', { header: true }).error).toBe(2);
		expect(csv.parse(DOC, { header: true }).error).toBeNull();
	});
});

describe('csv edits', () => {
	const t = csv.parse(DOC, { header: true });
	const apply = (spec: Parameters<typeof applyChanges>[1]) => applyChanges(DOC, spec);

	it('sets cells with quoting only where needed', () => {
		expect(apply(csv.setCell(DOC, t, t.rows[1], 2, 'Köln, Ehrenfeld'))).toBe(DOC.replace('Köln', '"Köln, Ehrenfeld"'));
		expect(apply(csv.setCell(DOC, t, t.rows[0], 0, 'Ann'))).toBe(DOC.replace('Anna', 'Ann'));
		expect(apply(csv.setCell(DOC, t, t.rows[2], 2, 'say "hi"'))).toBe(DOC.replace('10,\n', '10,"say ""hi"""\n'));
		expect(csv.setCell(DOC, t, t.rows[0], 0, 'Anna')).toBeNull();
	});
	it('extends short rows and quotes everything when the file does', () => {
		const doc = 'a,b,c\n1\n';
		const table = csv.parse(doc, { header: true });
		expect(applyChanges(doc, csv.setCell(doc, table, table.rows[0], 2, 'x'))).toBe('a,b,c\n1,,x\n');
		const quoted = '"a","b"\n"1","2"\n';
		const q = csv.parse(quoted, { header: true });
		expect(applyChanges(quoted, csv.setCell(quoted, q, q.rows[0], 1, '3'))).toBe('"a","b"\n"1","3"\n');
	});
	it('moves columns in short rows by padding them', () => {
		const doc = 'a,b,c\n1\n';
		const table = csv.parse(doc, { header: true });
		expect(applyChanges(doc, csv.moveColumn(doc, table, 0, 1))).toBe('b,a,c\n,1\n');
	});
	it('sorts numbers by value, text naturally, empty cells last', () => {
		expect(apply(csv.sort(DOC, t, 1, false, 'en'))).toBe('name,age,city\nBen,4,Köln\n"Carl ""C""",10,\nAnna,31,"Berlin, Mitte"\n');
		expect(apply(csv.sort(DOC, t, 1, true, 'en'))).toBe('name,age,city\nAnna,31,"Berlin, Mitte"\n"Carl ""C""",10,\nBen,4,Köln\n');
		const sorted = apply(csv.sort(DOC, t, 2, false, 'de'));
		expect(sorted.split('\n').slice(1, 4)).toEqual(['Anna,31,"Berlin, Mitte"', 'Ben,4,Köln', '"Carl ""C""",10,']);
		const decimals = 'x\n1,5\n1,25\n-3\n';
		const semi = csvFormat(';').parse(decimals, { header: true });
		expect(applyChanges(decimals, csvFormat(';').sort(decimals, semi, 0, false, 'de'))).toBe('x\n-3\n1,25\n1,5\n');
	});
});

describe('several rows at once (one change)', () => {
	const doc = 'h\na\nb\nc\nd';
	const rows = csv.parse(doc, { header: true }).rows;
	it.each([
		[[0, 1], 'h\nc\nd'],
		[[0, 2], 'h\nb\nd'],
		[[1, 3], 'h\na\nc'],
		[[0, 1, 2, 3], 'h']
	])('removes rows %j', (picked, out) => {
		expect(applyChanges(doc, removeRows(doc, rows, picked.map((i) => rows[i])))).toBe(out);
	});
	it.each([
		[[1, 2], -1, [1, 2, 0, 3]],
		[[0, 2], -1, [0, 2, 1, 3]],
		[[0, 1], 1, [2, 0, 1, 3]],
		[[3], 1, [0, 1, 2, 3]]
	] as const)('moves rows %j by %i', (picked, delta, order) => {
		expect(moveOrder(4, new Set(picked), delta)).toEqual(order);
		expect(applyChanges(doc, rewriteRows(doc, rows, order.map((i) => rows[i])))).toBe(`h\n${order.map((i) => 'abcd'[i]).join('\n')}`);
	});
});
