import { describe, expect, it } from 'vitest';
import { jsonlTreeFormat } from '../tree/jsonl';
import { applyChanges } from '../tree/model';
import { jsonlFormat as f } from './jsonl';

const DOC = '{"id": 1, "name": "Anna"}\n{"id": 2, "tags": ["a"]}\nnot json\n42\n';
const t = f.parse(DOC, { header: false });
const apply = (spec: Parameters<typeof applyChanges>[1]) => applyChanges(DOC, spec);

describe('jsonl table', () => {
	it('keeps lines that are no objects read-only', () => {
		expect(t.rows.map((r) => !!r.broken)).toEqual([false, false, true, true]);
		expect(f.setCell(DOC, t, t.rows[2], 0, 'x')).toBeNull();
	});
	it('writes cells as JSON: strings stay strings, other values are taken as typed', () => {
		expect(apply(f.setCell(DOC, t, t.rows[0], 1, '7'))).toBe(DOC.replace('"Anna"', '"7"'));
		expect(apply(f.setCell(DOC, t, t.rows[0], 0, 'x'))).toContain('"id": "x"');
		expect(apply(f.setCell(DOC, t, t.rows[0], 0, '3.5'))).toContain('"id": 3.5');
		expect(apply(f.setCell(DOC, t, t.rows[1], 1, 'Ben'))).toContain('{"id": 2, "tags": ["a"], "name": "Ben"}');
	});
});

describe('jsonl tree', () => {
	it('edits inside a line stay on that line', () => {
		const doc = '{"a": {}}\n{"b": 1}\n';
		const inner = jsonlTreeFormat.parse(doc).root.children![0].children![0];
		const out = applyChanges(doc, jsonlTreeFormat.insert(doc, inner, 0, { kind: 'entry', key: 'c', value: { kind: 'number', text: '1' } }));
		expect(out).toBe('{"a": {"c": 1}}\n{"b": 1}\n');
	});
});
