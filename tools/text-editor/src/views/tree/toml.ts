import type { ChangeSpec } from '@codemirror/state';
import { insertRaw, removeEntry } from './json.js';
import {
	childId,
	convertText,
	freeKey,
	indentAt,
	lineEndOf,
	lineStartOf,
	neighbour,
	swap,
	uniqueIds,
	type NewValue,
	type Range,
	type TreeFormat,
	type TreeNode,
	type TreeParse,
	type ValueKind
} from './model.js';

// TOML 1.0 as a tree, with a small parser of its own that records positions. Tables from headers (`[a.b]`,
// `[[a]]`) and dotted keys (`a.b = 1`) become nested nodes; inline tables and arrays are edited like JSON. New
// entries are written as lines into the section of their table, the rest of the text is never touched.

/** TOML has no null */
const TOML_KINDS: readonly ValueKind[] = ['string', 'number', 'boolean', 'object', 'array'];

const NUMBER =
	/^(?:[+-]?(?:0|[1-9](?:_?\d)*)(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|[+-]?(?:inf|nan)|0x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*)$/;
const DATE =
	/^(?:\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?|\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;
const BARE_KEY = /^[A-Za-z0-9_-]+$/;
const BARE = /[A-Za-z0-9_-]+/y;
const SCALAR = /[^\s,\]}#]+/y;
const TIME = /\d{2}:\d{2}[^\s,\]}#]*/y;
const LINE_BACKSLASH = /\\[ \t]*\n/y;

const ESCAPES: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', e: '\x1b', '"': '"', '\\': '\\' };
const SHORT: Record<string, string> = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"': '\\"', '\\': '\\\\' };

/** A basic string with TOML's escapes */
export function encodeString(text: string): string {
	let out = '"';
	for (const c of text) {
		const code = c.codePointAt(0)!;
		if (SHORT[c]) out += SHORT[c];
		else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, '0')}`;
		else out += c;
	}
	return `${out}"`;
}

export const encodeKey = (key: string) => (BARE_KEY.test(key) ? key : encodeString(key));

/** Raw TOML for a new value; `null` for kinds TOML doesn't have */
function encodeValue(value: NewValue): string | null {
	switch (value.kind) {
		case 'string':
			return encodeString(value.text);
		case 'number':
			return NUMBER.test(value.text.trim()) ? value.text.trim() : '0';
		case 'boolean':
			return convertText('boolean', value.text);
		case 'null':
			return null;
		case 'object':
			return '{}';
		case 'array':
			return '[]';
	}
}

// --- Shared with the INI family: whole lines and sections ---

/** Start of the comment lines directly above the line starting at `lineStart` */
export function attachedStart(doc: string, lineStart: number, comment = /^[ \t]*#/): number {
	let start = lineStart;
	while (start > 0) {
		const prev = lineStartOf(doc, start - 1);
		if (!comment.test(doc.slice(prev, start - 1))) break;
		start = prev;
	}
	return start;
}

/** Removes the lines a range is on, with their line break */
export function removeLines(doc: string, range: Range): ChangeSpec {
	let from = lineStartOf(doc, range.from);
	let to = lineEndOf(doc, range.to);
	if (to < doc.length) to++;
	else if (from > 0) from--;
	return { from, to };
}

/**
 * Removes a section from its header line to `to` (start of the next header, or the end of the text). Comments
 * directly above a header (after a blank line) belong to it: they go with this one and stay with the next one. At
 * the end of the text, the blank lines before the section go too.
 */
export function removeSection(doc: string, from: number, to: number, comment = /^[ \t]*#/): ChangeSpec {
	const blankBefore = (pos: number) => pos === 0 || doc.slice(lineStartOf(doc, pos - 1), pos - 1).trim() === '';
	const lead = attachedStart(doc, from, comment);
	if (lead < from && blankBefore(lead)) from = lead;
	if (to < doc.length) {
		const start = attachedStart(doc, to, comment);
		if (start < to && start > from && blankBefore(start)) to = start;
		return { from, to };
	}
	const prev = doc.slice(0, from).trimEnd().length;
	if (prev === 0) return { from: 0, to };
	return { from: doc.endsWith('\n') ? prev + 1 : prev, to };
}

// --- Parser ---

type Role = 'root' | 'table' | 'implicit' | 'aot' | 'item' | 'dotted' | 'pair' | 'entry' | 'element';

