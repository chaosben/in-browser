import { describe, expect, it } from 'vitest';
import { applyChanges, nodeAt, type TreeNode } from './model';
import { decodeXml, xmlFormat as f } from './xml';

const parse = (doc: string) => f.parse(doc).root;
/** Child by key (elements by tag name, attributes as `@name`) or by index */
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => {
		if (typeof k === 'number') return n.children![k];
		if (k.startsWith('@')) return n.children!.find((c) => c.kind === 'attribute' && c.key === k.slice(1))!;
		return n.children!.find((c) => c.kind === 'element' && c.key === k)!;
	}, root);
const kinds = (node: TreeNode) => node.children!.map((c) => c.kind);

const PRETTY = '<?xml version="1.0"?>\n<root a="1" b=\'two\'>\n  <!-- note -->\n  <item>t &amp; u</item>\n  <empty/>\n</root>\n';

describe('xmlFormat.parse', () => {
	it('builds the document with top-level nodes', () => {
		const root = parse(PRETTY);
		expect(root).toMatchObject({ kind: 'document', id: '', can: { add: [] } });
		expect(kinds(root)).toEqual(['instruction', 'element']);
		expect(root.children![0]).toMatchObject({ key: 'xml', value: 'version="1.0"', can: { remove: true } });
		expect(root.children![0].can.move).toBeFalsy();
		expect(f.parse(PRETTY).error).toBeNull();
	});
	it('lists attributes first, then content, with decoded values', () => {
		const el = child(parse(PRETTY), 'root');
		expect(el).toMatchObject({ kind: 'element', key: 'root', keyRange: { from: 23, to: 27 } });
		expect(el.can).toMatchObject({ rename: true, remove: true, move: true, add: ['element', 'attribute', 'text'], types: [] });
		expect(el.can.duplicate).toBeFalsy();
		expect(kinds(el)).toEqual(['attribute', 'attribute', 'comment', 'element', 'element']);
		expect(child(el, '@a')).toMatchObject({ value: '1', can: { rename: true, edit: true, remove: true, duplicate: true, move: true } });
		expect(child(el, '@b').value).toBe('two');
		expect(PRETTY.slice(child(el, '@b').valueRange!.from, child(el, '@b').valueRange!.to)).toBe('two');
		expect(child(el, 2)).toMatchObject({ kind: 'comment', value: ' note ', can: { remove: true, move: true } });
		expect(child(el, 2).can.edit).toBeFalsy();
	});
	it('joins text pieces and entities into one text node, shown inline on its element', () => {
		const item = child(parse(PRETTY), 'root', 'item');
		expect(item.children).toHaveLength(1);
		const text = item.children![0];
		expect(text).toMatchObject({ kind: 'text', value: 't & u', can: { edit: true, remove: true, move: true } });
		expect(PRETTY.slice(text.range.from, text.range.to)).toBe('t &amp; u');
		expect(item).toMatchObject({ value: 't & u', valueRange: text.range, can: { edit: true } });
		expect(child(parse('<a>x&#65;&#x42;y &lt;</a>'), 'a').value).toBe('xABy <');
	});
	it('skips whitespace-only text and keeps layout whitespace out of text ranges', () => {
		const doc = '<a>\n  hello world\n  <b/>\n</a>';
		const a = child(parse(doc), 'a');
		expect(kinds(a)).toEqual(['text', 'element']);
		expect(doc.slice(a.children![0].range.from, a.children![0].range.to)).toBe('hello world');
		expect(a.value).toBeUndefined();
		expect(a.can.edit).toBeFalsy();
		expect(child(parse('<a>\n</a>'), 'a')).toMatchObject({ value: '', children: [], can: { edit: true } });
	});
	it('reads CDATA, processing instructions and the doctype as read-only nodes', () => {
		const doc = '<!DOCTYPE note>\n<a><![CDATA[x < y]]><?php echo 1 ?></a>';
		const root = parse(doc);
		expect(root.children![0]).toMatchObject({ kind: 'instruction', key: '!DOCTYPE', value: 'note' });
		const a = child(root, 'a');
		expect(a.children![0]).toMatchObject({ kind: 'cdata', value: 'x < y', can: { remove: true, move: true } });
		expect(a.children![1]).toMatchObject({ kind: 'instruction', key: 'php', value: 'echo 1' });
		expect(a.children![1].can.edit).toBeFalsy();
		expect(a.value).toBeUndefined();
	});
	it('shows the namespace an element declares', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">\n  <circle cx="5" cy="5" r="4"/>\n  <x:use xmlns:x="urn:x" href="#c"/>\n</svg>\n';
		const root = parse(svg);
		const el = child(root, 'svg');
		expect(el.note).toBe('http://www.w3.org/2000/svg');
		expect(child(el, '@viewBox').value).toBe('0 0 10 10');
		expect(child(el, 'circle').note).toBeUndefined();
		expect(child(el, 'x:use').note).toBe('urn:x');
		expect(f.parse(svg).error).toBeNull();
	});
	it('gives stable unique ids and finds nodes by position', () => {
		const doc = '<a x="1"><b/><b/>text</a>';
		const a = child(parse(doc), 'a');
		expect(a.id).toBe('/a');
		expect(a.children!.map((c) => c.id)).toEqual(['/a/@x', '/a/b', '/a/b#1', '/a/#3']);
		expect(nodeAt(parse(doc), 14).map((n) => n.key)).toEqual(['a', 'b']);
	});
	it('reports unclosed, mismatched and broken markup', () => {
		expect(f.parse('<a><b></a>').error).toBe(6);
		expect(f.parse('<a></b>').error).toBe(3);
		expect(f.parse('<a x=1></a>').error).toBe(5);
		expect(f.parse('').error).toBeNull();
	});
	it('treats an empty text as a document that takes one root element', () => {
		expect(parse('')).toMatchObject({ kind: 'document', children: [], can: { add: ['element'] } });
		expect(applyChanges('', f.insert('', parse(''), 0, { kind: 'element', key: 'root' }))).toBe('<root/>');
		const doc = '<?xml version="1.0"?>';
		expect(applyChanges(doc, f.insert(doc, parse(doc), 1, { kind: 'element', key: 'r' }))).toBe('<?xml version="1.0"?>\n<r/>');
		expect(f.insert(PRETTY, parse(PRETTY), 2, { kind: 'element', key: 'second' })).toBeNull();
	});
});

