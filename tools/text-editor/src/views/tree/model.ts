import { ChangeSet, Text, type ChangeSpec } from '@codemirror/state';
import type { SyntaxNodeRef, Tree } from '@lezer/common';
import { freeName } from '../names.js';

// The tree behind the tree view (JSON, YAML, TOML, INI, XML …). The text stays the only source: a format parses it
// into nodes that know where they are in the text, and every edit is a minimal change of exactly that place – the
// rest of the text (indentation, comments, quoting) stays as it is. All positions are offsets in the editor's text,
// whose line breaks are always `\n`.

export interface Range {
	from: number;
	to: number;
}

/** Kinds of values a user can create or change into */
export type ValueKind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

export type NodeKind =
	| ValueKind
	/** TOML date/time */
	| 'date'
	/** YAML alias (`*name`) */
	| 'alias'
	/** XML */
	| 'element'
	| 'attribute'
	| 'text'
	| 'comment'
	| 'cdata'
	| 'instruction'
	/** INI section */
	| 'section'
	/** One document of a YAML stream, one line of JSON Lines */
	| 'document';

/** What a new child is: an entry with a key, an item of a list, or (XML) an element, attribute or text */
export type ChildKind = 'entry' | 'item' | 'element' | 'attribute' | 'text';

export interface Capabilities {
	/** The key/name can be changed */
	rename?: boolean;
	/** The scalar value can be changed */
	edit?: boolean;
	/** Kinds this node can be turned into (its own kind included); empty: none */
	types?: readonly ValueKind[];
	remove?: boolean;
	/** Can swap places with its neighbours */
	move?: boolean;
	duplicate?: boolean;
	/** Kinds of children that can be added */
	add?: readonly ChildKind[];
}

export interface TreeNode {
	/** Path from the root (keys, or indices where there is no key): keeps nodes open across edits */
	id: string;
	kind: NodeKind;
	/** Key in a mapping, name of an element or attribute; none for list items */
	key?: string;
	/** Raw key in the text (replaced on rename) */
	keyRange?: Range;
	/** Scalar value as shown (decoded: no quotes, no escapes) */
	value?: string;
	/** Raw value in the text (replaced when the value changes) */
	valueRange?: Range;
	/** The whole entry including its key: selection, moving, duplicating, removing */
	range: Range;
	children?: TreeNode[];
	/** Extra information shown next to it: anchor, tag, namespace */
	note?: string;
	can: Capabilities;
}

export interface TreeParse {
	/** Top level; its children are shown (the root itself is not a row) */
	root: TreeNode;
	/** Position of the first syntax error: the tree is then not edited */
	error: number | null;
}

/** A new value: what the user typed and the kind it is meant to be */
export interface NewValue {
	kind: ValueKind;
	/** Shown text for scalars (ignored for containers and null) */
	text: string;
}

export type NewChild =
	| { kind: 'entry'; key: string; value: NewValue }
	| { kind: 'item'; value: NewValue }
	| { kind: 'element'; key: string }
	| { kind: 'attribute'; key: string; value: string }
	| { kind: 'text'; value: string };

/**
 * One file format of the tree view. `doc` is always the current text the tree was parsed from; every edit returns
 * the changes for CodeMirror (`null`: not possible, nothing happens).
 */
export interface TreeFormat {
	parse(doc: string): TreeParse;
	setValue(doc: string, node: TreeNode, value: NewValue): ChangeSpec | null;
	rename(doc: string, node: TreeNode, key: string): ChangeSpec | null;
	/** New child of `parent` at position `index` among its children */
	insert(doc: string, parent: TreeNode, index: number, child: NewChild): ChangeSpec | null;
	remove(doc: string, parent: TreeNode, node: TreeNode): ChangeSpec | null;
	/** Copy right after the node (keys made unique where they must be) */
	duplicate(doc: string, parent: TreeNode, node: TreeNode): ChangeSpec | null;
	/** Swaps the node with its neighbour (`-1` before, `1` after) */
	move(doc: string, parent: TreeNode, node: TreeNode, delta: -1 | 1): ChangeSpec | null;
	/** INI: a new section at the end (formats without sections leave it out) */
	addSection?(doc: string, root: TreeNode, name: string): ChangeSpec | null;
}

// --- Helpers shared by the formats ---

export const ALL_KINDS: readonly ValueKind[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];

export const childId = (parent: string, key: string | undefined, index: number) =>
	`${parent}/${key === undefined ? `#${index}` : key.replaceAll('/', '//')}`;

