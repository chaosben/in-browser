import { describe, expect, it } from 'vitest';
import { applyChanges, nodeAt, type NewValue, type TreeNode } from './model';
import { yamlFormat as f } from './yaml';

const parse = (doc: string) => f.parse(doc).root;
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => (typeof k === 'number' ? n.children![k] : n.children!.find((c) => c.key === k)!), root);

/** Plain data of a parsed text (also checks that it still parses without error) */
function data(doc: string): unknown {
	const { root, error } = f.parse(doc);
	expect(error, doc).toBeNull();
	const plain = (n: TreeNode): unknown => {
		if (n.kind === 'object') return Object.fromEntries(n.children!.map((c) => [c.key, plain(c)]));
		if (n.kind === 'array' || n.kind === 'document') return n.children!.map(plain);
		if (n.kind === 'number') return Number(n.value!.replace(/^0o/, '0o'));
		if (n.kind === 'boolean') return n.value!.toLowerCase() === 'true';
		if (n.kind === 'null') return null;
		return n.value;
	};
	return plain(root);
}

const set = (doc: string, node: TreeNode, value: NewValue) => applyChanges(doc, f.setValue(doc, node, value));
const str = (text: string): NewValue => ({ kind: 'string', text });

const DOC = 'name: demo # the name\nlist:\n  - 1\n  - two\n# about nested\nnested:\n  on: true\n  off: ~\n';

describe('yamlFormat.parse', () => {
	it('resolves scalars like the YAML 1.2 core schema', () => {
		const root = parse('a: 1\nb: -2.5e3\nc: .inf\nd: 0x1F\ne: True\nf: ~\ng:\nh: yes\ni: "x\\ty"\nj: \'it\'\'s\'\nk: 2024-01-01\n');
		const kinds = Object.fromEntries(root.children!.map((c) => [c.key, c.kind]));
		expect(kinds).toEqual({
			a: 'number', b: 'number', c: 'number', d: 'number', e: 'boolean', f: 'null', g: 'null',
			h: 'string', i: 'string', j: 'string', k: 'string'
		});
		expect(child(root, 'i').value).toBe('x\ty');
		expect(child(root, 'j').value).toBe("it's");
		expect(child(root, 'g')).toMatchObject({ value: '', valueRange: { from: 46, to: 46 } });
	});
	it('builds block and flow collections with positions', () => {
		const root = parse(DOC);
		expect(root.kind).toBe('object');
		expect(root.children!.map((c) => c.key)).toEqual(['name', 'list', 'nested']);
		const item = child(root, 'list', 1);
		expect(item).toMatchObject({ kind: 'string', value: 'two' });
		expect(DOC.slice(item.range.from, item.range.to)).toBe('- two');
		expect(DOC.slice(child(root, 'nested').range.from, child(root, 'nested').range.to)).toBe('nested:\n  on: true\n  off: ~');
		expect(nodeAt(root, DOC.indexOf('true')).map((n) => n.key)).toEqual(['nested', 'on']);
		expect(data('a: {b: 1, c: [x, "y"]}')).toEqual({ a: { b: 1, c: ['x', 'y'] } });
	});
	it('decodes block scalars and multi-line plain scalars', () => {
		const doc = 'lit: |\n  one\n  two\nfold: >-\n  one\n  two\n\n  three\nkeep: |+\n  x\n\nplain: a\n  b\n';
		expect(data(doc)).toEqual({ lit: 'one\ntwo\n', fold: 'one two\nthree', keep: 'x\n\n', plain: 'a b' });
	});
	it('shows anchors, tags and aliases, and keeps special keys read-only', () => {
		const root = parse('base: &b\n  x: 1\nn: !!str 3\nref: *b\n<<: *b\n? complex\n: v\nmy key: 2\n');
		expect(child(root, 'base')).toMatchObject({ kind: 'object', note: '&b' });
		expect(child(root, 'n')).toMatchObject({ kind: 'string', value: '3', note: '!!str', can: { types: ['string'] } });
		const ref = child(root, 'ref');
		expect(ref).toMatchObject({ kind: 'alias', value: '*b', can: { edit: false, types: [], remove: true, move: true } });
		expect(child(root, '<<').can).toMatchObject({ rename: false, edit: false, duplicate: false });
		expect(child(root, 'complex').can).toMatchObject({ rename: false, edit: false });
		expect(child(root, 'my key').can.rename).toBe(true);
		expect(f.setValue('', ref, str('x'))).toBeNull();
	});
	it('reports syntax errors and unterminated quotes', () => {
		expect(f.parse('a: 1\n').error).toBeNull();
		expect(f.parse('a: "unterminated\n').error).toBe(3);
		expect(f.parse("a: 'x''\n").error).toBe(3);
		expect(f.parse('[1, 2').error).not.toBeNull();
		expect(f.parse('key: value: bad\n  - x').error).not.toBeNull();
	});
	it('treats empty texts, comments and top-level scalars as a document', () => {
		expect(parse('')).toMatchObject({ kind: 'document', children: [], can: { add: ['entry'] } });
		expect(parse('# only a comment\n')).toMatchObject({ kind: 'document', children: [] });
		const root = parse('hello');
		expect(root.kind).toBe('document');
		expect(root.children![0]).toMatchObject({ kind: 'string', value: 'hello', can: { remove: false } });
	});
	it('lists the documents of a stream', () => {
		const doc = '---\na: 1\n---\n- x\n- y\n';
		const root = parse(doc);
		expect(root).toMatchObject({ kind: 'document', can: {} });
		expect(root.children!.map((d) => [d.kind, d.can.add, d.children!.length])).toEqual([
			['document', ['entry'], 1],
			['document', ['item'], 2]
		]);
		expect(data(doc)).toEqual([[1], ['x', 'y']]);
	});
});