interface Section {
	/** Start of the header line (0 for the part before the first header) */
	start: number;
	/** `[…]`/`[[…]]`; none for the root part */
	header: Range | null;
	/** End of the last non-blank line */
	contentEnd: number;
	/** Start of the next header line, or the end of the text */
	end: number;
	/** Key/value lines in text order */
	pairs: TreeNode[];
}

/** An entry of an inline table as written (`a.b = 1` is one) */
interface RawEntry {
	range: Range;
	keyRange: Range;
	node: TreeNode;
}

interface Meta {
	role: Role;
	/** Section a table owns (root, table, item) or a line lives in (pair, section-level dotted) */
	section?: Section;
	/** Key path of a table as written in headers */
	path?: string[];
	/** Dotted: the raw key of its lines up to its own segment and the dot after it (`a.b.`) */
	prefix?: string;
	/** Entry: the inline table it is written in, and how */
	inline?: TreeNode;
	raw?: RawEntry;
	/** Inline table values: their entries as written */
	entries?: RawEntry[];
}

interface Table {
	node: TreeNode;
	kind: 'root' | 'table' | 'implicit' | 'dotted' | 'inline' | 'item';
	keys: Map<string, Slot>;
}

interface Slot {
	table?: Table;
	aot?: { node: TreeNode; items: Table[] };
	value?: TreeNode;
}

interface Segment extends Range {
	text: string;
}

interface Analysis extends TreeParse {
	meta: Map<TreeNode, Meta>;
	byId: Map<string, TreeNode>;
	/** All sections in text order, the root part first */
	sections: Section[];
	/** Header segments that name a table or array of tables (renaming changes them all) */
	refs: Map<TreeNode, Range[]>;
}

const STOP = new Error('toml syntax');

const objectNode = (key?: string): TreeNode => ({ id: '', kind: 'object', key, range: { from: 0, to: 0 }, children: [], can: {} });

class Parser {
	p = 0;
	error: number | null = null;
	meta = new Map<TreeNode, Meta>();
	refs = new Map<TreeNode, Range[]>();
	sections: Section[];
	root: Table = { node: objectNode(), kind: 'root', keys: new Map() };

	constructor(readonly doc: string) {
		this.sections = [{ start: 0, header: null, contentEnd: 0, end: doc.length, pairs: [] }];
		this.meta.set(this.root.node, { role: 'root', section: this.sections[0] });
	}

	fail(pos: number): never {
		this.error ??= pos;
		throw STOP;
	}

	mark(node: TreeNode, fields: Partial<Meta> & { role: Role }) {
		const m = this.meta.get(node);
		if (m) Object.assign(m, fields);
		else this.meta.set(node, fields);
	}

	ref(node: TreeNode, segment: Segment) {
		const list = this.refs.get(node) ?? [];
		list.push({ from: segment.from, to: segment.to });
		this.refs.set(node, list);
	}

	run() {
		const doc = this.doc;
		let table = this.root;
		let section = this.sections[0];
		while (this.p < doc.length) {
			const start = this.p;
			try {
				this.ws();
				const c = doc[this.p];
				if (c === '\n') {
					this.p++;
					continue;
				}
				if (c === undefined) break;
				if (c === '[') {
					const next = this.header(start);
					section.end = start;
					[table, section] = next;
				} else if (c !== '#') this.pair(table, section);
				section.contentEnd = this.eol();
			} catch (e) {
				if (e !== STOP) throw e;
				section.contentEnd = lineEndOf(doc, this.p);
				this.p = section.contentEnd + 1;
			}
		}
	}

	ws() {
		const doc = this.doc;
		while (doc[this.p] === ' ' || doc[this.p] === '\t' || doc[this.p] === '\r') this.p++;
	}

	/** Whitespace, line breaks and comments (inside arrays and inline tables) */
	space() {
		for (;;) {
			this.ws();
			if (this.doc[this.p] === '\n') this.p++;
			else if (this.doc[this.p] === '#') this.p = lineEndOf(this.doc, this.p);
			else return;
		}
	}

	/** End of a line: only a comment may follow; returns the position of the line break */
	eol(): number {
		this.ws();
		if (this.doc[this.p] === '#') this.p = lineEndOf(this.doc, this.p);
		if (this.p < this.doc.length && this.doc[this.p] !== '\n') this.fail(this.p);
		return this.p++;
	}

