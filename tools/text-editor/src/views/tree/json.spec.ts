import { describe, expect, it } from 'vitest';
import { jsonFormat as f } from './json';
import { applyChanges, nodeAt, type TreeNode } from './model';

const parse = (doc: string) => f.parse(doc).root;
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => (typeof k === 'number' ? n.children![k] : n.children!.find((c) => c.key === k)!), root);
const roundTrip = (doc: string) => JSON.parse(doc) as unknown;

const PRETTY = '{\n  "name": "demo",\n  "list": [1, 2],\n  "nested": {\n    "on": true\n  }\n}\n';

describe('jsonFormat.parse', () => {
	it('builds nodes with positions and decoded values', () => {
		const root = parse('{"a": "x\\ny", "b": [1, null]}');
		expect(root.kind).toBe('object');
		const a = child(root, 'a');
		expect(a).toMatchObject({ kind: 'string', value: 'x\ny', key: 'a' });
		expect(child(root, 'b', 1)).toMatchObject({ kind: 'null', value: 'null' });
		expect(nodeAt(root, 24).map((n) => n.key ?? '#')).toEqual(['b', '#']);
	});
	it('reports the first syntax error and treats an empty text as a document', () => {
		expect(f.parse('{"a": 1,}').error).toBe(8);
		expect(f.parse('{"a": 1}').error).toBeNull();
		expect(parse('')).toMatchObject({ kind: 'document', children: [] });
	});
	it('wraps a scalar at the top', () => {
		const root = parse('42');
		expect(root.kind).toBe('document');
		expect(root.children![0]).toMatchObject({ kind: 'number', value: '42' });
	});
});

describe('jsonFormat edits', () => {
	it('changes a value and keeps everything else', () => {
		const out = applyChanges(PRETTY, f.setValue(PRETTY, child(parse(PRETTY), 'name'), { kind: 'string', text: 'a "b"' }));
		expect(out).toBe(PRETTY.replace('"demo"', '"a \\"b\\""'));
	});
	it('changes the kind of a value', () => {
		const out = applyChanges(PRETTY, f.setValue(PRETTY, child(parse(PRETTY), 'list'), { kind: 'object', text: '' }));
		expect(roundTrip(out)).toMatchObject({ list: {} });
	});
	it('renames a key', () => {
		const out = applyChanges(PRETTY, f.rename(PRETTY, child(parse(PRETTY), 'nested'), 'inner'));
		expect(Object.keys(roundTrip(out) as object)).toEqual(['name', 'list', 'inner']);
	});
	it('inserts with the layout of the siblings', () => {
		const root = parse(PRETTY);
		let out = applyChanges(PRETTY, f.insert(PRETTY, root, 1, { kind: 'entry', key: 'x', value: { kind: 'number', text: '5' } }));
		expect(out).toBe(PRETTY.replace('"name": "demo",\n', '"name": "demo",\n  "x": 5,\n'));
		out = applyChanges(PRETTY, f.insert(PRETTY, child(root, 'list'), 2, { kind: 'item', value: { kind: 'string', text: 'z' } }));
		expect(out).toContain('[1, 2, "z"]');
		out = applyChanges(PRETTY, f.insert(PRETTY, root, 3, { kind: 'entry', key: 'end', value: { kind: 'null', text: '' } }));
		expect(out).toContain('    "on": true\n  },\n  "end": null\n}');
	});
	it('fills an empty container on its own lines, or inline when minified', () => {
		const doc = '{\n  "a": {}\n}';
		const out = applyChanges(doc, f.insert(doc, child(parse(doc), 'a'), 0, { kind: 'entry', key: 'b', value: { kind: 'boolean', text: 'true' } }));
		expect(out).toBe('{\n  "a": {\n    "b": true\n  }\n}');
		const min = '{"a":[]}';
		expect(applyChanges(min, f.insert(min, child(parse(min), 'a'), 0, { kind: 'item', value: { kind: 'number', text: '1' } }))).toBe('{"a":[1]}');
		expect(applyChanges('', f.insert('', parse(''), 0, { kind: 'item', value: { kind: 'object', text: '' } }))).toBe('{}');
	});
	it('removes entries with their separators', () => {
		const root = parse(PRETTY);
		expect(roundTrip(applyChanges(PRETTY, f.remove(PRETTY, root, child(root, 'name'))))).toEqual({ list: [1, 2], nested: { on: true } });
		expect(roundTrip(applyChanges(PRETTY, f.remove(PRETTY, root, child(root, 'nested'))))).toEqual({ name: 'demo', list: [1, 2] });
		const list = child(root, 'list');
		const once = applyChanges(PRETTY, f.remove(PRETTY, list, list.children![1]));
		expect(once).toContain('"list": [1]');
		const again = child(parse(once), 'list');
		const empty = applyChanges(once, f.remove(once, again, again.children![0]));
		expect(empty).toContain('"list": []');
	});
	it('duplicates with a free key and moves entries', () => {
		const root = parse(PRETTY);
		const dup = applyChanges(PRETTY, f.duplicate(PRETTY, root, child(root, 'name')));
		expect(Object.keys(roundTrip(dup) as object)).toEqual(['name', 'name 2', 'list', 'nested']);
		const moved = applyChanges(PRETTY, f.move(PRETTY, root, child(root, 'name'), 1));
		expect(Object.keys(roundTrip(moved) as object)).toEqual(['list', 'name', 'nested']);
		expect(f.move(PRETTY, root, child(root, 'name'), -1)).toBeNull();
	});
});
