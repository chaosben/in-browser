import type { ChangeSpec } from '@codemirror/state';
import {
	childId,
	freeKey,
	indentAt,
	lineEndOf,
	lineStartOf,
	neighbour,
	swap,
	uniqueIds,
	type Capabilities,
	type Range,
	type TreeFormat,
	type TreeNode,
	type TreeParse
} from './model.js';
import { HEADER, PAIR } from './ini-detect.js';
import { attachedStart, removeLines, removeSection } from './edit.js';

// The INI family as a tree: `ini` (sections, `key = value`), Java `properties` (no sections, continuation lines,
// escapes) and `.env` (`KEY=value`, quotes, `export`). Every value is a string; the text stays as written around
// the one line an edit touches.

export type IniDialect = 'ini' | 'properties' | 'env';

const ENTRY: Capabilities = { rename: true, edit: true, types: ['string'], remove: true, duplicate: true, move: true };
const SECTION: Capabilities = { rename: true, remove: true, add: ['entry'], move: false, duplicate: false, types: [] };

const ENV_LINE = /^(export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*/;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const ENV_PLAIN = /^[A-Za-z0-9_\-.,:/@+=%]*$/;

const COMMENT: Record<IniDialect, RegExp> = { ini: /^[ \t]*[;#]/, properties: /^[ \t]*[#!]/, env: /^[ \t]*#/ };

// --- Escapes ---

function decodeProperties(raw: string): string {
	let out = '';
	for (let i = 0; i < raw.length; i++) {
		const c = raw[i];
		if (c !== '\\') {
			out += c;
			continue;
		}
		const n = raw[++i];
		if (n === undefined) break;
		if (n === '\n') {
			// Continuation: the next line's leading whitespace is not part of the value
			while (raw[i + 1] === ' ' || raw[i + 1] === '\t' || raw[i + 1] === '\f') i++;
		} else if (n === 'u' && /^[0-9A-Fa-f]{4}$/.test(raw.slice(i + 1, i + 5))) {
			out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 5), 16));
			i += 4;
		} else out += ({ t: '\t', n: '\n', r: '\r', f: '\f' } as Record<string, string>)[n] ?? n;
	}
	return out;
}

/** Escapes for properties; keys also escape separators and comment marks, values only their leading spaces */
function encodeProperties(text: string, key: boolean): string {
	let out = '';
	let leading = true;
	for (const c of text) {
		if (c !== ' ') leading = false;
		if (c === '\\') out += '\\\\';
		else if (c === '\n') out += '\\n';
		else if (c === '\r') out += '\\r';
		else if (c === '\t') out += '\\t';
		else if (c === '\f') out += '\\f';
		else if (c === ' ' && (key || leading)) out += '\\ ';
		else if (key && '=:#!'.includes(c)) out += `\\${c}`;
		else out += c;
	}
	return out;
}