	key(): Segment[] {
		const doc = this.doc;
		const segments: Segment[] = [];
		for (;;) {
			this.ws();
			const from = this.p;
			let text: string;
			if (doc[from] === '"' && !doc.startsWith('"""', from)) text = this.basic();
			else if (doc[from] === "'" && !doc.startsWith("'''", from)) text = this.literal();
			else {
				BARE.lastIndex = from;
				const m = BARE.exec(doc);
				if (!m) this.fail(from);
				text = m[0];
				this.p += text.length;
			}
			segments.push({ text, from, to: this.p });
			this.ws();
			if (doc[this.p] !== '.') return segments;
			this.p++;
		}
	}

	/** `\x` at `i`: the decoded text and where it ends */
	escape(i: number): [string, number] {
		const c = this.doc[i + 1];
		if (c in ESCAPES) return [ESCAPES[c], i + 2];
		const length = c === 'u' ? 4 : c === 'U' ? 8 : c === 'x' ? 2 : 0;
		const hex = this.doc.slice(i + 2, i + 2 + length);
		const code = parseInt(hex, 16);
		if (!length || !/^[0-9A-Fa-f]+$/.test(hex) || hex.length < length || code > 0x10ffff || (code >= 0xd800 && code < 0xe000)) {
			this.fail(i);
		}
		return [String.fromCodePoint(code), i + 2 + length];
	}

	basic(): string {
		const doc = this.doc;
		let out = '';
		let i = this.p + 1;
		for (;;) {
			const c = doc[i];
			if (c === undefined || c === '\n') this.fail(i);
			if (c === '"') break;
			if (c === '\\') {
				const [s, next] = this.escape(i);
				out += s;
				i = next;
			} else {
				out += c;
				i++;
			}
		}
		this.p = i + 1;
		return out;
	}

	literal(): string {
		const end = this.doc.indexOf("'", this.p + 1);
		const newline = this.doc.indexOf('\n', this.p + 1);
		if (end < 0 || (newline >= 0 && newline < end)) this.fail(this.p);
		const text = this.doc.slice(this.p + 1, end);
		this.p = end + 1;
		return text;
	}

	/** `"""…"""` or `'''…'''`: a line break right after the opening is dropped; up to two quotes may end the text */
	multiline(quote: '"' | "'"): string {
		const doc = this.doc;
		const start = this.p;
		let out = '';
		let i = start + 3;
		if (doc[i] === '\n') i++;
		for (;;) {
			if (i >= doc.length) this.fail(start);
			if (doc.startsWith(quote.repeat(3), i)) {
				let q = 3;
				while (doc[i + q] === quote && q < 5) q++;
				out += quote.repeat(q - 3);
				this.p = i + q;
				return out;
			}
			if (quote === '"' && doc[i] === '\\') {
				LINE_BACKSLASH.lastIndex = i;
				if (LINE_BACKSLASH.test(doc)) {
					i = LINE_BACKSLASH.lastIndex;
					while (doc[i] === ' ' || doc[i] === '\t' || doc[i] === '\n' || doc[i] === '\r') i++;
				} else {
					const [s, next] = this.escape(i);
					out += s;
					i = next;
				}
				continue;
			}
			out += doc[i++];
		}
	}

	leaf(kind: TreeNode['kind'], value: string, from: number): TreeNode {
		const range = { from, to: this.p };
		return { id: '', kind, value, valueRange: range, range: { ...range }, can: {} };
	}

