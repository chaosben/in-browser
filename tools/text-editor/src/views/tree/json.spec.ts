import { describe, expect, it } from 'vitest';
import { jsonFormat as f } from './json';
import { applyChanges, chainChanges, type TreeNode } from './model';

const parse = (doc: string) => f.parse(doc).root;
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => (typeof k === 'number' ? n.children![k] : n.children!.find((c) => c.key === k)!), root);
const roundTrip = (doc: string) => JSON.parse(doc) as unknown;

const PRETTY = '{\n  "name": "demo",\n  "list": [1, 2],\n  "nested": {\n    "on": true\n  }\n}\n';

describe('jsonFormat.parse', () => {
	it('reports the first syntax error and treats an empty text as a document', () => {
		expect(f.parse('{"a": 1,}').error).toBe(8);
		expect(f.parse('{"a": 1}').error).toBeNull();
		expect(parse('')).toMatchObject({ kind: 'document', children: [] });
	});
});

describe('jsonFormat edits', () => {
	it('changes a value and keeps everything else', () => {
		const out = applyChanges(PRETTY, f.setValue(PRETTY, child(parse(PRETTY), 'name'), { kind: 'string', text: 'a "b"' }));
		expect(out).toBe(PRETTY.replace('"demo"', '"a \\"b\\""'));
	});
	it('inserts with the layout of the siblings', () => {
		const root = parse(PRETTY);
		let out = applyChanges(PRETTY, f.insert(PRETTY, root, 1, { kind: 'entry', key: 'x', value: { kind: 'number', text: '5' } }));
		expect(out).toBe(PRETTY.replace('"name": "demo",\n', '"name": "demo",\n  "x": 5,\n'));
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
});

describe('several nodes at once', () => {
	it('chains edits on the text each one leaves (removing items from the end)', () => {
		const doc = '[1, 2, 3, 4]';
		const remove = (i: number) => (text: string) => {
			const root = parse(text);
			return f.remove(text, root, root.children![i]);
		};
		expect(applyChanges(doc, chainChanges(doc, [remove(3), remove(1)]))).toBe('[1, 3]');
	});
});