describe('yamlFormat edits', () => {
	it('changes a value and keeps comments and layout', () => {
		const out = set(DOC, child(parse(DOC), 'name'), str('other'));
		expect(out).toBe(DOC.replace('demo', 'other'));
	});
	it('quotes strings that would read as something else', () => {
		const name = child(parse(DOC), 'name');
		const write = (text: string) => set(DOC, name, str(text)).split(' # ')[0];
		expect(write('yes')).toBe('name: "yes"');
		expect(write('1.0')).toBe('name: "1.0"');
		expect(write('012')).toBe('name: "012"');
		expect(write('null')).toBe('name: "null"');
		expect(write('')).toBe('name: ""');
		expect(write(': x')).toBe('name: ": x"');
		expect(write('a #b')).toBe('name: "a #b"');
		expect(write(' pad')).toBe('name: " pad"');
		expect(write('two\nlines')).toBe('name: "two\\nlines"');
		expect(write('plain words, fine')).toBe('name: plain words, fine');
		const flow = 'a: [x]';
		expect(set(flow, child(parse(flow), 'a', 0), str('b, c'))).toBe('a: ["b, c"]');
		for (const text of ['yes', '1.0', ': x', '', 'a: b', '- x', '{x}']) {
			expect(data(set(DOC, name, str(text)))).toMatchObject({ name: text });
		}
	});
	it('changes kinds: scalars, empty values and block collections', () => {
		const root = parse(DOC);
		expect(set(DOC, child(root, 'name'), { kind: 'number', text: '42' })).toContain('name: 42 # the name');
		expect(set(DOC, child(root, 'nested'), { kind: 'boolean', text: 'true' })).toBe(
			'name: demo # the name\nlist:\n  - 1\n  - two\n# about nested\nnested: true\n'
		);
		expect(set(DOC, child(root, 'name'), { kind: 'array', text: '' })).toContain('name: [] # the name');
		const empty = 'a:\nb: 1\n';
		expect(set(empty, child(parse(empty), 'a'), str('x'))).toBe('a: x\nb: 1\n');
		const item = '- a: 1\n  b: 2\n- c\n';
		expect(set(item, child(parse(item), 0), { kind: 'null', text: '' })).toBe('- null\n- c\n');
		expect(f.setValue(DOC, child(root, 'nested'), { kind: 'object', text: '' })).toBeNull();
	});
	it('renames keys, quoting where needed', () => {
		const out = applyChanges(DOC, f.rename(DOC, child(parse(DOC), 'nested'), 'my key'));
		expect(out).toBe(DOC.replace('nested:', 'my key:'));
		expect(applyChanges(DOC, f.rename(DOC, child(parse(DOC), 'name'), 'true'))).toContain('"true": demo');
	});
	it('inserts block entries with the indentation of their siblings', () => {
		const root = parse(DOC);
		let out = applyChanges(DOC, f.insert(DOC, root, 1, { kind: 'entry', key: 'x', value: { kind: 'number', text: '5' } }));
		expect(out).toBe(DOC.replace('list:', 'x: 5\nlist:'));
		out = applyChanges(DOC, f.insert(DOC, root, 3, { kind: 'entry', key: 'end', value: { kind: 'null', text: '' } }));
		expect(out).toBe(DOC.replace('off: ~\n', 'off: ~\nend: null\n'));
		out = applyChanges(DOC, f.insert(DOC, child(root, 'list'), 2, { kind: 'item', value: str('z') }));
		expect(out).toContain('  - two\n  - z\n# about');
		out = applyChanges(DOC, f.insert(DOC, child(root, 'nested'), 0, { kind: 'entry', key: 'k', value: { kind: 'object', text: '' } }));
		expect(data(out)).toMatchObject({ nested: { k: {}, on: true, off: null } });
		const seq = '- a: 1\n  b: 2\n';
		out = applyChanges(seq, f.insert(seq, child(parse(seq), 0), 0, { kind: 'entry', key: 'z', value: str('w') }));
		expect(out).toBe('- z: w\n  a: 1\n  b: 2\n');
	});
	it('inserts into flow collections like JSON, an empty one in a block turns into a block', () => {
		const flow = 'a: {b: 1, c: 2}\n';
		const out = applyChanges(flow, f.insert(flow, child(parse(flow), 'a'), 2, { kind: 'entry', key: 'd', value: str('x') }));
		expect(out).toBe('a: {b: 1, c: 2, d: x}\n');
		const empty = 'top:\n  a: {}\n  l: []\n';
		const root = parse(empty);
		expect(applyChanges(empty, f.insert(empty, child(root, 'top', 'a'), 0, { kind: 'entry', key: 'b', value: str('c') }))).toBe(
			'top:\n  a:\n    b: c\n  l: []\n'
		);
		expect(applyChanges(empty, f.insert(empty, child(root, 'top', 'l'), 0, { kind: 'item', value: { kind: 'number', text: '1' } }))).toBe(
			'top:\n  a: {}\n  l:\n    - 1\n'
		);
		const nested = 'a: [{}]';
		expect(applyChanges(nested, f.insert(nested, child(parse(nested), 'a', 0), 0, { kind: 'entry', key: 'k', value: str('v') }))).toBe(
			'a: [{k: v}]'
		);
	});
	it('inserts the first entry of an empty text', () => {
		expect(applyChanges('', f.insert('', parse(''), 0, { kind: 'entry', key: 'a', value: str('b') }))).toBe('a: b\n');
		const comment = '# notes';
		expect(applyChanges(comment, f.insert(comment, parse(comment), 0, { kind: 'entry', key: 'a', value: str('b') }))).toBe('# notes\na: b\n');
		expect(f.insert('x', parse('x'), 1, { kind: 'entry', key: 'a', value: str('b') })).toBeNull();
	});
	it('removes block entries with their lines and keeps the type of a now empty value', () => {
		const root = parse(DOC);
		expect(applyChanges(DOC, f.remove(DOC, root, child(root, 'name')))).toBe(DOC.replace('name: demo # the name\n', ''));
		expect(applyChanges(DOC, f.remove(DOC, root, child(root, 'nested')))).toBe(DOC.replace('nested:\n  on: true\n  off: ~\n', ''));
		const one = 'a:\n  - x\nb: 1\n';
		const list = child(parse(one), 'a');
		expect(applyChanges(one, f.remove(one, list, list.children![0]))).toBe('a: []\nb: 1\n');
		const top = 'only: 1\n';
		const single = parse(top);
		expect(applyChanges(top, f.remove(top, single, child(single, 'only')))).toBe('');
		const seq = '- a: 1\n  b: 2\n';
		const map = child(parse(seq), 0);
		expect(applyChanges(seq, f.remove(seq, map, child(map, 'a')))).toBe('- b: 2\n');
	});
	it('removes flow entries with their separators', () => {
		const flow = 'a: [1, 2]\n';
		const list = child(parse(flow), 'a');
		const once = applyChanges(flow, f.remove(flow, list, list.children![0]));
		expect(once).toBe('a: [2]\n');
		const again = child(parse(once), 'a');
		expect(applyChanges(once, f.remove(once, again, again.children![0]))).toBe('a: []\n');
	});
	it('duplicates with a free key and moves entries', () => {
		const root = parse(DOC);
		const dup = applyChanges(DOC, f.duplicate(DOC, root, child(root, 'nested')));
		expect(dup).toBe(`${DOC}nested 2:\n  on: true\n  off: ~\n`);
		const flow = 'a: {b: 1}';
		const a = child(parse(flow), 'a');
		expect(applyChanges(flow, f.duplicate(flow, a, child(a, 'b')))).toBe('a: {b: 1, b 2: 1}');
		const moved = applyChanges(DOC, f.move(DOC, root, child(root, 'name'), 1));
		expect(Object.keys(data(moved) as object)).toEqual(['list', 'name', 'nested']);
		expect(moved).toContain('nested:\n  on: true');
		expect(f.move(DOC, root, child(root, 'name'), -1)).toBeNull();
		const seq = '- x\n- y: 1\n  z: 2\n';
		const items = parse(seq);
		expect(applyChanges(seq, f.move(seq, items, child(items, 0), 1))).toBe('- y: 1\n  z: 2\n- x\n');
	});
	it('edits inside one document of a stream', () => {
		const doc = '---\na: 1\n---\n- x\n';
		const second = child(parse(doc), 1);
		const out = applyChanges(doc, f.insert(doc, second, 1, { kind: 'item', value: str('z') }));
		expect(out).toBe('---\na: 1\n---\n- x\n- z\n');
		const first = child(parse(doc), 0);
		expect(applyChanges(doc, f.setValue(doc, child(first, 'a'), { kind: 'boolean', text: 'false' }))).toBe('---\na: false\n---\n- x\n');
		expect(f.insert(doc, parse(doc), 0, { kind: 'entry', key: 'k', value: str('v') })).toBeNull();
	});
	it('keeps anchors and tags when a value changes', () => {
		const doc = 'a: &x 1\nb: !!str 2\n';
		const root = parse(doc);
		expect(set(doc, child(root, 'a'), str('two'))).toBe('a: &x two\nb: !!str 2\n');
		expect(set(doc, child(root, 'b'), str('3'))).toBe('a: &x 1\nb: !!str "3"\n');
		expect(f.setValue(doc, child(root, 'b'), { kind: 'number', text: '3' })).toBeNull();
	});
});
