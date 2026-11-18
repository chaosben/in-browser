import type { ChangeSpec } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { parser } from '@lezer/yaml';
import { indentUnit, insertRaw, removeEntry } from './json.js';
import {
	ALL_KINDS,
	childId,
	convertText,
	freeKey,
	lineEndOf,
	lineStartOf,
	neighbour,
	ownsLine,
	swap,
	uniqueIds,
	type ChildKind,
	type NewChild,
	type NewValue,
	type NodeKind,
	type TreeFormat,
	type TreeNode,
	type TreeParse,
	type ValueKind
} from './model.js';

// YAML as a tree (parsed with Lezer). Block collections get new entries on their own lines with the indentation of
// their siblings, flow collections (`{…}`, `[…]`) are edited like JSON; comments, anchors, tags and quoting elsewhere
// stay as they are. Aliases, complex keys (`? …`) and merge keys (`<<`) are shown but not edited.

/** What an edit needs to know beyond the node (kept per node, recomputed from the text when missing) */
interface Extra {
	/** The value sits inside a flow collection (`,[]{}` need quoting there) */
	inFlow: boolean;
	/** End of what stands before the value (`:`, `-`, anchor, tag); null at the top of a document */
	head: number | null;
	/** Written before a value where there is none yet (`a:` → ' ', `{a}` → ': ') */
	prefix: string;
	/** The value is a block collection */
	block: boolean;
	/** Empty document: where its first entry goes */
	emptyAt?: number;
}

const extras = new WeakMap<TreeNode, Extra>();

// --- Scalars ---

const NULL = /^(~|null|Null|NULL)?$/;
const BOOL = /^(true|True|TRUE|false|False|FALSE)$/;
const NUMBER =
	/^([-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+|[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?|[-+]?\.(inf|Inf|INF)|\.(nan|NaN|NAN))$/;
/** Plain texts other YAML versions or tools read as something else (YAML 1.1 booleans, sexagesimal, `1_000`) */
const AMBIGUOUS = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF|<<|[-+]?[0-9][0-9_:.]*|[-+]?\.[0-9_.]+)$/;
const TAG_KINDS: Record<string, ValueKind> = {
	'!!str': 'string',
	'!!int': 'number',
	'!!float': 'number',
	'!!bool': 'boolean',
	'!!null': 'null'
};

/** Kind of a plain scalar (YAML 1.2 core schema) */
export function resolvePlain(text: string): ValueKind {
	if (NULL.test(text)) return 'null';
	if (BOOL.test(text)) return 'boolean';
	if (NUMBER.test(text)) return 'number';
	return 'string';
}

/** Folds the line breaks of a flow scalar: one break is a space, n breaks are n-1 newlines */
function fold(text: string, escapes: boolean): string {
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (escapes && c === '\\') {
			const e = text[++i];
			if (e === '\n') {
				while (text[i + 1] === ' ' || text[i + 1] === '\t') i++;
			} else if (e === 'x' || e === 'u' || e === 'U') {
				const n = e === 'x' ? 2 : e === 'u' ? 4 : 8;
				out += String.fromCodePoint(parseInt(text.slice(i + 1, i + 1 + n), 16) || 0);
				i += n;
			} else out += ESCAPES[e] ?? e ?? '';
		} else if (c === ' ' || c === '\t' || c === '\n') {
			let j = i;
			while (j < text.length && ' \t\n'.includes(text[j])) j++;
			const run = text.slice(i, j);
			const breaks = run.split('\n').length - 1;
			// Trailing white space at the end of a line (or the text) is not part of the value
			out += breaks === 0 ? run : breaks === 1 ? ' ' : '\n'.repeat(breaks - 1);
			i = j - 1;
		} else out += c;
	}
	return out;
}

const ESCAPES: Record<string, string> = {
	'0': '\0',
	a: '\x07',
	b: '\b',
	t: '\t',
	'\t': '\t',
	n: '\n',
	v: '\v',
	f: '\f',
	r: '\r',
	e: '\x1b',
	' ': ' ',
	'"': '"',
	'/': '/',
	'\\': '\\',
	N: '\x85',
	_: '\xa0',
	L: '\u2028',
	P: '\u2029'
};