	value(): TreeNode {
		const doc = this.doc;
		const from = this.p;
		const c = doc[from];
		if (c === '"' || c === "'") {
			const text = doc.startsWith(c.repeat(3), from) ? this.multiline(c) : c === '"' ? this.basic() : this.literal();
			return this.leaf('string', text, from);
		}
		if (c === '[') return this.array();
		if (c === '{') return this.inlineTable();
		SCALAR.lastIndex = from;
		const m = SCALAR.exec(doc);
		if (!m) this.fail(from);
		let raw = m[0];
		// `1979-05-27 07:32:00`: a space may separate date and time
		if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && doc[from + raw.length] === ' ') {
			TIME.lastIndex = from + raw.length + 1;
			const time = TIME.exec(doc);
			if (time) raw += ` ${time[0]}`;
		}
		this.p = from + raw.length;
		if (raw === 'true' || raw === 'false') return this.leaf('boolean', raw, from);
		if (NUMBER.test(raw)) return this.leaf('number', raw, from);
		if (DATE.test(raw)) return this.leaf('date', raw, from);
		this.fail(from);
	}

	array(): TreeNode {
		const doc = this.doc;
		const from = this.p++;
		const children: TreeNode[] = [];
		for (;;) {
			this.space();
			if (doc[this.p] === ']') break;
			const item = this.value();
			this.mark(item, { role: 'element' });
			children.push(item);
			this.space();
			if (doc[this.p] === ',') this.p++;
			else if (doc[this.p] === ']') break;
			else this.fail(this.p);
		}
		this.p++;
		const range = { from, to: this.p };
		return { id: '', kind: 'array', valueRange: range, range: { ...range }, children, can: {} };
	}

	/** `{ a = 1, b.c = 2 }` (line breaks and a trailing comma are tolerated, as in TOML 1.1) */
	inlineTable(): TreeNode {
		const doc = this.doc;
		const from = this.p++;
		const table: Table = { node: objectNode(), kind: 'inline', keys: new Map() };
		const entries: RawEntry[] = [];
		for (;;) {
			this.space();
			if (doc[this.p] === '}') break;
			entries.push(this.pair(table, null));
			this.space();
			if (doc[this.p] === ',') this.p++;
			else if (doc[this.p] === '}') break;
			else this.fail(this.p);
		}
		this.p++;
		const node = table.node;
		node.valueRange = { from, to: this.p };
		node.range = { from, to: this.p };
		this.mark(node, { role: 'element', entries });
		return node;
	}

	/** `key = value` into table `t`: in a section, or (section `null`) inside an inline table */
	pair(t: Table, section: Section | null): RawEntry {
		const doc = this.doc;
		const inline = section ? undefined : t.node;
		const segments = this.key();
		if (doc[this.p] !== '=') this.fail(this.p);
		this.p++;
		this.ws();
		const node = this.value();
		const last = segments[segments.length - 1];
		for (let i = 0; i < segments.length - 1; i++) {
			const segment = segments[i];
			const slot = t.keys.get(segment.text);
			if (!slot) {
				const sub = this.table(t, segment.text, 'dotted');
				const prefix = doc.slice(segments[0].from, segments[i + 1].from);
				this.mark(sub.node, { role: 'dotted', section: section ?? undefined, prefix });
				t = sub;
			} else if (slot.table?.kind === 'dotted') t = slot.table;
			else this.fail(segment.from);
		}
		if (t.keys.has(last.text)) this.fail(last.from);
		node.key = last.text;
		node.keyRange = { from: last.from, to: last.to };
		node.range = { from: segments[0].from, to: node.range.to };
		t.keys.set(last.text, { value: node });
		t.node.children!.push(node);
		const raw = { range: node.range, keyRange: node.keyRange, node };
		if (section) {
			this.mark(node, { role: 'pair', section });
			section.pairs.push(node);
		} else this.mark(node, { role: 'entry', inline, raw });
		return raw;
	}

	table(parent: Table, key: string, kind: Table['kind']): Table {
		const table: Table = { node: objectNode(key), kind, keys: new Map() };
		parent.keys.set(key, { table });
		parent.node.children!.push(table.node);
		return table;
	}

	header(lineStart: number): [Table, Section] {
		const doc = this.doc;
		const from = this.p;
		const aot = doc[from + 1] === '[';
		this.p += aot ? 2 : 1;
		const segments = this.key();
		if (doc[this.p] !== ']' || (aot && doc[this.p + 1] !== ']')) this.fail(this.p);
		this.p += aot ? 2 : 1;
		const section: Section = { start: lineStart, header: { from, to: this.p }, contentEnd: 0, end: doc.length, pairs: [] };

		let t = this.root;
		const path: string[] = [];
		for (let i = 0; i < segments.length - 1; i++) {
			const segment = segments[i];
			path.push(segment.text);
			let slot = t.keys.get(segment.text);
			if (!slot) {
				const sub = this.table(t, segment.text, 'implicit');
				this.mark(sub.node, { role: 'implicit', path: [...path] });
				slot = { table: sub };
			}
			if (slot.aot) {
				this.ref(slot.aot.node, segment);
				t = slot.aot.items[slot.aot.items.length - 1];
			} else if (slot.table && slot.table.kind !== 'inline') {
				this.ref(slot.table.node, segment);
				t = slot.table;
			} else this.fail(segment.from);
		}

		const last = segments[segments.length - 1];
		path.push(last.text);
		const slot = t.keys.get(last.text);
		let table: Table;
		if (aot) {
			if (slot && !slot.aot) this.fail(last.from);
			let list = slot?.aot;
			if (!list) {
				const node: TreeNode = { ...objectNode(last.text), kind: 'array', keyRange: { from: last.from, to: last.to } };
				list = { node, items: [] };
				t.keys.set(last.text, { aot: list });
				t.node.children!.push(node);
				this.mark(node, { role: 'aot', path });
			}
			this.ref(list.node, last);
			table = { node: objectNode(), kind: 'item', keys: new Map() };
			list.items.push(table);
			list.node.children!.push(table.node);
			this.mark(table.node, { role: 'item', section, path });
		} else {
			if (slot && slot.table?.kind !== 'implicit') this.fail(last.from);
			table = slot?.table ?? this.table(t, last.text, 'table');
			table.kind = 'table';
			table.node.keyRange = { from: last.from, to: last.to };
			this.mark(table.node, { role: 'table', section, path });
			this.ref(table.node, last);
		}
		this.sections.push(section);
		return [table, section];
	}
}

