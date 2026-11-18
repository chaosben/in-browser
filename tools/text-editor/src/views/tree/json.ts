import type { ChangeSpec } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { parser } from '@lezer/json';
import {
	ALL_KINDS,
	childId,
	convertText,
	freeKey,
	indentAt,
	neighbour,
	swap,
	uniqueIds,
	type NewChild,
	type NewValue,
	type NodeKind,
	type TreeFormat,
	type TreeNode,
	type TreeParse
} from './model.js';

// JSON as a tree (parsed with Lezer, which knows every position). New entries follow the layout of their siblings
// (one per line or all in one line), the rest of the text is never touched.

const KINDS: Record<string, NodeKind> = {
	Object: 'object',
	Array: 'array',
	String: 'string',
	Number: 'number',
	True: 'boolean',
	False: 'boolean',
	Null: 'null'
};

export function decodeString(raw: string): string {
	try {
		return JSON.parse(raw) as string;
	} catch {
		return raw.slice(1, -1);
	}
}

/** Position of the first syntax error (Lezer marks them with error nodes) */
function firstError(node: SyntaxNode): number | null {
	let error: number | null = null;
	node.toTree().iterate({
		enter: (n) => {
			if (error !== null) return false;
			if (n.type.isError) error = n.from;
		}
	});
	return error;
}

/** Child value nodes (no punctuation) */
function values(node: SyntaxNode): SyntaxNode[] {
	const out: SyntaxNode[] = [];
	for (let c = node.firstChild; c; c = c.nextSibling) if (c.name in KINDS || c.name === 'Property') out.push(c);
	return out;
}

function build(doc: string, value: SyntaxNode, id: string, offset: number, key?: { text: string; node: SyntaxNode }): TreeNode {
	const kind = KINDS[value.name] ?? 'null';
	const raw = doc.slice(value.from, value.to);
	const node: TreeNode = {
		id,
		kind,
		valueRange: { from: value.from + offset, to: value.to + offset },
		range: { from: (key?.node.from ?? value.from) + offset, to: value.to + offset },
		can: { edit: kind !== 'object' && kind !== 'array', types: ALL_KINDS, remove: true, move: true, duplicate: true, rename: !!key }
	};
	if (key) {
		node.key = key.text;
		node.keyRange = { from: key.node.from + offset, to: key.node.to + offset };
	}
	if (kind === 'string') node.value = decodeString(raw);
	else if (kind !== 'object' && kind !== 'array') node.value = raw;
	else {
		node.can.add = kind === 'object' ? ['entry'] : ['item'];
		node.children = values(value).map((c, i) => {
			if (c.name !== 'Property') return build(doc, c, childId(id, undefined, i), offset);
			const name = c.getChild('PropertyName')!;
			const inner = values(c)[0] ?? name;
			const text = decodeString(doc.slice(name.from, name.to));
			return build(doc, inner, childId(id, text, i), offset, { text, node: name });
		});
		uniqueIds(node.children);
	}
	return node;
}

/**
 * Parses one JSON value; `offset` shifts all positions (JSON Lines parses line by line). An empty text gives a
 * document without children (adding writes the first value).
 */
export function parseJson(doc: string, offset = 0, id = ''): TreeParse {
	const top = parser.parse(doc).topNode;
	const at = firstError(top);
	const error = at === null ? null : at + offset;
	const main = values(top)[0];
	const document: TreeNode = { id, kind: 'document', range: { from: offset, to: offset + doc.length }, can: {} };
	if (!main) return { root: { ...document, children: [], can: { add: ['item'] } }, error };
	const node = build(doc, main, childId(id, undefined, 0), offset);
	if (node.kind === 'object' || node.kind === 'array') {
		// A container at the top: its entries are the first level; it can't be removed or moved
		node.id = id;
		node.can = { add: node.can.add, types: [] };
		return { root: node, error };
	}
	node.can = { ...node.can, remove: false, move: false, duplicate: false };
	return { root: { ...document, children: [node] }, error };
}

/** One step of indentation as used in the text (default two spaces) */
export function indentUnit(doc: string): string {
	const match = /\n([ \t]+)\S/.exec(doc);
	if (!match) return '  ';
	return match[1].startsWith('\t') ? '\t' : match[1];
}

