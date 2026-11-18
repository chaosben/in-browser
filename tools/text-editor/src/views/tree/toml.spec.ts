import { describe, expect, it } from 'vitest';
import { applyChanges, nodeAt, type TreeNode } from './model';
import { tomlFormat as f } from './toml';

const parse = (doc: string) => f.parse(doc).root;
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => (typeof k === 'number' ? n.children![k] : n.children!.find((c) => c.key === k)!), root);
const keys = (n: TreeNode) => n.children!.map((c) => c.key ?? '#');
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
	it('builds tables, dotted keys and arrays of tables', () => {
		const { root, error } = f.parse(DOC);
		expect(error).toBeNull();
		expect(keys(root)).toEqual(['title', 'owner', 'server', 'products']);
		expect(child(root, 'title')).toMatchObject({ kind: 'string', value: 'demo', id: '/title' });
		expect(child(root, 'owner')).toMatchObject({ kind: 'object', can: { add: ['entry'], types: [] } });
		expect(child(root, 'owner', 'dob')).toMatchObject({ kind: 'date', value: '1979-05-27T07:32:00-08:00' });
		const server = child(root, 'server');
		expect(keys(server)).toEqual(['host', 'ports', 'limits']);
		expect(server.can).toMatchObject({ rename: true, remove: true, duplicate: false });
		expect(child(server, 'ports').children!.map((c) => c.value)).toEqual(['8000', '8001']);
		const products = child(root, 'products');
		expect(products.kind).toBe('array');
		expect(products.children!.map((c) => c.id)).toEqual(['/products/#0', '/products/#1']);
		expect(child(products, 1, 'color').value).toBe('gray');
	});
	it('gives ranges for lines and sections', () => {
		const root = parse(DOC);
		const title = child(root, 'title');
		expect(DOC.slice(title.range.from, title.range.to)).toBe('title = "demo"');
		expect(DOC.slice(title.keyRange!.from, title.keyRange!.to)).toBe('title');
		const dob = child(root, 'owner', 'dob');
		expect(DOC.slice(dob.keyRange!.from, dob.keyRange!.to)).toBe('dob');
		expect(DOC.slice(dob.range.from, dob.range.to)).toBe('owner.dob = 1979-05-27T07:32:00-08:00');
		const limits = child(root, 'server', 'limits');
		expect(DOC.slice(limits.range.from, limits.range.to)).toBe('[server.limits]\nmax = 10');
		expect(DOC.slice(limits.keyRange!.from, limits.keyRange!.to)).toBe('limits');
		const pos = DOC.indexOf('max');
		expect(nodeAt(root, pos).map((n) => n.key)).toEqual(['server', 'limits', 'max']);
	});
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
	it('reads numbers, booleans and dates', () => {
		const doc = 'a = +1_000\nb = 0xDEAD_beef\nc = 0o755\nd = 0b1101\ne = -3.14e-2\nf = inf\ng = -nan\nh = true\ni = 1979-05-27 07:32:00Z\nj = 07:32:00\nk = 1979-05-27\nl = 1979-05-27T00:32:00.999999';
		const root = parse(doc);
		expect(f.parse(doc).error).toBeNull();
		expect(root.children!.map((c) => c.kind)).toEqual([
			...Array(7).fill('number'),
			'boolean',
			'date',
			'date',
			'date',
			'date'
		]);
		expect(child(root, 'i').value).toBe('1979-05-27 07:32:00Z');
	});
	it('follows the spec examples for dotted keys and implicit tables', () => {
		const doc = '[fruit]\napple.color = "red"\napple.taste.sweet = true\n\n[fruit.apple.texture]\nsmooth = true\n\n[x.y.z.w]\na = 1\n';
		const root = parse(doc);
		expect(f.parse(doc).error).toBeNull();
		expect(keys(child(root, 'fruit', 'apple'))).toEqual(['color', 'taste', 'texture']);
		expect(child(root, 'fruit', 'apple', 'taste', 'sweet').value).toBe('true');
		const x = child(root, 'x');
		expect(x.can).toEqual({ add: ['entry'], types: [] });
		expect(child(x, 'y', 'z', 'w').can.rename).toBe(true);
	});
	it('follows the spec example for arrays of tables', () => {
		const doc = `[[fruits]]
name = "apple"

[fruits.physical]
color = "red"

[[fruits.varieties]]
name = "red delicious"

[[fruits.varieties]]
name = "granny smith"

[[fruits]]
name = "banana"

[[fruits.varieties]]
name = "plantain"
`;
		const root = parse(doc);
		expect(f.parse(doc).error).toBeNull();
		const fruits = child(root, 'fruits');
		expect(keys(child(fruits, 0))).toEqual(['name', 'physical', 'varieties']);
		expect(child(fruits, 0, 'varieties').children!.map((v) => child(v, 'name').value)).toEqual(['red delicious', 'granny smith']);
		expect(child(fruits, 1, 'varieties', 0, 'name').value).toBe('plantain');
	});
	it('reads inline tables and arrays over several lines with comments', () => {
		const doc = 'p = { x = 1, y.z = "a" }\nq = [\n  1, # one\n  [2, 3],\n  { k = "v" },\n]\n';
		const root = parse(doc);
		expect(f.parse(doc).error).toBeNull();
		expect(keys(child(root, 'p'))).toEqual(['x', 'y']);
		expect(child(root, 'p', 'y', 'z').value).toBe('a');
		expect(child(root, 'q').children!.map((c) => c.kind)).toEqual(['number', 'array', 'object']);
		expect(child(root, 'q', 2, 'k').value).toBe('v');
	});
	it('reports syntax errors and keys defined twice, keeping what it could read', () => {
		expect(f.parse('a = \nb = 1').error).toBe(4);
		expect(f.parse('a = "open\nb = 1').error).toBe(9);
		const twice = 'a = 1\nb = 2\na = 3\n';
		const { root, error } = f.parse(twice);
		expect(error).toBe(12);
		expect(keys(root)).toEqual(['a', 'b']);
		expect(f.parse('[t]\nx = 1\n[t]\ny = 2').error).toBe(11);
		expect(f.parse('[fruit]\napple.color = 1\n[fruit.apple]').error).toBe(31);
		expect(f.parse('a = [1, 2]\n[[a]]').error).toBe(13);
		expect(f.parse('a = 1 b = 2').error).toBe(6);
		expect(f.parse('').root.children).toEqual([]);
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
	it('changes the kind of a value to a table or array', () => {
		const root = parse(DOC);
		expect(edit(DOC, f.setValue(DOC, child(root, 'title'), { kind: 'object', text: '' }))).toContain('title = {} # the title');
		expect(edit(DOC, f.setValue(DOC, child(root, 'server', 'ports'), { kind: 'string', text: '' }))).toContain('ports = ""\n\n');
		expect(f.setValue(DOC, child(root, 'server', 'ports'), { kind: 'array', text: '' })).toBeNull();
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
		expect(f.rename(DOC, child(root, 'owner'), 'x')).toBeNull();
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
	it('honours the index among the pairs', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.insert(DOC, child(root, 'server'), 1, { kind: 'entry', key: 'port', value: { kind: 'number', text: '80' } }));
		expect(out).toBe(DOC.replace("host = 'localhost'\n", "host = 'localhost'\nport = 80\n"));
		expect(keys(child(parse(out), 'server'))).toEqual(['host', 'port', 'ports', 'limits']);
	});
	it('adds at the root before the first header', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.insert(DOC, root, 9, { kind: 'entry', key: 'v', value: { kind: 'string', text: 'x' } }));
		expect(out).toBe(DOC.replace('-08:00\n', '-08:00\nv = "x"\n'));
		const bare = '# head\n\n# about a\n[a]\nx = 1\n';
		expect(edit(bare, f.insert(bare, parse(bare), 0, { kind: 'entry', key: 'k', value: { kind: 'number', text: '1' } }))).toBe(
			'# head\n\nk = 1\n\n# about a\n[a]\nx = 1\n'
		);
		expect(edit('', f.insert('', parse(''), 0, { kind: 'entry', key: 'k', value: { kind: 'array', text: '' } }))).toBe('k = []\n');
		expect(edit('# c', f.insert('# c', parse('# c'), 0, { kind: 'entry', key: 'k', value: { kind: 'object', text: '' } }))).toBe('# c\nk = {}\n');
	});
	it('adds right after the header of an empty table, and under dotted keys', () => {
		const doc = '[a]\n\n[b]\n';
		expect(edit(doc, f.insert(doc, child(parse(doc), 'a'), 0, { kind: 'entry', key: 'x', value: { kind: 'number', text: '1' } }))).toBe(
			'[a]\nx = 1\n\n[b]\n'
		);
		const root = parse(DOC);
		const out = edit(DOC, f.insert(DOC, child(root, 'owner'), 2, { kind: 'entry', key: 'age', value: { kind: 'number', text: '40' } }));
		expect(out).toContain('owner.dob = 1979-05-27T07:32:00-08:00\nowner.age = 40\n');
	});
	it('gives an implicit table a header of its own', () => {
		const doc = '[x.y]\na = 1\n';
		const out = edit(doc, f.insert(doc, child(parse(doc), 'x'), 1, { kind: 'entry', key: 'b', value: { kind: 'number', text: '2' } }));
		expect(out).toBe('[x]\nb = 2\n\n[x.y]\na = 1\n');
	});
	it('adds to inline tables and arrays like JSON', () => {
		const doc = 'p = { x = 1 }\ne = {}\nl = [1, 2]\nm = []\n';
		const root = parse(doc);
		expect(edit(doc, f.insert(doc, child(root, 'p'), 1, { kind: 'entry', key: 'y', value: { kind: 'number', text: '2' } }))).toContain('p = { x = 1, y = 2 }');
		expect(edit(doc, f.insert(doc, child(root, 'e'), 0, { kind: 'entry', key: 'y', value: { kind: 'string', text: 's' } }))).toContain('e = { y = "s" }');
		expect(edit(doc, f.insert(doc, child(root, 'l'), 0, { kind: 'item', value: { kind: 'number', text: '0' } }))).toContain('l = [0, 1, 2]');
		expect(edit(doc, f.insert(doc, child(root, 'm'), 0, { kind: 'item', value: { kind: 'boolean', text: 'true' } }))).toContain('m = [true]');
		expect(f.insert(doc, child(root, 'm'), 0, { kind: 'item', value: { kind: 'null', text: '' } })).toBeNull();
	});
	it('adds an item to an array of tables', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.insert(DOC, child(root, 'products'), 2, { kind: 'item', value: { kind: 'object', text: '' } }));
		expect(out).toBe(`${DOC.slice(0, -1)}\n\n[[products]]\n`);
		expect(child(parse(out), 'products').children).toHaveLength(3);
	});
});

