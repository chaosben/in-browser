import type { ChangeSpec } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { parser } from '@lezer/xml';
import {
	assignIds,
	firstError,
	indentAt,
	lineEndOf,
	lineStartOf,
	neighbour,
	ownsLine,
	swap,
	type NewChild,
	type Range,
	type TreeFormat,
	type TreeNode,
	type TreeParse
} from './model.js';
import { freeName } from '../names.js';
import { indentUnit } from './edit.js';

// XML (and SVG) as a tree, parsed with Lezer. An element's children are its attributes, then its content (elements,
// text, comments, CDATA, processing instructions). Edits touch only the affected tag, attribute or content; new
// children follow the layout of their siblings.

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Resolves the predefined entities and character references; unknown entities stay as written */
export function decodeXml(raw: string): string {
	return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][\w.-]*);/g, (match, ref: string) => {
		if (ref[0] !== '#') return NAMED[ref] ?? match;
		const code = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
		return code <= 0x10ffff ? String.fromCodePoint(code) : match;
	});
}

export const escapeText = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function escapeAttribute(text: string, quote: '"' | "'"): string {
	const out = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\n', '&#10;').replaceAll('\t', '&#9;');
	return quote === '"' ? out.replaceAll('"', '&quot;') : out.replaceAll("'", '&apos;');
}

const NAME = /^[\p{L}_:][\p{L}\p{N}_:.\-·]*$/u;
const isName = (name: string) => NAME.test(name);

const TEXT = new Set(['Text', 'EntityReference', 'CharacterReference']);
const READ_ONLY: Record<string, 'comment' | 'cdata' | 'instruction'> = {
	Comment: 'comment',
	Cdata: 'cdata',
	ProcessingInst: 'instruction',
	DoctypeDecl: 'instruction'
};

/** Open tag or self-closing tag of an element */
const tagOf = (element: SyntaxNode) => element.getChild('OpenTag') ?? element.getChild('SelfClosingTag');

const attributesOf = (tag: SyntaxNode | null) => (tag ? tag.getChildren('Attribute') : []);

/** Where new attributes go: after the last attribute or the tag name */
function attributeEnd(tag: SyntaxNode): number {
	const attributes = attributesOf(tag);
	return (attributes.at(-1) ?? tag.getChild('TagName') ?? tag.firstChild!).to;
}