/** End of a quoted scalar's closing quote, or -1 when it is not closed */
function quoteEnd(raw: string): number {
	const q = raw[0];
	for (let i = 1; i < raw.length; i++) {
		if (q === '"' && raw[i] === '\\') i++;
		else if (raw[i] === q) {
			if (q === "'" && raw[i + 1] === "'") i++;
			else return i + 1;
		}
	}
	return -1;
}

export function decodeQuoted(raw: string): string {
	const inner = raw.slice(1, quoteEnd(raw) < 0 ? raw.length : -1);
	return raw[0] === '"' ? fold(inner, true) : fold(inner, false).replaceAll("''", "'");
}

/** Content of a block scalar (`|` keeps line breaks, `>` folds them; `-` strips, `+` keeps trailing ones) */
function decodeBlock(doc: string, node: SyntaxNode): string {
	const header = node.getChild('BlockLiteralHeader');
	const content = node.getChild('BlockLiteralContent');
	const head = header ? doc.slice(header.from, header.to) : '|';
	if (!content) return '';
	const lines = doc.slice(lineStartOf(doc, content.from), content.to).split('\n');
	const first = lines.find((l) => l.trim() !== '') ?? '';
	const indent = /^ */.exec(first)![0].length;
	const text = lines.map((l) => l.slice(Math.min(indent, /^ */.exec(l)![0].length)));
	let out = '';
	if (head.startsWith('|')) out = text.join('\n');
	else {
		// Folded: a single break between two normal lines is a space; more-indented lines keep their breaks
		const normal = (l: string) => !/^[ \t]/.test(l);
		let last = -1;
		text.forEach((line, i) => {
			if (line === '') return void (out += '\n');
			if (last >= 0) {
				const folds = normal(text[last]) && normal(line);
				if (i === last + 1) out += folds ? ' ' : '\n';
				else if (!folds) out += '\n';
			}
			out += line;
			last = i;
		});
	}
	if (head.includes('-')) return out;
	if (!head.includes('+')) return out + '\n';
	// Keep: also the empty lines after the content
	const rest = /^\n([ \t]*\n)*/.exec(doc.slice(content.to))?.[0] ?? '';
	return out + rest.replace(/[ \t]/g, '');
}

/** Whether a string can be written without quotes (in a block or inside a flow collection) */
function plainSafe(text: string, inFlow: boolean): boolean {
	if (text === '' || text !== text.trim()) return false;
	if (resolvePlain(text) !== 'string' || AMBIGUOUS.test(text)) return false;
	if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text) || text.startsWith('...')) return false;
	if (text.includes(': ') || text.includes(' #') || text.endsWith(':')) return false;
	if (/[\x00-\x1f\x7f\x85\u2028\u2029\ufeff]/.test(text)) return false;
	return !(inFlow && /[,[\]{}]/.test(text));
}

export function encodeString(text: string, inFlow = false): string {
	return plainSafe(text, inFlow) ? text : JSON.stringify(text);
}

export function encodeValue(value: NewValue, inFlow = false): string {
	switch (value.kind) {
		case 'string':
			return encodeString(value.text, inFlow);
		case 'number':
			return resolvePlain(value.text.trim()) === 'number' ? value.text.trim() : '0';
		case 'boolean':
			return convertText('boolean', value.text);
		case 'null':
			return 'null';
		case 'object':
			return '{}';
		case 'array':
			return '[]';
	}
}

// --- Parsing ---

const isComment = (n: SyntaxNode) => n.name === 'Comment';

/** First syntax error: an error node or a quoted scalar that is never closed */
function firstError(top: SyntaxNode, doc: string): number | null {
	let error: number | null = null;
	top.toTree().iterate({
		enter: (n) => {
			if (error !== null) return false;
			if (n.type.isError) error = n.from;
			else if (n.name === 'QuotedLiteral' && quoteEnd(doc.slice(n.from, n.to)) !== n.to - n.from) error = n.from;
		}
	});
	return error;
}

