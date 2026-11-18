import { describe, expect, it } from 'vitest';
import { jsonlTreeFormat } from '../tree/jsonl';
import { applyChanges } from '../tree/model';
import { cellJson, jsonlFormat as f } from './jsonl';

const DOC = '{"id": 1, "name": "Anna"}\n{"id": 2, "tags": ["a"]}\nnot json\n42\n';
const t = f.parse(DOC, { header: false });
const apply = (spec: Parameters<typeof applyChanges>[1]) => applyChanges(DOC, spec);

describe('jsonl table', () => {
	it('makes columns from the keys and keeps other lines read-only', () => {
		expect(t.columns).toEqual(['id', 'name', 'tags']);
		expect(t.rows.map((r) => r.cells.map((c) => c?.text ?? null))).toEqual([
			['1', 'Anna', null],
			['2', null, '["a"]'],
			['not json'],
			['42']
		]);
		expect(t.rows.map((r) => !!r.broken)).toEqual([false, false, true, true]);
		expect(t.rows[0].cells[0]?.kind).toBe('number');
	});
	it('writes cells as JSON: strings stay strings, other values are taken as typed', () => {
		expect(apply(f.setCell(DOC, t, t.rows[0], 1, '7'))).toContain('"name": "7"');
		expect(apply(f.setCell(DOC, t, t.rows[0], 0, 'x'))).toContain('"id": "x"');
		expect(apply(f.setCell(DOC, t, t.rows[0], 0, '3.5'))).toContain('"id": 3.5');
		expect(apply(f.setCell(DOC, t, t.rows[1], 1, 'Ben'))).toContain('{"id": 2, "tags": ["a"], "name": "Ben"}');
		expect(f.setCell(DOC, t, t.rows[2], 0, 'x')).toBeNull();
		expect(cellJson('{"a": 1}', 'object')).toBe('{"a": 1}');
		expect(cellJson('{oops', 'object')).toBe('"{oops"');
	});
	it('renames, adds, removes and moves columns in every object line', () => {
		expect(apply(f.renameColumn(DOC, t, 0, 'key'))).toBe(DOC.replaceAll('"id"', '"key"'));
		expect(f.renameColumn(DOC, t, 0, 'name')).toBeNull();
		expect(apply(f.insertColumn(DOC, t, 3, 'x')).split('\n').slice(0, 2)).toEqual([
			'{"id": 1, "name": "Anna", "x": null}',
			'{"id": 2, "tags": ["a"], "x": null}'
		]);
		expect(apply(f.removeColumn(DOC, t, 0)).split('\n').slice(0, 2)).toEqual(['{"name": "Anna"}', '{"tags": ["a"]}']);
		expect(apply(f.moveColumn(DOC, t, 0, 1)).split('\n')[0]).toBe('{"name": "Anna", "id": 1}');
	});
	it('adds, removes, moves and sorts lines', () => {
		expect(apply(f.insertRow(DOC, t, 1)).split('\n')[1]).toBe('{}');
		expect(apply(f.removeRow(DOC, t, t.rows[0]))).toBe(DOC.slice(DOC.indexOf('\n') + 1));
		expect(apply(f.moveRow(DOC, t, t.rows[0], 1)).split('\n')[0]).toBe('{"id": 2, "tags": ["a"]}');
		expect(apply(f.sort(DOC, t, 0, true, 'en')).split('\n').slice(0, 2)).toEqual(['{"id": 2, "tags": ["a"]}', '{"id": 1, "name": "Anna"}']);
	});
});

describe('jsonl tree', () => {
	const tree = jsonlTreeFormat.parse(DOC);
	const lines = tree.root.children!;
	it('has one node per line and reports the first broken one', () => {
		expect(lines.map((n) => n.kind)).toEqual(['object', 'object', 'number']);
		expect(tree.error).toBe(DOC.indexOf('not json'));
	});
	it('edits inside a line stay on that line', () => {
		const ok = jsonlTreeFormat.parse('{"a": {}}\n{"b": 1}\n');
		const inner = ok.root.children![0].children![0];
		const out = applyChanges('{"a": {}}\n{"b": 1}\n', jsonlTreeFormat.insert('{"a": {}}\n{"b": 1}\n', inner, 0, { kind: 'entry', key: 'c', value: { kind: 'number', text: '1' } }));
		expect(out).toBe('{"a": {"c": 1}}\n{"b": 1}\n');
	});
	it('adds, duplicates, moves and removes whole lines', () => {
		const doc = '{"a": 1}\n{"b": 2}\n';
		const { root } = jsonlTreeFormat.parse(doc);
		const [first, second] = root.children!;
		expect(applyChanges(doc, jsonlTreeFormat.insert(doc, root, 2, { kind: 'item', value: { kind: 'object', text: '' } }))).toBe('{"a": 1}\n{"b": 2}\n{}\n');
		expect(applyChanges(doc, jsonlTreeFormat.duplicate(doc, root, first))).toBe('{"a": 1}\n{"a": 1}\n{"b": 2}\n');
		expect(applyChanges(doc, jsonlTreeFormat.move(doc, root, first, 1))).toBe('{"b": 2}\n{"a": 1}\n');
		expect(applyChanges(doc, jsonlTreeFormat.remove(doc, root, second))).toBe('{"a": 1}\n');
	});
});