function assignIds(node: TreeNode) {
	if (!node.children) return;
	node.children.forEach((c, i) => (c.id = childId(node.id, c.key, i)));
	uniqueIds(node.children);
	node.children.forEach(assignIds);
}

/** Tables span their section and everything below them */
function assignRanges(node: TreeNode, meta: Map<TreeNode, Meta>) {
	node.children?.forEach((c) => assignRanges(c, meta));
	const m = meta.get(node)!;
	if (!node.children || !['table', 'item', 'implicit', 'dotted', 'aot'].includes(m.role)) return;
	let from = m.section && m.role !== 'dotted' ? m.section.start : Infinity;
	let to = m.section && m.role !== 'dotted' ? m.section.contentEnd : -Infinity;
	for (const c of node.children) {
		from = Math.min(from, c.range.from);
		to = Math.max(to, c.range.to);
	}
	if (from <= to) node.range = { from, to };
}

function assignCapabilities(node: TreeNode, parent: TreeNode | null, meta: Map<TreeNode, Meta>) {
	const m = meta.get(node)!;
	const value = (rename: boolean, move: boolean) => ({
		rename,
		edit: node.kind !== 'object' && node.kind !== 'array',
		types: TOML_KINDS,
		remove: true,
		duplicate: true,
		move,
		add: node.kind === 'object' ? (['entry'] as const) : node.kind === 'array' ? (['item'] as const) : undefined
	});
	switch (m.role) {
		case 'root':
		case 'implicit':
			node.can = { add: ['entry'], types: [] };
			break;
		case 'table':
			node.can = { rename: true, remove: true, move: false, duplicate: false, add: ['entry'], types: [] };
			break;
		case 'aot':
			node.can = { rename: true, remove: true, move: false, duplicate: false, add: ['item'], types: [] };
			break;
		case 'item':
			node.can = { remove: true, duplicate: true, move: false, add: ['entry'], types: [] };
			break;
		case 'dotted':
			// Read-only structure; lines can be added to the ones in a section
			node.can = m.section ? { add: ['entry'], types: [] } : { types: [] };
			break;
		case 'pair':
			node.can = value(true, true);
			break;
		case 'entry':
			node.can = value(true, parent === m.inline);
			break;
		case 'element':
			node.can = value(false, true);
	}
	node.children?.forEach((c) => assignCapabilities(c, node, meta));
}

let cache: { doc: string; analysis: Analysis } | null = null;

function analyze(doc: string): Analysis {
	if (cache?.doc === doc) return cache.analysis;
	const parser = new Parser(doc);
	parser.run();
	const root = parser.root.node;
	root.range = { from: 0, to: doc.length };
	assignIds(root);
	assignRanges(root, parser.meta);
	assignCapabilities(root, null, parser.meta);
	const byId = new Map<string, TreeNode>();
	const walk = (n: TreeNode) => {
		byId.set(n.id, n);
		n.children?.forEach(walk);
	};
	walk(root);
	const analysis: Analysis = { root, error: parser.error, meta: parser.meta, byId, sections: parser.sections, refs: parser.refs };
	cache = { doc, analysis };
	return analysis;
}