/** End of a node without trailing comments (Lezer lets collections run over them) */
function contentEnd(node: SyntaxNode): number {
	let c = node.lastChild;
	while (c && (isComment(c) || c.from === c.to)) c = c.prevSibling;
	return c ? contentEnd(c) : node.to;
}

/** Start of a collection's first entry (block collections start at the line break before it) */
function contentStart(node: SyntaxNode): number {
	let c = node.firstChild;
	while (c && (isComment(c) || c.from === c.to)) c = c.nextSibling;
	return c && (node.name === 'BlockMapping' || node.name === 'Pair') ? contentStart(c) : (c?.from ?? node.from);
}

interface Entry {
	/** Start of the whole entry: key, `?` or `-` */
	from: number;
	/** The raw value (anchors and tags included), null when there is none */
	value: SyntaxNode | null;
	/** End of what stands before the value */
	head: number;
	prefix: string;
	key?: { text: string; from: number; to: number; plain: boolean };
	/** Complex or merge key: neither key nor value are edited */
	fixed?: boolean;
}

function mappingEntries(doc: string, node: SyntaxNode): Entry[] {
	const out: Entry[] = [];
	let question: number | null = null;
	for (let c = node.firstChild; c; c = c.nextSibling) {
		if (c.name === '?') question = c.from;
		if (c.name !== 'Pair') continue;
		const key = c.getChild('Key');
		const colon = c.getChild(':');
		let value = colon?.nextSibling ?? null;
		while (value && isComment(value)) value = value.nextSibling;
		const content = key?.firstChild;
		const entry: Entry = {
			from: question ?? key?.from ?? c.from,
			value,
			head: colon?.to ?? key?.to ?? c.from,
			prefix: colon ? ' ' : ': '
		};
		if (key && content && (content.name === 'Literal' || content.name === 'QuotedLiteral') && question === null) {
			const raw = doc.slice(content.from, content.to);
			const text = content.name === 'Literal' ? fold(raw, false) : decodeQuoted(raw);
			entry.key = { text, from: key.from, to: key.to, plain: true };
			if (content.name === 'Literal' && text === '<<') entry.fixed = true;
		} else {
			const raw = key ? doc.slice(key.from, key.to) : '';
			entry.key = { text: raw.replace(/\s+/g, ' ').trim(), from: key?.from ?? c.from, to: key?.to ?? c.from, plain: false };
			entry.fixed = true;
		}
		out.push(entry);
		question = null;
	}
	return out;
}

function sequenceEntries(node: SyntaxNode): Entry[] {
	const out: Entry[] = [];
	let dash: SyntaxNode | null = null;
	for (let c = node.firstChild; c; c = c.nextSibling) {
		if (c.name === '-') dash = c;
		if (c.name !== 'Item') continue;
		let value = c.firstChild;
		while (value && isComment(value)) value = value.nextSibling;
		out.push({ from: dash?.from ?? c.from, value, head: dash?.to ?? c.from, prefix: ' ' });
		dash = null;
	}
	return out;
}

interface Context {
	doc: string;
	inFlow: boolean;
	/** Edits are not offered (inside a complex key's entry) */
	fixed?: boolean;
}