function buildAttribute(doc: string, attribute: SyntaxNode): TreeNode {
	const name = attribute.getChild('AttributeName')!;
	const value = attribute.getChild('AttributeValue');
	const key = doc.slice(name.from, name.to);
	const quoted = value && value.to - value.from >= 2 && /["']/.test(doc[value.from]);
	const valueRange = quoted ? { from: value.from + 1, to: value.to - 1 } : undefined;
	return {
		id: '',
		kind: 'attribute',
		key,
		keyRange: { from: name.from, to: name.to },
		value: valueRange ? decodeXml(doc.slice(valueRange.from, valueRange.to)) : '',
		valueRange,
		range: { from: attribute.from, to: attribute.to },
		can: { rename: true, edit: !!valueRange, remove: true, duplicate: true, move: true }
	};
}

/** Content nodes of an element or the document; text pieces next to each other form one node */
function content(doc: string, parent: SyntaxNode, top: boolean): TreeNode[] {
	const out: TreeNode[] = [];
	let run: Range | null = null;
	const flush = () => {
		if (!run) return;
		const raw = doc.slice(run.from, run.to);
		const trimmed = raw.trim();
		// The range leaves out the layout whitespace around the text, which edits keep as it is
		const from = run.from + raw.length - raw.trimStart().length;
		run = null;
		if (!trimmed) return;
		const range = { from, to: from + trimmed.length };
		out.push({ id: '', kind: 'text', value: decodeXml(trimmed), valueRange: { ...range }, range, can: { edit: !top, remove: true, move: !top } });
	};
	for (let c = parent.firstChild; c; c = c.nextSibling) {
		if (TEXT.has(c.name)) {
			if (run) run.to = c.to;
			else run = { from: c.from, to: c.to };
			continue;
		}
		flush();
		if (c.name === 'Element') out.push(buildElement(doc, c, top));
		else if (c.name in READ_ONLY) out.push(buildReadOnly(doc, c, top));
	}
	flush();
	return out;
}

function buildReadOnly(doc: string, node: SyntaxNode, top: boolean): TreeNode {
	const raw = doc.slice(node.from, node.to);
	const kind = READ_ONLY[node.name];
	const out: TreeNode = { id: '', kind, range: { from: node.from, to: node.to }, can: { remove: true, move: true } };
	if (node.name === 'Comment') out.value = raw.slice(4, -3);
	else if (node.name === 'Cdata') out.value = raw.slice(9, -3);
	else if (node.name === 'DoctypeDecl') {
		out.key = '!DOCTYPE';
		out.value = raw.slice(9, -1).trim();
	} else {
		const [, target, rest] = /^<\?(\S*)\s*([\s\S]*?)\??>?$/.exec(raw) ?? [];
		out.key = target ?? '';
		out.value = (rest ?? '').replace(/\?$/, '').trim();
	}
	// The XML declaration and the doctype must stay in front of the root element
	if (top && (node.name === 'DoctypeDecl' || out.key === 'xml')) out.can = { remove: true };
	return out;
}

function buildElement(doc: string, element: SyntaxNode, top: boolean): TreeNode {
	const tag = tagOf(element);
	const name = tag?.getChild('TagName');
	const key = name ? doc.slice(name.from, name.to) : '';
	const node: TreeNode = {
		id: '',
		kind: 'element',
		key,
		keyRange: name ? { from: name.from, to: name.to } : undefined,
		range: { from: element.from, to: element.to },
		can: {
			rename: !!name,
			remove: true,
			duplicate: !top,
			move: true,
			add: ['element', 'attribute', 'text'],
			types: []
		}
	};
	const attributes = attributesOf(tag).map((a) => buildAttribute(doc, a));
	// Namespace declared on the element itself (default or for its prefix)
	const prefix = key.includes(':') ? key.slice(0, key.indexOf(':')) : '';
	const ns = attributes.find((a) => a.key === (prefix ? `xmlns:${prefix}` : 'xmlns'));
	if (ns?.value) node.note = ns.value;
	const inner = content(doc, element, false);
	const texts = inner.filter((c) => c.kind === 'text');
	if (!inner.length) {
		node.value = '';
		node.can.edit = true;
	} else if (inner.length === 1 && texts.length === 1) {
		node.value = texts[0].value;
		node.valueRange = { ...texts[0].valueRange! };
		node.can.edit = true;
	}
	node.children = [...attributes, ...inner];
	return node;
}

/** Ids: attributes as `@name`, elements by tag name, other content by index */
const idKey = (c: TreeNode) => (c.kind === 'attribute' ? `@${c.key}` : c.kind === 'element' ? c.key : undefined);

export function parseXml(doc: string): TreeParse {
	const tree = parser.parse(doc);
	const children = content(doc, tree.topNode, true);
	const root: TreeNode = {
		id: '',
		kind: 'document',
		range: { from: 0, to: doc.length },
		children,
		can: { add: children.some((c) => c.kind === 'element') ? [] : ['element'] }
	};
	assignIds(root, idKey);
	const unclosed = (n: { name: string }) => n.name === 'MissingCloseTag' || n.name === 'MismatchedCloseTag';
	return { root, error: doc.trim() ? firstError(tree, unclosed) : null };
}

/** The element's syntax node in the current text */
function locate(doc: string, range: Range): SyntaxNode | null {
	for (let n: SyntaxNode | null = parser.parse(doc).resolve(range.from, 1); n; n = n.parent) {
		if (n.name === 'Element' && n.from === range.from && n.to === range.to) return n;
		if (n.from < range.from) break;
	}
	return null;
}

/** Indented lines that start with a tag */
const TAG_INDENT = /\n([ \t]+)</;

/** The node ends its line (only whitespace after it) */
const endsLine = (doc: string, pos: number) => doc.slice(pos, lineEndOf(doc, pos)).trim() === '';

/**
 * Fills an element without content: a self-closing tag gets a close tag. Elements go on their own line when the
 * text is indented, text stays inline.
 */
function fill(doc: string, parent: TreeNode, raw: string, ownLine: boolean): ChangeSpec | null {
	const element = locate(doc, parent.range);
	if (!element) return null;
	const indent = indentAt(doc, parent.range.from);
	const inner = ownLine && /\n[ \t]+</.test(doc) ? `\n${indent}${indentUnit(doc, TAG_INDENT)}${raw}\n${indent}` : raw;
	const open = element.getChild('OpenTag');
	const close = element.getChild('CloseTag');
	if (open && close) return { from: open.to, to: close.from, insert: inner };
	const tag = element.getChild('SelfClosingTag');
	if (!tag) return null;
	return { from: attributeEnd(tag), to: tag.to, insert: `>${inner}</${parent.key}>` };
}

/** Inserts raw content at position `index` among the content nodes, following their layout */
function insertContent(doc: string, parent: TreeNode, index: number, raw: string, isElement: boolean): ChangeSpec | null {
	const nodes = (parent.children ?? []).filter((c) => c.kind !== 'attribute');
	if (!nodes.length) return fill(doc, parent, raw, isElement);
	const i = Math.max(0, Math.min(index, nodes.length));
	const perLine = nodes.every((n) => ownsLine(doc, n.range.from) && endsLine(doc, n.range.to));
	if (i < nodes.length) {
		const at = nodes[i].range.from;
		return { from: at, insert: perLine ? `${raw}\n${indentAt(doc, at)}` : raw };
	}
	const last = nodes[nodes.length - 1];
	return { from: last.range.to, insert: perLine ? `\n${indentAt(doc, last.range.from)}${raw}` : raw };
}

/** Removes a node; one that owns its line(s) takes the line break with it */
function removeRange(doc: string, range: Range): ChangeSpec {
	if (!ownsLine(doc, range.from) || !endsLine(doc, range.to)) return { from: range.from, to: range.to };
	const start = lineStartOf(doc, range.from);
	const end = lineEndOf(doc, range.to);
	if (end < doc.length) return { from: start, to: end + 1 };
	return { from: Math.max(0, start - 1), to: end };
}

/** Start of the whitespace in front of `pos` */
function spaceBefore(doc: string, pos: number) {
	let from = pos;
	while (from > 0 && /\s/.test(doc[from - 1])) from--;
	return from;
}

const quoteOf = (doc: string, node: TreeNode): '"' | "'" => (doc[node.valueRange!.from - 1] === "'" ? "'" : '"');

export const xmlFormat: TreeFormat = {
	parse: parseXml,

	setValue(doc, node, value) {
		if (!node.can.edit) return null;
		if (node.kind === 'attribute') {
			return node.valueRange ? { ...node.valueRange, insert: escapeAttribute(value.text, quoteOf(doc, node)) } : null;
		}
		if (node.kind === 'text') return { ...node.valueRange!, insert: escapeText(value.text) };
		if (node.kind !== 'element') return null;
		if (node.valueRange) return { ...node.valueRange, insert: escapeText(value.text) };
		return fill(doc, node, escapeText(value.text), false);
	},

	rename(doc, node, key) {
		if (!node.can.rename || !node.keyRange || !isName(key)) return null;
		if (node.kind === 'attribute') return { ...node.keyRange, insert: key };
		const element = locate(doc, node.range);
		if (!element) return null;
		const close = element.getChild('CloseTag')?.getChild('TagName');
		const changes: ChangeSpec[] = [{ ...node.keyRange, insert: key }];
		if (close) changes.push({ from: close.from, to: close.to, insert: key });
		return changes;
	},

	insert(doc, parent, index, child: NewChild) {
		if (parent.kind === 'document') {
			if (child.kind !== 'element' || !parent.can.add?.length || !isName(child.key)) return null;
			if (!doc.trim()) return { from: 0, to: doc.length, insert: `<${child.key}/>` };
			const last = parent.children!.at(-1)!;
			return { from: last.range.to, insert: `\n<${child.key}/>` };
		}
		if (parent.kind !== 'element') return null;
		const attributes = (parent.children ?? []).filter((c) => c.kind === 'attribute');
		if (child.kind === 'attribute') {
			if (!isName(child.key) || attributes.some((a) => a.key === child.key)) return null;
			const raw = `${child.key}="${escapeAttribute(child.value, '"')}"`;
			if (index < attributes.length) return { from: attributes[Math.max(0, index)].range.from, insert: `${raw} ` };
			const element = locate(doc, parent.range);
			const tag = element && tagOf(element);
			return tag ? { from: attributeEnd(tag), insert: ` ${raw}` } : null;
		}
		if (child.kind === 'element') {
			if (!isName(child.key)) return null;
			return insertContent(doc, parent, index - attributes.length, `<${child.key}/>`, true);
		}
		if (child.kind === 'text') return insertContent(doc, parent, index - attributes.length, escapeText(child.value), false);
		return null;
	},

	remove(doc, _parent, node) {
		if (!node.can.remove) return null;
		if (node.kind === 'attribute') return { from: spaceBefore(doc, node.range.from), to: node.range.to };
		return removeRange(doc, node.range);
	},

	duplicate(doc, parent, node) {
		if (!node.can.duplicate) return null;
		if (node.kind === 'attribute') {
			const key = freeName(
				parent.children!.filter((c) => c.kind === 'attribute').map((c) => c.key),
				node.key!,
				'-'
			);
			const space = doc.slice(spaceBefore(doc, node.range.from), node.range.from) || ' ';
			return { from: node.range.to, insert: space + key + doc.slice(node.keyRange!.to, node.range.to) };
		}
		const raw = doc.slice(node.range.from, node.range.to);
		const own = ownsLine(doc, node.range.from) && endsLine(doc, node.range.to);
		return { from: node.range.to, insert: own ? `\n${indentAt(doc, node.range.from)}${raw}` : raw };
	},

	move(doc, parent, node, delta) {
		const other = neighbour(parent, node, delta);
		if (!other || !node.can.move || (other.kind === 'attribute') !== (node.kind === 'attribute')) return null;
		return swap(doc, node.range, other.range);
	}
};