function decodeEnv(raw: string): string {
	return raw.replace(/\\([nrt"\\])/g, (_, c: string) => ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[c] ?? c);
}

function encodeEnv(text: string): string {
	if (ENV_PLAIN.test(text)) return text;
	return `"${text.replace(/[\\"\n\r\t]/g, (c) => ({ '\n': '\\n', '\r': '\\r', '\t': '\\t' } as Record<string, string>)[c] ?? `\\${c}`)}"`;
}

// --- Parser ---

function entry(key: string, keyRange: Range, value: string, valueRange: Range, from: number): TreeNode {
	return { id: '', kind: 'string', key, keyRange, value, valueRange, range: { from, to: valueRange.to }, can: ENTRY };
}

export function parseIni(doc: string, dialect: IniDialect): TreeParse {
	const root: TreeNode = { id: '', kind: 'object', range: { from: 0, to: doc.length }, children: [], can: { add: ['entry'], types: [] } };
	let error: number | null = null;
	let target = root;
	let pos = 0;
	for (;;) {
		const end = lineEndOf(doc, pos);
		const line = doc.slice(pos, end);
		const t = line.trim();
		const first = pos + line.length - line.trimStart().length;
		let last = end;
		if (t && !COMMENT[dialect].test(line)) {
			const header = dialect === 'ini' ? HEADER.exec(t) : null;
			let node: TreeNode | null = null;
			if (header) {
				const name = header[1].trim();
				const nameFrom = first + 1 + header[1].length - header[1].trimStart().length;
				target = {
					id: '',
					kind: 'section',
					key: name,
					keyRange: { from: nameFrom, to: nameFrom + name.length },
					range: { from: pos, to: end },
					children: [],
					can: SECTION
				};
				root.children!.push(target);
			} else if (dialect === 'ini') {
				const sep = line.search(/[=:]/);
				if (sep > first - pos) {
					const key = line.slice(first - pos, sep).trimEnd();
					const rest = line.slice(sep + 1);
					const from = pos + sep + 1 + rest.length - rest.trimStart().length;
					const value = rest.trim();
					node = entry(key, { from: first, to: first + key.length }, value, { from, to: from + value.length }, first);
				} else error ??= first;
			} else if (dialect === 'properties') {
				// A line ending in an odd number of backslashes continues on the next one
				while (last < doc.length && /(^|[^\\])(\\\\)*\\$/.test(doc.slice(pos, last))) last = lineEndOf(doc, last + 1);
				let i = first;
				while (i < last && !'=: \t\f'.includes(doc[i])) i += doc[i] === '\\' ? 2 : 1;
				const keyTo = Math.min(i, last);
				while (i < last && ' \t\f'.includes(doc[i])) i++;
				if (i < last && '=:'.includes(doc[i])) i++;
				while (i < last && ' \t\f'.includes(doc[i])) i++;
				const raw = doc.slice(i, last);
				node = entry(decodeProperties(doc.slice(first, keyTo)), { from: first, to: keyTo }, decodeProperties(raw), { from: i, to: last }, first);
			} else {
				const m = ENV_LINE.exec(doc.slice(first, end));
				if (m) {
					const keyFrom = first + (m[1]?.length ?? 0);
					const from = first + m[0].length;
					const q = doc[from];
					let to: number;
					let value: string;
					if (q === '"' || q === "'") {
						// Quoted values may span lines
						let j = from + 1;
						while (j < doc.length && doc[j] !== q) j += q === '"' && doc[j] === '\\' ? 2 : 1;
						if (j >= doc.length) {
							error ??= from;
							j = end - 1;
						}
						to = j + 1;
						value = q === '"' ? decodeEnv(doc.slice(from + 1, j)) : doc.slice(from + 1, j);
						last = lineEndOf(doc, to);
						const rest = doc.slice(to, last).trim();
						if (rest && !rest.startsWith('#')) error ??= to;
					} else {
						const rest = doc.slice(from, end);
						const comment = rest.search(/[ \t]#/);
						value = (comment < 0 ? rest : rest.slice(0, comment)).trimEnd();
						to = from + value.length;
					}
					node = entry(m[2], { from: keyFrom, to: keyFrom + m[2].length }, value, { from, to }, first);
				} else error ??= first;
			}
			if (node) target.children!.push(node);
		}
		if (t && target !== root) target.range.to = last;
		if (last >= doc.length) break;
		pos = last + 1;
	}
	root.children!.forEach((c, i) => {
		c.id = childId('', c.key, i);
		c.children?.forEach((e, j) => (e.id = childId(c.id, e.key, j)));
		if (c.children) uniqueIds(c.children);
	});
	uniqueIds(root.children!);
	return { root, error };
}

// --- Edits ---

/** Text for a key, or `null` if the dialect can't write it */
function encodeKey(dialect: IniDialect, key: string): string | null {
	if (dialect === 'properties') return key ? encodeProperties(key, true) : null;
	if (dialect === 'env') return ENV_KEY.test(key) ? key : null;
	return key.trim() && !/[=:\n]/.test(key) && !/^\s*[[;#]/.test(key) ? key.trim() : null;
}

function encodeValue(dialect: IniDialect, text: string): string {
	if (dialect === 'properties') return encodeProperties(text, false);
	if (dialect === 'env') return encodeEnv(text);
	return text.replace(/\r?\n/g, ' ').trim();
}

/** A free key in `parent` that the dialect can write (`.env` keys can't hold spaces: `KEY_2`) */
const freeEntryKey = (dialect: IniDialect, parent: TreeNode, base: string) => freeKey(parent, base, dialect === 'env' ? '_' : ' ');

/** Separator between key and value as the text writes it (the first pair's), else the dialect's default */
function separatorOf(doc: string, dialect: IniDialect, root: TreeNode): string {
	if (dialect === 'env') return '=';
	const all = root.children!.flatMap((c) => (c.kind === 'section' ? c.children! : [c]));
	const first = all[0];
	const sep = first ? doc.slice(first.keyRange!.to, first.valueRange!.from) : '';
	return /[=:]|^[ \t]+$/.test(sep) && !sep.includes('\n') ? sep : dialect === 'ini' ? ' = ' : '=';
}

/** A new section `[name]` at the end of an `ini` text */
export function insertSection(doc: string, _root: TreeNode, name: string): ChangeSpec | null {
	if (!name.trim() || /[\]\n]/.test(name)) return null;
	const before = doc === '' ? '' : doc.endsWith('\n') ? '\n' : '\n\n';
	return { from: doc.length, insert: `${before}[${name.trim()}]\n` };
}

export function iniFormat(dialect: IniDialect): TreeFormat {
	const comment = COMMENT[dialect];
	return {
		parse: (doc) => parseIni(doc, dialect),
		addSection: dialect === 'ini' ? insertSection : undefined,

		setValue(_doc, node, value) {
			if (node.kind === 'section' || !node.valueRange) return null;
			return { ...node.valueRange, insert: encodeValue(dialect, value.text) };
		},

		rename(_doc, node, key) {
			if (!node.keyRange || !node.can.rename) return null;
			if (node.kind === 'section') return key.trim() && !/[\]\n]/.test(key) ? { ...node.keyRange, insert: key.trim() } : null;
			const insert = encodeKey(dialect, key);
			return insert === null ? null : { ...node.keyRange, insert };
		},

		insert(doc, parent, index, child) {
			if (child.kind !== 'entry' || (parent.kind !== 'section' && parent.kind !== 'object')) return null;
			const key = encodeKey(dialect, child.key);
			if (key === null) return null;
			const root = parseIni(doc, dialect).root;
			const line = `${key}${separatorOf(doc, dialect, root)}${encodeValue(dialect, child.value.text)}`;
			const siblings = parent.children ?? [];
			const entries = siblings.filter((c) => c.kind !== 'section');
			const target = siblings[index];
			if (target && target.kind !== 'section') {
				return { from: lineStartOf(doc, target.range.from), insert: `${indentAt(doc, target.range.from)}${line}\n` };
			}
			const last = entries[entries.length - 1];
			if (last) return { from: lineEndOf(doc, last.range.to), insert: `\n${indentAt(doc, last.range.from)}${line}` };
			if (parent.kind === 'section') return { from: lineEndOf(doc, parent.range.from), insert: `\n${line}` };
			// Root without entries: before the first section (and the comments right above it)
			const first = siblings.find((c) => c.kind === 'section');
			if (!first) return { from: doc.length, insert: `${doc && !doc.endsWith('\n') ? '\n' : ''}${line}\n` };
			return { from: attachedStart(doc, first.range.from, comment), insert: `${line}\n\n` };
		},

		remove(doc, parent, node) {
			if (node.kind !== 'section') return removeLines(doc, node.range);
			const siblings = parent.children ?? [];
			const next = siblings[siblings.indexOf(node) + 1];
			return removeSection(doc, node.range.from, next ? next.range.from : doc.length, comment);
		},

		duplicate(doc, parent, node) {
			if (!node.can.duplicate || !node.keyRange) return null;
			const key = encodeKey(dialect, freeEntryKey(dialect, parent, node.key!));
			if (key === null) return null;
			const start = lineStartOf(doc, node.range.from);
			const end = lineEndOf(doc, node.range.to);
			return { from: end, insert: `\n${doc.slice(start, node.keyRange.from)}${key}${doc.slice(node.keyRange.to, end)}` };
		},

		move(doc, parent, node, delta) {
			const other = neighbour(parent, node, delta);
			return other && node.can.move ? swap(doc, node.range, other.range) : null;
		}
	};
}
