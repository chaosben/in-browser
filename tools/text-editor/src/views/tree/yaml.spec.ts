import { describe, expect, it } from 'vitest';
import { applyChanges, type NewValue, type TreeNode } from './model';
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
	it('keeps aliases and merge keys read-only', () => {
		const root = parse('base: &b\n  x: 1\nref: *b\n<<: *b\n');
		expect(f.setValue('', child(root, 'ref'), str('x'))).toBeNull();
		expect(child(root, '<<').can).toMatchObject({ rename: false, edit: false, duplicate: false });
	});
	it('reports syntax errors and unterminated quotes', () => {
		expect(f.parse('a: 1\n').error).toBeNull();
		expect(f.parse('a: "unterminated\n').error).toBe(3);
		expect(f.parse("a: 'x''\n").error).toBe(3);
		expect(f.parse('[1, 2').error).not.toBeNull();
		expect(f.parse('key: value: bad\n  - x').error).not.toBeNull();
	});
});

describe('yamlFormat edits', () => {
	it('changes a value and keeps comments and layout', () => {
		const out = set(DOC, child(parse(DOC), 'name'), str('other'));
		expect(out).toBe(DOC.replace('demo', 'other'));
	});
	it.each(['yes', '012', 'null', '', ': x', 'a #b', 'two\nlines', '- x'])(
		'quotes %j where it would read as something else',
		(text) => {
			const out = set(DOC, child(parse(DOC), 'name'), str(text));
			expect(data(out)).toMatchObject({ name: text });
		}
	);
	it('quotes only where needed, also in flow collections and keys', () => {
		expect(set(DOC, child(parse(DOC), 'name'), str('plain words, fine'))).toContain('name: plain words, fine #');
		const flow = 'a: [x]';
		expect(set(flow, child(parse(flow), 'a', 0), str('b, c'))).toBe('a: ["b, c"]');
		expect(applyChanges(DOC, f.rename(DOC, child(parse(DOC), 'name'), 'true'))).toContain('"true": demo');
	});
	it('inserts block entries with the indentation of their siblings', () => {
		let out = applyChanges(DOC, f.insert(DOC, child(parse(DOC), 'list'), 2, { kind: 'item', value: str('z') }));
		expect(out).toContain('  - two\n  - z\n# about');
		const seq = '- a: 1\n  b: 2\n';
		out = applyChanges(seq, f.insert(seq, child(parse(seq), 0), 0, { kind: 'entry', key: 'z', value: str('w') }));
		expect(out).toBe('- z: w\n  a: 1\n  b: 2\n');
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