/** The parsed node behind a node of the view (found by id, so copies work too) */
function find(doc: string, node: TreeNode) {
	const a = analyze(doc);
	const n = a.byId.get(node.id);
	return n ? { a, n, m: a.meta.get(n)! } : null;
}

/** An inline table as a container of its written entries (for `insertRaw`/`removeEntry`) */
const written = (node: TreeNode, entries: RawEntry[]): TreeNode => ({
	...node,
	children: entries.map((e) => ({ id: '', kind: 'null', range: e.range, can: {} }))
});

function insertInline(doc: string, container: TreeNode, index: number, raw: string): ChangeSpec | null {
	const { from, to } = container.valueRange!;
	if (!container.children!.length) return { from: from + 1, to: to - 1, insert: container.kind === 'object' ? ` ${raw} ` : raw };
	return insertRaw(doc, container, index, raw);
}

function descendants(node: TreeNode): TreeNode[] {
	return [node, ...(node.children ?? []).flatMap(descendants)];
}

/** A `key = value` line into the section of a table (or under a dotted key) */
function insertLine(doc: string, a: Analysis, n: TreeNode, m: Meta, index: number, key: string, raw: string): ChangeSpec {
	const section = m.section!;
	const own = new Set(descendants(n));
	const lines = section.pairs.filter((p) => own.has(p));
	const last = lines[lines.length - 1];
	const text = `${m.role === 'dotted' ? m.prefix : ''}${key}${last ? doc.slice(last.keyRange!.to, last.valueRange!.from) : ' = '}${raw}`;
	const target = n.children?.[index];
	const tm = target && a.meta.get(target);
	if (target && tm && (tm.role === 'pair' || tm.role === 'dotted') && tm.section === section) {
		return { from: lineStartOf(doc, target.range.from), insert: `${indentAt(doc, target.range.from)}${text}\n` };
	}
	if (last) return { from: lineEndOf(doc, last.range.to), insert: `\n${indentAt(doc, last.range.from)}${text}` };
	if (section.header) return { from: lineEndOf(doc, section.header.to), insert: `\n${text}` };
	// Root without pairs: before the first header (and the comments right above it)
	const first = a.sections[1];
	if (!first) return { from: doc.length, insert: `${doc && !doc.endsWith('\n') ? '\n' : ''}${text}\n` };
	return { from: attachedStart(doc, first.start), insert: `${text}\n\n` };
}

const headerPath = (m: Meta) => m.path!.map(encodeKey).join('.');

/** First section below a node (implicit tables get their header right before it) */
function firstSection(a: Analysis, node: TreeNode): Section | undefined {
	const starts = descendants(node)
		.map((d) => a.meta.get(d)!)
		.filter((d) => d.role === 'table' || d.role === 'item')
		.map((d) => d.section!);
	return starts.sort((x, y) => x.start - y.start)[0];
}

/** Removes the sections of a table and of the tables below it */
function removeTables(doc: string, a: Analysis, node: TreeNode): ChangeSpec | null {
	const own = new Set(
		descendants(node)
			.map((d) => a.meta.get(d)!)
			.filter((d) => d.role === 'table' || d.role === 'item')
			.map((d) => d.section!)
	);
	const changes: ChangeSpec[] = [];
	let from = -1;
	a.sections.forEach((s, i) => {
		if (!own.has(s)) return;
		if (from < 0) from = s.start;
		if (own.has(a.sections[i + 1])) return;
		changes.push(removeSection(doc, from, s.end));
		from = -1;
	});
	return changes.length ? changes : null;
}