/** Builds the node of one entry (or of a document's top value when `entry.from` is the value's start) */
function build(ctx: Context, entry: Entry, id: string): TreeNode {
	const { doc } = ctx;
	// Anchors and tags around the value become the note
	const notes: string[] = [];
	let value = entry.value;
	let head = entry.head;
	let tag: string | undefined;
	while (value && (value.name === 'Anchored' || value.name === 'Tagged')) {
		const mark = value.getChild(value.name === 'Anchored' ? 'Anchor' : 'Tag');
		if (mark) {
			notes.push(doc.slice(mark.from, mark.to));
			if (value.name === 'Tagged') tag = notes[notes.length - 1];
			head = mark.to;
		}
		let inner = mark?.nextSibling ?? null;
		while (inner && isComment(inner)) inner = inner.nextSibling;
		value = inner;
	}
	const extra: Extra = { inFlow: ctx.inFlow, head, prefix: value ? '' : entry.prefix, block: false };
	let kind: NodeKind;
	let text: string | undefined;
	let valueRange = value ? { from: value.from, to: contentEnd(value) } : { from: head, to: head };
	switch (value?.name) {
		case undefined:
			kind = 'null';
			text = '';
			break;
		case 'Literal':
			text = fold(doc.slice(value.from, value.to), false);
			kind = resolvePlain(text);
			break;
		case 'QuotedLiteral':
			kind = 'string';
			text = decodeQuoted(doc.slice(value.from, value.to));
			break;
		case 'BlockLiteral':
			kind = 'string';
			text = decodeBlock(doc, value);
			break;
		case 'Alias':
			kind = 'alias';
			text = doc.slice(value.from, value.to);
			break;
		case 'BlockMapping':
		case 'FlowMapping':
			kind = 'object';
			break;
		case 'BlockSequence':
		case 'FlowSequence':
			kind = 'array';
			break;
		default:
			// Something the tree doesn't model: shown as its text, not edited
			kind = 'string';
			text = doc.slice(value!.from, value!.to);
			ctx = { ...ctx, fixed: true };
	}
	if (tag && tag in TAG_KINDS && kind !== 'object' && kind !== 'array' && kind !== 'alias') kind = TAG_KINDS[tag];
	const fixed = !!(entry.fixed || ctx.fixed);
	const node: TreeNode = {
		id,
		kind,
		valueRange,
		range: { from: entry.from, to: Math.max(valueRange.to, head) },
		can: {
			edit: !fixed && kind !== 'object' && kind !== 'array' && kind !== 'alias',
			types: fixed || kind === 'alias' ? [] : tag ? [kind as ValueKind] : ALL_KINDS,
			remove: true,
			move: true,
			duplicate: !entry.fixed,
			rename: !fixed && !!entry.key?.plain
		}
	};
	if (entry.key) {
		node.key = entry.key.text;
		node.keyRange = { from: entry.key.from, to: entry.key.to };
	}
	if (text !== undefined) node.value = text;
	if (notes.length) node.note = notes.join(' ');
	if (value && (kind === 'object' || kind === 'array')) {
		const flow = value.name.startsWith('Flow');
		extra.block = !flow;
		// `[a: b]`: a mapping without braces inside a flow sequence – no place for more entries
		const bare = flow && !'{['.includes(doc[value.from]);
		valueRange = node.valueRange = { from: flow ? value.from : contentStart(value), to: contentEnd(value) };
		if (!fixed && !bare) node.can.add = kind === 'object' ? ['entry'] : ['item'];
		const inner: Context = { doc, inFlow: flow || ctx.inFlow, fixed: fixed || undefined };
		const entries = kind === 'object' ? mappingEntries(doc, value) : sequenceEntries(value);
		node.children = entries.map((e, i) => build(inner, e, childId(id, e.key?.text, i)));
		uniqueIds(node.children);
	}
	extras.set(node, extra);
	return node;
}

/** The value of a document (after `---` and directives), null when it has none */
function documentValue(document: SyntaxNode): { value: SyntaxNode | null; head: number | null } {
	let head: number | null = null;
	for (let c = document.firstChild; c; c = c.nextSibling) {
		if (c.name === 'DirectiveEnd') head = c.to;
		else if (c.name !== 'Directive' && !isComment(c) && c.name !== 'DocEnd') return { value: c, head };
	}
	return { value: null, head };
}

/**
 * One document as a node: a collection at the top is the document itself (its entries are the first level), a
 * scalar becomes its only child, an empty document gets its first entry at `emptyAt`.
 */