export function encodeValue(value: NewValue): string {
	switch (value.kind) {
		case 'string':
			return JSON.stringify(value.text);
		case 'number':
		case 'boolean':
			return convertText(value.kind, value.text);
		case 'null':
			return 'null';
		case 'object':
			return '{}';
		case 'array':
			return '[]';
	}
}

/**
 * Inserts raw entry text into a container (`{…}`/`[…]` whose brackets are the ends of `parent.valueRange`).
 * Separators copy the siblings' layout; an empty container gets one entry per line unless the text has no line
 * breaks at all (minified) or `inline` asks for one line (JSON Lines).
 */
export function insertRaw(doc: string, parent: TreeNode, index: number, raw: string, inline = false): ChangeSpec | null {
	const siblings = parent.children ?? [];
	if (!parent.valueRange) {
		// Empty document: the value becomes the whole text
		return siblings.length ? null : { from: parent.range.from, to: parent.range.to, insert: raw };
	}
	if (!siblings.length) {
		const { from, to } = parent.valueRange;
		if (inline || (!doc.includes('\n') && doc.trim().length > 2)) return { from: from + 1, to: to - 1, insert: raw };
		const indent = indentAt(doc, parent.range.from);
		return { from: from + 1, to: to - 1, insert: `\n${indent}${indentUnit(doc)}${raw}\n${indent}` };
	}
	let separator: string;
	if (siblings.length >= 2) separator = doc.slice(siblings[0].range.to, siblings[1].range.from);
	else {
		const before = doc.slice(parent.valueRange.from + 1, siblings[0].range.from);
		separator = before.includes('\n') ? `,\n${indentAt(doc, siblings[0].range.from)}` : ', ';
	}
	if (index < siblings.length) return { from: siblings[index].range.from, insert: raw + separator };
	return { from: siblings[siblings.length - 1].range.to, insert: separator + raw };
}

/** Removes an entry with the separator next to it; the last one empties the container */
export function removeEntry(parent: TreeNode, node: TreeNode): ChangeSpec | null {
	const siblings = parent.children ?? [];
	const i = siblings.indexOf(node);
	if (i < 0) return null;
	if (siblings.length === 1) {
		if (!parent.valueRange) return { from: parent.range.from, to: parent.range.to };
		return { from: parent.valueRange.from + 1, to: parent.valueRange.to - 1 };
	}
	if (i < siblings.length - 1) return { from: node.range.from, to: siblings[i + 1].range.from };
	return { from: siblings[i - 1].range.to, to: node.range.to };
}

export const jsonFormat: TreeFormat = {
	parse: (doc) => parseJson(doc),

	setValue(_doc, node, value) {
		if (!node.valueRange) return null;
		if (value.kind === node.kind && (value.kind === 'object' || value.kind === 'array')) return null;
		return { ...node.valueRange, insert: encodeValue(value) };
	},

	rename(_doc, node, key) {
		return node.keyRange ? { ...node.keyRange, insert: JSON.stringify(key) } : null;
	},

	insert(doc, parent, index, child: NewChild) {
		if (child.kind === 'entry' && parent.kind === 'object') {
			return insertRaw(doc, parent, index, `${JSON.stringify(child.key)}: ${encodeValue(child.value)}`);
		}
		if (child.kind === 'item' && parent.kind !== 'object') return insertRaw(doc, parent, index, encodeValue(child.value));
		return null;
	},

	remove: (_doc, parent, node) => removeEntry(parent, node),

	duplicate(doc, parent, node) {
		const index = (parent.children ?? []).indexOf(node) + 1;
		if (!index || !node.can.duplicate) return null;
		const raw =
			node.key !== undefined && node.keyRange
				? JSON.stringify(freeKey(parent, node.key)) + doc.slice(node.keyRange.to, node.range.to)
				: doc.slice(node.range.from, node.range.to);
		return insertRaw(doc, parent, index, raw);
	},

	move(doc, parent, node, delta) {
		const other = neighbour(parent, node, delta);
		return other && node.can.move ? swap(doc, node.range, other.range) : null;
	}
};