/** Makes ids unique where keys repeat (allowed in YAML/JSON, though rarely meant) */
export function uniqueIds(children: TreeNode[]) {
	const seen = new Map<string, number>();
	for (const child of children) {
		const n = seen.get(child.id) ?? 0;
		seen.set(child.id, n + 1);
		if (n) child.id = `${child.id}#${n}`;
	}
}

/** Ids from the root down: by `keyOf` (default the key), by index where it gives none */
export function assignIds(node: TreeNode, keyOf: (child: TreeNode) => string | undefined = (c) => c.key) {
	const children = node.children;
	if (!children) return;
	children.forEach((c, i) => (c.id = childId(node.id, keyOf(c), i)));
	uniqueIds(children);
	for (const c of children) assignIds(c, keyOf);
}

/** Position of the first syntax error of a Lezer tree: error nodes, and nodes `isError` refuses */
export function firstError(tree: Tree, isError?: (node: SyntaxNodeRef) => boolean): number | null {
	let error: number | null = null;
	tree.iterate({
		enter: (n) => {
			if (error !== null) return false;
			if (n.type.isError || isError?.(n)) error = n.from;
		}
	});
	return error;
}

/**
 * How a typed text is meant: a number, `true`/`false` or `null` become that kind, anything else is a string.
 * Used for new entries and for values whose kind is not a string.
 */
export function guessKind(text: string): ValueKind {
	const t = text.trim();
	if (t === 'true' || t === 'false') return 'boolean';
	if (t === 'null') return 'null';
	if (t !== '' && /^-?(\d+(\.\d+)?([eE][+-]?\d+)?|\.\d+)$/.test(t)) return 'number';
	return 'string';
}

/** The text a value gets when it changes kind (a number that isn't one becomes 0) */
export function convertText(kind: ValueKind, text: string): string {
	if (kind === 'number') return guessKind(text) === 'number' ? text.trim() : '0';
	if (kind === 'boolean') return text.trim() === 'false' || text.trim() === '' ? 'false' : 'true';
	return text;
}

/** A free key in `parent` based on `base` (`key`, `key 2`, …; `sep` goes before the number) */
export const freeKey = (parent: TreeNode, base: string, sep = ' ') =>
	freeName(parent.children?.map((c) => c.key) ?? [], base, sep);

export const lineStartOf = (doc: string, pos: number) => doc.lastIndexOf('\n', pos - 1) + 1;

export function lineEndOf(doc: string, pos: number) {
	const end = doc.indexOf('\n', pos);
	return end < 0 ? doc.length : end;
}

/** Leading whitespace of the line that contains `pos` */
export function indentAt(doc: string, pos: number) {
	const start = lineStartOf(doc, pos);
	return /^[ \t]*/.exec(doc.slice(start, start + 200))![0];
}

/** The node sits alone on its lines (only whitespace before it on its first line) */
export const ownsLine = (doc: string, pos: number) => doc.slice(lineStartOf(doc, pos), pos).trim() === '';

/** Swaps the texts of two non-overlapping ranges (moving an entry over its neighbour) */
export function swap(doc: string, a: Range, b: Range): ChangeSpec {
	const [first, second] = a.from < b.from ? [a, b] : [b, a];
	return [
		{ from: first.from, to: first.to, insert: doc.slice(second.from, second.to) },
		{ from: second.from, to: second.to, insert: doc.slice(first.from, first.to) }
	];
}

/** The neighbour a node swaps with, if moving is possible */
export function neighbour(parent: TreeNode, node: TreeNode, delta: -1 | 1): TreeNode | null {
	const siblings = parent.children ?? [];
	const other = siblings[siblings.indexOf(node) + delta];
	return other && other.can.move ? other : null;
}

/** Deepest node whose range contains `pos` (cursor in the text → node in the tree), with its ancestors */
export function nodeAt(root: TreeNode, pos: number): TreeNode[] {
	const path: TreeNode[] = [];
	let node: TreeNode | undefined = root;
	while (node) {
		const next: TreeNode | undefined = node.children?.find((c) => c.range.from <= pos && pos <= c.range.to);
		if (!next) break;
		path.push(next);
		node = next;
	}
	return path;
}

/** Applies changes to a text, exactly as CodeMirror does (tests, and formats that build on an edited text) */
export function applyChanges(doc: string, spec: ChangeSpec | null): string {
	if (!spec) return doc;
	return ChangeSet.of(spec, doc.length).apply(Text.of(doc.split('\n'))).toString();
}