function buildDocument(doc: string, value: SyntaxNode | null, id: string, range: { from: number; to: number }, emptyAt: number): TreeNode {
	const document: TreeNode = { id, kind: 'document', range, can: {} };
	if (!value) {
		const empty: TreeNode = { ...document, children: [], can: { add: ['entry'] } };
		extras.set(empty, { inFlow: false, head: null, prefix: '', block: false, emptyAt });
		return empty;
	}
	const node = build({ doc, inFlow: false }, { from: value.from, value, head: value.from, prefix: '' }, childId(id, undefined, 0));
	const extra = extras.get(node)!;
	if (!node.note) extra.head = null;
	if (node.kind === 'object' || node.kind === 'array') {
		const top: TreeNode = { ...node, id, kind: node.kind, can: { add: node.can.add, types: [] } };
		if (id) top.kind = 'document';
		// Children keep ids below the document
		extras.set(top, extra);
		return top;
	}
	node.can = { ...node.can, remove: false, move: false, duplicate: false };
	const wrapper: TreeNode = { ...document, children: [node] };
	extras.set(wrapper, { inFlow: false, head: null, prefix: '', block: false });
	return wrapper;
}

export function parseYaml(doc: string): TreeParse {
	const top = parser.parse(doc).topNode;
	const error = firstError(top, doc);
	const documents = top.getChildren('Document');
	const whole = { from: 0, to: doc.length };
	if (documents.length <= 1) {
		const document = documents[0];
		const { value } = document ? documentValue(document) : { value: null };
		return { root: buildDocument(doc, value, '', whole, document ? document.to : doc.length), error };
	}
	const children = documents.map((d, i) => {
		const { value } = documentValue(d);
		const node = buildDocument(doc, value, childId('', undefined, i), { from: d.from, to: contentEnd(d) }, d.to);
		node.kind = 'document';
		return node;
	});
	const root: TreeNode = { id: '', kind: 'document', range: whole, children, can: {} };
	return { root, error };
}

let cache: { doc: string; root: TreeNode } | null = null;

/** The extra information of a node, from the parse it came from or a fresh one of the same text */
function extraOf(doc: string, node: TreeNode): Extra | undefined {
	const known = extras.get(node);
	if (known) return known;
	if (cache?.doc !== doc) cache = { doc, root: parseYaml(doc).root };
	const find = (n: TreeNode): TreeNode | undefined => (n.id === node.id ? n : n.children?.map(find).find(Boolean));
	const found = find(cache.root);
	return found && extras.get(found);
}

// --- Edits ---

const column = (doc: string, pos: number) => pos - lineStartOf(doc, pos);

/** A new entry of a mapping or sequence as text */
function childText(parent: TreeNode, child: NewChild, inFlow: boolean): string | null {
	const add: readonly ChildKind[] = parent.can.add ?? [];
	if (child.kind === 'entry' && add.includes('entry')) {
		return `${encodeString(child.key, inFlow)}: ${encodeValue(child.value, inFlow)}`;
	}
	if (child.kind === 'item' && (add.includes('item') || (parent.kind === 'document' && !parent.children?.length))) {
		return inFlow ? encodeValue(child.value, true) : `- ${encodeValue(child.value)}`;
	}
	return null;
}

/** Puts text on new lines in a block collection: before the entry at `index`, or after the last one */
function insertLines(doc: string, parent: TreeNode, index: number, text: string): ChangeSpec {
	const siblings = parent.children!;
	if (index < siblings.length) {
		const at = siblings[index].range.from;
		return { from: at, insert: `${text}\n${' '.repeat(column(doc, at))}` };
	}
	const last = siblings[siblings.length - 1];
	return { from: last.range.to, insert: `\n${' '.repeat(column(doc, last.range.from))}${text}` };
}

/** Whether the parent's value is a flow collection (`{…}`/`[…]`) */
const isFlow = (doc: string, parent: TreeNode) => !!parent.valueRange && '{['.includes(doc[parent.valueRange.from]);

