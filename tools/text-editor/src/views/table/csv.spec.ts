import { describe, expect, it } from 'vitest';
import { applyChanges } from '../tree/model';
import { csvFormat, detectDelimiter } from './csv';
import { columnLetter } from './model';

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
	it('handles empty text, blank lines and a missing final line break', () => {
		expect(texts('', false).rows).toEqual([]);
		expect(texts('a\n\nb', false).rows).toEqual([['a'], [''], ['b']]);
	});
	it('detects the delimiter', () => {
		expect(detectDelimiter('a;b;c\n1;2,5;3\n')).toBe(';');
		expect(detectDelimiter('a\tb\n1\t2\n')).toBe('\t');
		expect(detectDelimiter('"x;y",b\n1,2\n')).toBe(',');
		expect(detectDelimiter('single\n')).toBe(',');
		expect(csvFormat('\t').parse('a,b\tc', { header: false }).columns).toEqual(['A', 'B']);
	});
	it('names columns like a spreadsheet', () => {
		expect([0, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
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
	it('renames columns through the header', () => {
		expect(apply(csv.renameColumn(DOC, t, 1, 'Alter'))).toBe(DOC.replace('age', 'Alter'));
		const plain = csv.parse(DOC, { header: false });
		expect(csv.renameColumn(DOC, plain, 1, 'x')).toBeNull();
	});
	it('inserts, removes and moves rows', () => {
		expect(apply(csv.insertRow(DOC, t, 1))).toBe(DOC.replace('Ben', ',,\nBen'));
		expect(apply(csv.insertRow(DOC, t, 3))).toBe(DOC.replace('10,\n', '10,\n,,\n'));
		expect(apply(csv.removeRow(DOC, t, t.rows[0]))).toBe(DOC.replace('Anna,31,"Berlin, Mitte"\n', ''));
		expect(apply(csv.moveRow(DOC, t, t.rows[1], -1))).toBe('name,age,city\nBen,4,Köln\nAnna,31,"Berlin, Mitte"\n"Carl ""C""",10,\n');
		expect(csv.moveRow(DOC, t, t.rows[0], -1)).toBeNull();
		const empty = csv.parse('', { header: false });
		expect(applyChanges('', csv.insertRow('', empty, 0))).toBe('\n');
	});
	it('inserts, removes and moves columns', () => {
		expect(apply(csv.insertColumn(DOC, t, 1, 'id'))).toBe('name,id,age,city\nAnna,,31,"Berlin, Mitte"\nBen,,4,Köln\n"Carl ""C""",,10,\n');
		expect(apply(csv.insertColumn(DOC, t, 3, 'zip'))).toBe(DOC.replace('city', 'city,zip'));
		expect(apply(csv.removeColumn(DOC, t, 2))).toBe('name,age\nAnna,31\nBen,4\n"Carl ""C""",10\n');
		expect(apply(csv.removeColumn(DOC, t, 0))).toBe('age,city\n31,"Berlin, Mitte"\n4,Köln\n10,\n');
		expect(apply(csv.moveColumn(DOC, t, 0, 1))).toBe('age,name,city\n31,Anna,"Berlin, Mitte"\n4,Ben,Köln\n10,"Carl ""C""",\n');
		expect(csv.moveColumn(DOC, t, 2, 1)).toBeNull();
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