describe('xmlFormat values', () => {
	it('edits attributes in either quote style with escaping', () => {
		const el = child(parse(PRETTY), 'root');
		let out = applyChanges(PRETTY, f.setValue(PRETTY, child(el, '@a'), { kind: 'string', text: 'say "hi" & <go>' }));
		expect(out).toBe(PRETTY.replace('a="1"', 'a="say &quot;hi&quot; &amp; &lt;go>"'));
		expect(child(parse(out), 'root', '@a').value).toBe('say "hi" & <go>');
		out = applyChanges(PRETTY, f.setValue(PRETTY, child(el, '@b'), { kind: 'string', text: "it's \"ok\"" }));
		expect(out).toBe(PRETTY.replace("b='two'", "b='it&apos;s \"ok\"'"));
		expect(child(parse(out), 'root', '@b').value).toBe("it's \"ok\"");
	});
	it('edits text and an element with only text', () => {
		const item = child(parse(PRETTY), 'root', 'item');
		const out = applyChanges(PRETTY, f.setValue(PRETTY, item, { kind: 'number', text: 'a < b > c & d' }));
		expect(out).toBe(PRETTY.replace('t &amp; u', 'a &lt; b &gt; c &amp; d'));
		const text = applyChanges(PRETTY, f.setValue(PRETTY, item.children![0], { kind: 'string', text: 'x' }));
		expect(text).toBe(PRETTY.replace('t &amp; u', 'x'));
		const doc = '<p>  spaced  </p>';
		expect(applyChanges(doc, f.setValue(doc, child(parse(doc), 'p'), { kind: 'string', text: 'new' }))).toBe('<p>  new  </p>');
	});
	it('fills an empty element, expanding a self-closing tag', () => {
		const empty = child(parse(PRETTY), 'root', 'empty');
		expect(applyChanges(PRETTY, f.setValue(PRETTY, empty, { kind: 'string', text: 'hi' }))).toBe(PRETTY.replace('<empty/>', '<empty>hi</empty>'));
		const doc = '<a><c x="1" /><d>\n</d></a>';
		const a = child(parse(doc), 'a');
		expect(applyChanges(doc, f.setValue(doc, child(a, 'c'), { kind: 'string', text: '1' }))).toBe('<a><c x="1">1</c><d>\n</d></a>');
		expect(applyChanges(doc, f.setValue(doc, child(a, 'd'), { kind: 'string', text: '2' }))).toBe('<a><c x="1" /><d>2</d></a>');
	});
	it('does not edit elements with mixed content or read-only nodes', () => {
		const doc = '<a>x<b/></a>';
		expect(f.setValue(doc, child(parse(doc), 'a'), { kind: 'string', text: 'y' })).toBeNull();
		const root = child(parse(PRETTY), 'root');
		expect(f.setValue(PRETTY, root.children![2], { kind: 'string', text: 'y' })).toBeNull();
		expect(f.rename(PRETTY, root.children![2], 'y')).toBeNull();
	});
});