export const yamlFormat: TreeFormat = {
	parse(doc) {
		const result = parseYaml(doc);
		cache = { doc, root: result.root };
		return result;
	},

	setValue(doc, node, value) {
		const extra = extraOf(doc, node);
		if (!node.valueRange || !extra || !node.can.types?.includes(value.kind)) return null;
		if (value.kind === node.kind && (value.kind === 'object' || value.kind === 'array')) return null;
		const text = encodeValue(value, extra.inFlow);
		const { from, to } = node.valueRange;
		if (from === to) return { from, insert: extra.prefix + text };
		// A block collection is replaced from right after its `:`/`-` (comments between go with it)
		if (extra.block && extra.head !== null) return { from: extra.head, to, insert: ` ${text}` };
		return { from, to, insert: text };
	},

	rename(doc, node, key) {
		if (!node.keyRange || !node.can.rename) return null;
		return { ...node.keyRange, insert: encodeString(key, extraOf(doc, node)?.inFlow ?? false) };
	},

	insert(doc, parent, index, child) {
		const extra = extraOf(doc, parent);
		if (!extra) return null;
		const siblings = parent.children ?? [];
		if (extra.emptyAt !== undefined) {
			// Empty document: the first entry on its own line
			const text = childText(parent, child, false);
			if (!text) return null;
			const at = extra.emptyAt;
			const before = at > 0 && doc[at - 1] !== '\n';
			return { from: at, insert: `${before ? '\n' : ''}${text}${at === doc.length || !before ? '\n' : ''}` };
		}
		if (!parent.valueRange) return null;
		if (!isFlow(doc, parent)) {
			const text = childText(parent, child, false);
			return text && siblings.length ? insertLines(doc, parent, index, text) : null;
		}
		if (siblings.length) {
			const text = childText(parent, child, true);
			return text ? insertRaw(doc, parent, index, text) : null;
		}
		const { from, to } = parent.valueRange;
		if (extra.inFlow) {
			const text = childText(parent, child, true);
			return text ? { from: from + 1, to: to - 1, insert: text } : null;
		}
		// An empty `{}`/`[]` in block context becomes a block collection
		const text = childText(parent, child, false);
		if (!text) return null;
		let start = from;
		while (doc[start - 1] === ' ' || doc[start - 1] === '\t') start--;
		if (extra.head === null) {
			const atLineStart = start === lineStartOf(doc, start);
			return { from: atLineStart ? from : start, to, insert: (atLineStart ? '' : '\n') + text };
		}
		const indent = ' '.repeat(column(doc, parent.range.from)) + indentUnit(doc);
		return { from: start, to, insert: `\n${indent}${text}` };
	},

	remove(doc, parent, node) {
		const siblings = parent.children ?? [];
		const i = siblings.indexOf(node);
		if (i < 0 || !node.can.remove) return null;
		if (isFlow(doc, parent)) return removeEntry(parent, node);
		const extra = extraOf(doc, parent);
		if (siblings.length === 1 && extra && extra.head !== null && parent.valueRange) {
			// The last entry: the value stays a (now empty) collection of the same kind
			return { from: extra.head, to: parent.valueRange.to, insert: parent.kind === 'array' ? ' []' : ' {}' };
		}
		if (!ownsLine(doc, node.range.from)) {
			// First entry on the line of its `-`: the next one moves up
			const next = siblings[i + 1];
			return next ? { from: node.range.from, to: next.range.from } : null;
		}
		const to = lineEndOf(doc, node.range.to);
		return { from: lineStartOf(doc, node.range.from), to: Math.min(to + 1, doc.length) };
	},

	duplicate(doc, parent, node) {
		const index = (parent.children ?? []).indexOf(node) + 1;
		if (!index || !node.can.duplicate) return null;
		const flow = isFlow(doc, parent);
		const raw =
			node.key !== undefined && node.keyRange
				? encodeString(freeKey(parent, node.key), flow) + doc.slice(node.keyRange.to, node.range.to)
				: doc.slice(node.range.from, node.range.to);
		if (flow) return insertRaw(doc, parent, index, raw);
		return { from: node.range.to, insert: `\n${' '.repeat(column(doc, node.range.from))}${raw}` };
	},

	move(doc, parent, node, delta) {
		const other = neighbour(parent, node, delta);
		return other && node.can.move ? swap(doc, node.range, other.range) : null;
	}
};
