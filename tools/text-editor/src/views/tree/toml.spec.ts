import { describe, expect, it } from 'vitest';
import { applyChanges, type TreeNode } from './model';
import { tomlFormat as f } from './toml';

const parse = (doc: string) => f.parse(doc).root;
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => (typeof k === 'number' ? n.children![k] : n.children!.find((c) => c.key === k)!), root);
/** Applies an edit and checks that the result still parses */
const edit = (doc: string, change: ReturnType<typeof f.insert>) => {
	expect(change).not.toBeNull();
	const out = applyChanges(doc, change);
	expect(f.parse(out).error).toBeNull();
	return out;
};

const DOC = `# Settings
title = "demo" # the title
owner.name = "Tom"
owner.dob = 1979-05-27T07:32:00-08:00

[server]
host = 'localhost'
ports = [ 8000,
  8001, # second
]

[server.limits]
max = 10

[[products]]
name = "Hammer"
sku = 738594937

[[products]]
name = "Nail"
color = "gray"
`;

describe('tomlFormat.parse', () => {
	it('decodes every kind of string', () => {
		const doc = [
			String.raw`a = "tab\there \"q\" \u00e9 \U0001F600"`,
			String.raw`b = 'C:\no\escapes'`,
			'c = """\nline one\nline two"""',
			'd = """\\\n    The quick \\\n    fox."""',
			"e = '''\nraw \\n text'''",
			'f = """quote at end"""""',
			'g = ""'
		].join('\n');
		const root = parse(doc);
		expect(f.parse(doc).error).toBeNull();
		expect(root.children!.map((c) => c.value)).toEqual([
			'tab\there "q" é 😀',
			'C:\\no\\escapes',
			'line one\nline two',
			'The quick fox.',
			'raw \\n text',
			'quote at end""',
			''
		]);
	});
	it.each([
		['a = \nb = 1', 4],
		['a = "open\nb = 1', 9],
		['a = 1\nb = 2\na = 3\n', 12],
		['[t]\nx = 1\n[t]\ny = 2', 11],
		['[fruit]\napple.color = 1\n[fruit.apple]', 31],
		['a = [1, 2]\n[[a]]', 13]
	])('reports syntax errors and keys defined twice: %j', (doc, error) => {
		expect(f.parse(doc).error).toBe(error);
	});
});

describe('tomlFormat values and keys', () => {
	it('changes a value and keeps everything else byte for byte', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.setValue(DOC, child(root, 'title'), { kind: 'string', text: 'a "b"\n\ttab\u0001' }));
		expect(out).toBe(DOC.replace('"demo"', '"a \\"b\\"\\n\\ttab\\u0001"'));
		expect(child(parse(out), 'title').value).toBe('a "b"\n\ttab\u0001');
		const host = child(root, 'server', 'host');
		expect(edit(DOC, f.setValue(DOC, host, { kind: 'number', text: '0x1F' }))).toBe(DOC.replace("'localhost'", '0x1F'));
		expect(edit(DOC, f.setValue(DOC, host, { kind: 'number', text: 'abc' }))).toBe(DOC.replace("'localhost'", '0'));
		expect(f.setValue(DOC, host, { kind: 'null', text: '' })).toBeNull();
		expect(f.setValue(DOC, child(root, 'server'), { kind: 'string', text: 'x' })).toBeNull();
	});
	it('keeps dates as dates while they look like one', () => {
		const dob = child(parse(DOC), 'owner', 'dob');
		expect(edit(DOC, f.setValue(DOC, dob, { kind: 'string', text: '2001-01-01' }))).toContain('owner.dob = 2001-01-01\n');
		expect(edit(DOC, f.setValue(DOC, dob, { kind: 'string', text: 'soon' }))).toContain('owner.dob = "soon"\n');
	});
	it('renames keys, quoting them where needed', () => {
		const root = parse(DOC);
		expect(edit(DOC, f.rename(DOC, child(root, 'title'), 'my title'))).toBe(DOC.replace('title = "demo"', '"my title" = "demo"'));
		expect(edit(DOC, f.rename(DOC, child(root, 'owner', 'name'), 'first'))).toContain('owner.first = "Tom"');
	});
	it('renames a table in every header that names it', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.rename(DOC, child(root, 'server'), 'srv'));
		expect(out).toBe(DOC.replace('[server]', '[srv]').replace('[server.limits]', '[srv.limits]'));
		const products = edit(DOC, f.rename(DOC, child(root, 'products'), 'items'));
		expect(products.match(/\[\[items\]\]/g)).toHaveLength(2);
		const limits = edit(DOC, f.rename(DOC, child(root, 'server', 'limits'), 'caps'));
		expect(limits).toBe(DOC.replace('[server.limits]', '[server.caps]'));
	});
});

describe('tomlFormat.insert', () => {
	it('adds a line after the last pair of a table', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.insert(DOC, child(root, 'server'), 3, { kind: 'entry', key: 'debug', value: { kind: 'boolean', text: 'true' } }));
		expect(out).toBe(DOC.replace('  8001, # second\n]\n', '  8001, # second\n]\ndebug = true\n'));
	});
	it('adds at the root before the first header and its comment', () => {
		const bare = '# head\n\n# about a\n[a]\nx = 1\n';
		expect(edit(bare, f.insert(bare, parse(bare), 0, { kind: 'entry', key: 'k', value: { kind: 'number', text: '1' } }))).toBe(
			'# head\n\nk = 1\n\n# about a\n[a]\nx = 1\n'
		);
	});
	it('gives an implicit table a header of its own', () => {
		const doc = '[x.y]\na = 1\n';
		const out = edit(doc, f.insert(doc, child(parse(doc), 'x'), 1, { kind: 'entry', key: 'b', value: { kind: 'number', text: '2' } }));
		expect(out).toBe('[x]\nb = 2\n\n[x.y]\na = 1\n');
	});
});

describe('tomlFormat.remove', () => {
	it('removes a pair with its whole line, also over several lines', () => {
		const root = parse(DOC);
		const ports = child(root, 'server', 'ports');
		expect(edit(DOC, f.remove(DOC, child(root, 'server'), ports))).toBe(DOC.replace("ports = [ 8000,\n  8001, # second\n]\n", ''));
	});
	it('removes a table with the tables below it', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.remove(DOC, root, child(root, 'server')));
		expect(out).toBe(DOC.replace(/\[server\][^]*?(?=\[\[products)/, ''));
		const limits = edit(DOC, f.remove(DOC, child(root, 'server'), child(root, 'server', 'limits')));
		expect(limits).toBe(DOC.replace('[server.limits]\nmax = 10\n\n', ''));
	});
	it('treats comments right above a header as part of its section', () => {
		const doc = '[a]\nx = 1\n\n# about b\n[b]\ny = 2\n';
		expect(edit(doc, f.remove(doc, parse(doc), child(parse(doc), 'a')))).toBe('# about b\n[b]\ny = 2\n');
		expect(edit(doc, f.remove(doc, parse(doc), child(parse(doc), 'b')))).toBe('[a]\nx = 1\n');
	});
	it('finds nodes of an older parse by id', () => {
		const root = parse(DOC);
		const copy = structuredClone(child(root, 'title'));
		expect(edit(DOC, f.setValue(DOC, copy, { kind: 'string', text: 'x' }))).toContain('title = "x"');
	});
});