describe('xmlFormat edits', () => {
	it('renames open and close tag together', () => {
		const item = child(parse(PRETTY), 'root', 'item');
		const spec = f.rename(PRETTY, item, 'entry');
		expect(spec).toHaveLength(2);
		expect(applyChanges(PRETTY, spec)).toBe(PRETTY.replace('<item>t &amp; u</item>', '<entry>t &amp; u</entry>'));
		const empty = child(parse(PRETTY), 'root', 'empty');
		expect(applyChanges(PRETTY, f.rename(PRETTY, empty, 'svg:g'))).toBe(PRETTY.replace('<empty/>', '<svg:g/>'));
		expect(f.rename(PRETTY, item, 'not valid')).toBeNull();
	});
	it('renames attributes', () => {
		const a = child(parse(PRETTY), 'root', '@a');
		expect(applyChanges(PRETTY, f.rename(PRETTY, a, 'data-a'))).toBe(PRETTY.replace('a="1"', 'data-a="1"'));
	});
	it('inserts attributes after the last one or at their index', () => {
		const root = child(parse(PRETTY), 'root');
		expect(applyChanges(PRETTY, f.insert(PRETTY, root, 2, { kind: 'attribute', key: 'c', value: '"&' }))).toBe(
			PRETTY.replace("b='two'>", "b='two' c=\"&quot;&amp;\">")
		);
		expect(applyChanges(PRETTY, f.insert(PRETTY, root, 0, { kind: 'attribute', key: 'z', value: '0' }))).toBe(PRETTY.replace('<root a=', '<root z="0" a='));
		expect(f.insert(PRETTY, root, 2, { kind: 'attribute', key: 'a', value: 'dup' })).toBeNull();
		const doc = '<a><b/><c></c></a>';
		const a = child(parse(doc), 'a');
		expect(applyChanges(doc, f.insert(doc, child(a, 'b'), 0, { kind: 'attribute', key: 'x', value: '1' }))).toBe('<a><b x="1"/><c></c></a>');
		expect(applyChanges(doc, f.insert(doc, child(a, 'c'), 0, { kind: 'attribute', key: 'y', value: '2' }))).toBe('<a><b/><c y="2"></c></a>');
	});
	it('inserts content one per line like the siblings', () => {
		const root = child(parse(PRETTY), 'root');
		// Index 3 = after the two attributes and the comment
		let out = applyChanges(PRETTY, f.insert(PRETTY, root, 3, { kind: 'element', key: 'new' }));
		expect(out).toBe(PRETTY.replace('  <item>', '  <new/>\n  <item>'));
		out = applyChanges(PRETTY, f.insert(PRETTY, root, 5, { kind: 'text', value: 'a<b' }));
		expect(out).toBe(PRETTY.replace('  <empty/>\n', '  <empty/>\n  a&lt;b\n'));
		out = applyChanges(PRETTY, f.insert(PRETTY, root, 99, { kind: 'element', key: 'last' }));
		expect(out).toBe(PRETTY.replace('  <empty/>\n', '  <empty/>\n  <last/>\n'));
	});
	it('inserts content inline where the siblings are inline', () => {
		const doc = '<p>Hello <b>you</b></p>';
		const p = child(parse(doc), 'p');
		expect(applyChanges(doc, f.insert(doc, p, 2, { kind: 'text', value: '!' }))).toBe('<p>Hello <b>you</b>!</p>');
		expect(applyChanges(doc, f.insert(doc, p, 0, { kind: 'element', key: 'i' }))).toBe('<p><i/>Hello <b>you</b></p>');
	});
	it('fills an empty element on its own lines when the text is indented', () => {
		const empty = child(parse(PRETTY), 'root', 'empty');
		expect(applyChanges(PRETTY, f.insert(PRETTY, empty, 0, { kind: 'element', key: 'x' }))).toBe(
			PRETTY.replace('  <empty/>', '  <empty>\n    <x/>\n  </empty>')
		);
		expect(applyChanges(PRETTY, f.insert(PRETTY, empty, 0, { kind: 'text', value: 'hi' }))).toBe(PRETTY.replace('<empty/>', '<empty>hi</empty>'));
		const tabs = '<a>\n\t<b></b>\n</a>';
		expect(applyChanges(tabs, f.insert(tabs, child(parse(tabs), 'a', 'b'), 0, { kind: 'element', key: 'c' }))).toBe('<a>\n\t<b>\n\t\t<c/>\n\t</b>\n</a>');
		const flat = '<a><b/></a>';
		expect(applyChanges(flat, f.insert(flat, child(parse(flat), 'a', 'b'), 0, { kind: 'element', key: 'c' }))).toBe('<a><b><c/></b></a>');
	});
	it('removes nodes with their own line, or just their range', () => {
		const root = child(parse(PRETTY), 'root');
		expect(applyChanges(PRETTY, f.remove(PRETTY, root, child(root, 'item')))).toBe(PRETTY.replace('  <item>t &amp; u</item>\n', ''));
		expect(applyChanges(PRETTY, f.remove(PRETTY, root, root.children![2]))).toBe(PRETTY.replace('  <!-- note -->\n', ''));
		const doc = '<p>Hello <b>you</b></p>';
		const p = child(parse(doc), 'p');
		expect(applyChanges(doc, f.remove(doc, p, child(p, 'b')))).toBe('<p>Hello </p>');
		// The whitespace around a text belongs to the layout and stays
		expect(applyChanges(doc, f.remove(doc, p, p.children![0]))).toBe('<p> <b>you</b></p>');
		const top = parse(PRETTY);
		expect(applyChanges(PRETTY, f.remove(PRETTY, top, top.children![0]))).toBe(PRETTY.replace('<?xml version="1.0"?>\n', ''));
	});
	it('removes attributes with the whitespace in front', () => {
		const root = child(parse(PRETTY), 'root');
		expect(applyChanges(PRETTY, f.remove(PRETTY, root, child(root, '@a')))).toBe(PRETTY.replace(' a="1"', ''));
		expect(applyChanges(PRETTY, f.remove(PRETTY, root, child(root, '@b')))).toBe(PRETTY.replace(" b='two'", ''));
		const multi = '<a x="1"\n   y="2"/>';
		expect(applyChanges(multi, f.remove(multi, child(parse(multi), 'a'), child(parse(multi), 'a', '@y')))).toBe('<a x="1"/>');
	});
	it('duplicates elements and attributes in their layout', () => {
		const root = child(parse(PRETTY), 'root');
		expect(applyChanges(PRETTY, f.duplicate(PRETTY, root, child(root, 'item')))).toBe(
			PRETTY.replace('  <item>t &amp; u</item>\n', '  <item>t &amp; u</item>\n  <item>t &amp; u</item>\n')
		);
		expect(applyChanges(PRETTY, f.duplicate(PRETTY, root, child(root, '@b')))).toBe(PRETTY.replace("b='two'", "b='two' b-2='two'"));
		const doc = '<p><b>x</b>y</p>';
		const p = child(parse(doc), 'p');
		expect(applyChanges(doc, f.duplicate(doc, p, child(p, 'b')))).toBe('<p><b>x</b><b>x</b>y</p>');
		expect(f.duplicate(PRETTY, parse(PRETTY), root)).toBeNull();
		expect(f.duplicate(doc, p, p.children![1])).toBeNull();
	});
	it('moves content among content and attributes among attributes', () => {
		const root = child(parse(PRETTY), 'root');
		expect(applyChanges(PRETTY, f.move(PRETTY, root, child(root, 'item'), 1))).toBe(
			PRETTY.replace('<item>t &amp; u</item>\n  <empty/>', '<empty/>\n  <item>t &amp; u</item>')
		);
		expect(applyChanges(PRETTY, f.move(PRETTY, root, child(root, '@a'), 1))).toBe(PRETTY.replace("a=\"1\" b='two'", "b='two' a=\"1\""));
		expect(f.move(PRETTY, root, child(root, '@b'), 1)).toBeNull();
		expect(f.move(PRETTY, root, root.children![2], -1)).toBeNull();
		expect(applyChanges(PRETTY, f.move(PRETTY, root, root.children![2], 1))).toContain('<item>t &amp; u</item>\n  <!-- note -->');
	});
});

describe('decodeXml', () => {
	it('keeps unknown entities as written', () => {
		expect(decodeXml('a&nbsp;b&quot;&apos;&#x1F600;')).toBe('a&nbsp;b"\'😀');
	});
});