describe('tomlFormat remove, duplicate, move', () => {
	it('removes a pair with its whole line', () => {
		const root = parse(DOC);
		expect(edit(DOC, f.remove(DOC, root, child(root, 'title')))).toBe(DOC.replace('title = "demo" # the title\n', ''));
		const ports = child(root, 'server', 'ports');
		expect(edit(DOC, f.remove(DOC, child(root, 'server'), ports))).toBe(DOC.replace("ports = [ 8000,\n  8001, # second\n]\n", ''));
		expect(edit('a = 1', f.remove('a = 1', parse('a = 1'), child(parse('a = 1'), 'a')))).toBe('');
		expect(edit('a = 1\nb = 2', f.remove('a = 1\nb = 2', parse('a = 1\nb = 2'), child(parse('a = 1\nb = 2'), 'b')))).toBe('a = 1');
	});
	it('removes a table with the tables below it', () => {
		const root = parse(DOC);
		const out = edit(DOC, f.remove(DOC, root, child(root, 'server')));
		expect(out).toBe(DOC.replace(/\[server\][^]*?(?=\[\[products)/, ''));
		const limits = edit(DOC, f.remove(DOC, child(root, 'server'), child(root, 'server', 'limits')));
		expect(limits).toBe(DOC.replace('[server.limits]\nmax = 10\n\n', ''));
	});
	it('removes the last section with the blank lines before it', () => {
		const root = parse(DOC);
		const products = child(root, 'products');
		const out = edit(DOC, f.remove(DOC, products, products.children![1]));
		expect(out).toBe(DOC.replace('\n[[products]]\nname = "Nail"\ncolor = "gray"\n', ''));
		expect(edit(DOC, f.remove(DOC, root, products))).toBe(DOC.slice(0, DOC.indexOf('\n[[products]]')));
	});
	it('treats comments right above a header as part of its section', () => {
		const doc = '[a]\nx = 1\n\n# about b\n[b]\ny = 2\n';
		expect(edit(doc, f.remove(doc, parse(doc), child(parse(doc), 'a')))).toBe('# about b\n[b]\ny = 2\n');
		expect(edit(doc, f.remove(doc, parse(doc), child(parse(doc), 'b')))).toBe('[a]\nx = 1\n');
	});
	it('removes entries of inline tables and arrays with their separators', () => {
		const doc = 'p = { x = 1, y.z = 2 }\nl = [1, 2, 3]\n';
		const root = parse(doc);
		expect(edit(doc, f.remove(doc, child(root, 'p'), child(root, 'p', 'x')))).toContain('p = { y.z = 2 }');
		expect(edit(doc, f.remove(doc, child(root, 'p', 'y'), child(root, 'p', 'y', 'z')))).toContain('p = { x = 1 }');
		expect(edit(doc, f.remove(doc, child(root, 'l'), child(root, 'l', 1)))).toContain('l = [1, 3]');
	});
	it('duplicates pairs, entries, items and array-of-table items', () => {
		const root = parse(DOC);
		expect(edit(DOC, f.duplicate(DOC, root, child(root, 'title')))).toBe(
			DOC.replace('# the title\n', '# the title\n"title 2" = "demo" # the title\n')
		);
		expect(edit(DOC, f.duplicate(DOC, child(root, 'owner'), child(root, 'owner', 'name')))).toContain('owner.name = "Tom"\nowner."name 2" = "Tom"\n');
		const doc = 'p = { x = 1 }\nl = [1, 2]\n';
		const r = parse(doc);
		expect(edit(doc, f.duplicate(doc, child(r, 'p'), child(r, 'p', 'x')))).toContain('p = { x = 1, "x 2" = 1 }');
		expect(edit(doc, f.duplicate(doc, child(r, 'l'), child(r, 'l', 0)))).toContain('l = [1, 1, 2]');
		const products = child(root, 'products');
		const out = edit(DOC, f.duplicate(DOC, products, products.children![0]));
		expect(child(parse(out), 'products').children!.map((p) => child(p, 'name').value)).toEqual(['Hammer', 'Hammer', 'Nail']);
		expect(f.duplicate(DOC, root, child(root, 'server'))).toBeNull();
	});
	it('moves pairs within their table only', () => {
		const root = parse(DOC);
		const server = child(root, 'server');
		const out = edit(DOC, f.move(DOC, server, child(server, 'host'), 1));
		expect(out).toBe(DOC.replace("host = 'localhost'\nports = [ 8000,\n  8001, # second\n]", "ports = [ 8000,\n  8001, # second\n]\nhost = 'localhost'"));
		expect(f.move(DOC, server, child(server, 'ports'), 1)).toBeNull();
		expect(f.move(DOC, root, child(root, 'title'), -1)).toBeNull();
		expect(f.move(DOC, root, child(root, 'title'), 1)).toBeNull();
		const owner = child(root, 'owner');
		expect(edit(DOC, f.move(DOC, owner, child(owner, 'name'), 1))).toContain('owner.dob = 1979-05-27T07:32:00-08:00\nowner.name = "Tom"\n');
		const doc = 'l = [1, 2]\np = { a = 1, b = 2 }';
		const r = parse(doc);
		expect(edit(doc, f.move(doc, child(r, 'l'), child(r, 'l', 0), 1))).toContain('l = [2, 1]');
		expect(edit(doc, f.move(doc, child(r, 'p'), child(r, 'p', 'b'), -1))).toContain('p = { b = 2, a = 1 }');
	});
	it('finds nodes of an older parse by id', () => {
		const root = parse(DOC);
		const copy = structuredClone(child(root, 'title'));
		expect(edit(DOC, f.setValue(DOC, copy, { kind: 'string', text: 'x' }))).toContain('title = "x"');
	});
});
