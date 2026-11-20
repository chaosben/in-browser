import { describe, expect, it } from 'vitest';
import { applyChanges, type TreeNode } from './model';
import { decodeXml, xmlFormat as f } from './xml';

const parse = (doc: string) => f.parse(doc).root;
/** Child by key (elements by tag name, attributes as `@name`) or by index */
const child = (root: TreeNode, ...keys: (string | number)[]) =>
	keys.reduce<TreeNode>((n, k) => {
		if (typeof k === 'number') return n.children![k];
		if (k.startsWith('@')) return n.children!.find((c) => c.kind === 'attribute' && c.key === k.slice(1))!;
		return n.children!.find((c) => c.kind === 'element' && c.key === k)!;
	}, root);

const PRETTY = '<?xml version="1.0"?>\n<root a="1" b=\'two\'>\n  <!-- note -->\n  <item>t &amp; u</item>\n  <empty/>\n</root>\n';

describe('xmlFormat.parse', () => {
	it('reports unclosed, mismatched and broken markup', () => {
		expect(f.parse('<a><b></a>').error).toBe(6);
		expect(f.parse('<a></b>').error).toBe(3);
		expect(f.parse('<a x=1></a>').error).toBe(5);
		expect(f.parse('').error).toBeNull();
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
	it('edits an element with only text, keeping the spacing around it', () => {
		const item = child(parse(PRETTY), 'root', 'item');
		expect(item.value).toBe('t & u');
		const out = applyChanges(PRETTY, f.setValue(PRETTY, item, { kind: 'number', text: 'a < b > c & d' }));
		expect(out).toBe(PRETTY.replace('t &amp; u', 'a &lt; b &gt; c &amp; d'));
		const doc = '<p>  spaced  </p>';
		expect(applyChanges(doc, f.setValue(doc, child(parse(doc), 'p'), { kind: 'string', text: 'new' }))).toBe('<p>  new  </p>');
	});
	it('fills an empty element, expanding a self-closing tag', () => {
		const empty = child(parse(PRETTY), 'root', 'empty');
		expect(applyChanges(PRETTY, f.setValue(PRETTY, empty, { kind: 'string', text: 'hi' }))).toBe(PRETTY.replace('<empty/>', '<empty>hi</empty>'));
	});
	it('refuses edits that would lose content or break the markup', () => {
		const doc = '<a>x<b/></a>';
		expect(f.setValue(doc, child(parse(doc), 'a'), { kind: 'string', text: 'y' })).toBeNull();
		const root = child(parse(PRETTY), 'root');
		expect(f.setValue(PRETTY, root.children![2], { kind: 'string', text: 'y' })).toBeNull();
		expect(f.rename(PRETTY, child(root, 'item'), 'not valid')).toBeNull();
		expect(f.insert(PRETTY, root, 2, { kind: 'attribute', key: 'a', value: 'dup' })).toBeNull();
	});
});

describe('xmlFormat edits', () => {
	it('renames open and close tag together', () => {
		const item = child(parse(PRETTY), 'root', 'item');
		expect(applyChanges(PRETTY, f.rename(PRETTY, item, 'entry'))).toBe(PRETTY.replace('<item>t &amp; u</item>', '<entry>t &amp; u</entry>'));
	});
	it('removes nodes with their own line, or just their range', () => {
		const root = child(parse(PRETTY), 'root');
		expect(applyChanges(PRETTY, f.remove(PRETTY, root, child(root, 'item')))).toBe(PRETTY.replace('  <item>t &amp; u</item>\n', ''));
		const doc = '<p>Hello <b>you</b></p>';
		const p = child(parse(doc), 'p');
		expect(applyChanges(doc, f.remove(doc, p, child(p, 'b')))).toBe('<p>Hello </p>');
		// The whitespace around a text belongs to the layout and stays
		expect(applyChanges(doc, f.remove(doc, p, p.children![0]))).toBe('<p> <b>you</b></p>');
	});
});

describe('decodeXml', () => {
	it('keeps unknown entities as written', () => {
		expect(decodeXml('a&nbsp;b&quot;&apos;&#x1F600;')).toBe('a&nbsp;b"\'😀');
	});
});