export const tomlFormat: TreeFormat = {
	parse(doc) {
		const { root, error } = analyze(doc);
		return { root, error };
	},

	setValue(doc, node, value) {
		const f = find(doc, node);
		if (!f?.n.valueRange || !f.n.can.types?.length) return null;
		if (value.kind === f.n.kind && (value.kind === 'object' || value.kind === 'array')) return null;
		const text = value.text.trim();
		// A date stays a date while it looks like one
		const raw = f.n.kind === 'date' && value.kind === 'string' && DATE.test(text) ? text : encodeValue(value);
		return raw === null ? null : { ...f.n.valueRange, insert: raw };
	},

	rename(doc, node, key) {
		const f = find(doc, node);
		if (!f?.n.can.rename) return null;
		const insert = encodeKey(key);
		if (f.m.role === 'table' || f.m.role === 'aot') return (f.a.refs.get(f.n) ?? []).map((r) => ({ ...r, insert }));
		return f.n.keyRange ? { ...f.n.keyRange, insert } : null;
	},

	insert(doc, parent, index, child) {
		const f = find(doc, parent);
		if (!f) return null;
		const { a, n, m } = f;
		if (child.kind === 'item') {
			if (m.role === 'aot') {
				if (child.value.kind !== 'object') return null;
				const header = `[[${headerPath(m)}]]`;
				const items = n.children!;
				if (index < items.length) return { from: attachedStart(doc, a.meta.get(items[index])!.section!.start), insert: `${header}\n\n` };
				return { from: lineEndOf(doc, n.range.to), insert: `\n\n${header}` };
			}
			const raw = encodeValue(child.value);
			if (n.kind !== 'array' || !n.valueRange || raw === null) return null;
			return insertInline(doc, n, index, raw);
		}
		if (child.kind !== 'entry' || !n.can.add?.includes('entry')) return null;
		const raw = encodeValue(child.value);
		if (raw === null) return null;
		const key = encodeKey(child.key);
		if (m.entries) {
			const target = n.children![index];
			const at = target ? m.entries.findIndex((e) => e.node === target) : -1;
			return insertInline(doc, written(n, m.entries), at < 0 ? m.entries.length : at, `${key} = ${raw}`);
		}
		if (m.role === 'implicit') {
			const below = firstSection(a, n);
			if (!below) return null;
			return { from: attachedStart(doc, below.start), insert: `[${headerPath(m)}]\n${key} = ${raw}\n\n` };
		}
		if (m.role === 'root' || m.role === 'table' || m.role === 'item' || m.role === 'dotted') return insertLine(doc, a, n, m, index, key, raw);
		return null;
	},

	remove(doc, parent, node) {
		const f = find(doc, node);
		const p = find(doc, parent);
		if (!f?.n.can.remove || !p) return null;
		const { a, n, m } = f;
		switch (m.role) {
			case 'pair':
				return removeLines(doc, n.range);
			case 'entry': {
				const entries = a.meta.get(m.inline!)!.entries!;
				const container = written(m.inline!, entries);
				return removeEntry(container, container.children![entries.indexOf(m.raw!)]);
			}
			case 'element':
				return removeEntry(p.n, n);
			default:
				return removeTables(doc, a, n);
		}
	},

	duplicate(doc, parent, node) {
		const f = find(doc, node);
		const p = find(doc, parent);
		if (!f?.n.can.duplicate || !p) return null;
		const { a, n, m } = f;
		switch (m.role) {
			case 'pair': {
				const start = lineStartOf(doc, n.range.from);
				const end = lineEndOf(doc, n.range.to);
				const key = encodeKey(freeKey(p.n, n.key!));
				return { from: end, insert: `\n${doc.slice(start, n.keyRange!.from)}${key}${doc.slice(n.keyRange!.to, end)}` };
			}
			case 'entry': {
				const entries = a.meta.get(m.inline!)!.entries!;
				const { range, keyRange } = m.raw!;
				const key = encodeKey(freeKey(p.n, n.key!));
				const raw = doc.slice(range.from, keyRange.from) + key + doc.slice(keyRange.to, range.to);
				return insertRaw(doc, written(m.inline!, entries), entries.indexOf(m.raw!) + 1, raw);
			}
			case 'element':
				return insertRaw(doc, p.n, p.n.children!.indexOf(n) + 1, doc.slice(n.range.from, n.range.to));
			case 'item': {
				// The item's section with the tables below it
				const from = m.section!.start;
				const to = lineEndOf(doc, n.range.to);
				const gap = doc.slice(0, from).endsWith('\n\n') ? '\n\n' : '\n';
				return { from: to, insert: gap + doc.slice(from, to) };
			}
			default:
				return null;
		}
	},

	move(doc, parent, node, delta) {
		const f = find(doc, node);
		const p = find(doc, parent);
		if (!f?.n.can.move || !p) return null;
		const other = neighbour(p.n, f.n, delta);
		if (!other) return null;
		const om = f.a.meta.get(other)!;
		if (f.m.role === 'pair' && (om.role !== 'pair' || om.section !== f.m.section)) return null;
		return swap(doc, f.n.range, other.range);
	}
};
