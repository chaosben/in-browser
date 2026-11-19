import type { ChangeSpec } from '@codemirror/state';
import { indentAt, lineEndOf, lineStartOf, type Range, type TreeNode } from './model.js';

// Text edits shared by the formats: entries in bracketed containers (JSON, flow YAML, TOML inline tables) and whole
// lines and sections (TOML, the INI family).

/** One step of indentation as used in the text (default two spaces); `pattern` finds an indented line */
export function indentUnit(doc: string, pattern = /\n([ \t]+)\S/): string {
	const match = pattern.exec(doc);
	if (!match) return '  ';
	return match[1].startsWith('\t') ? '\t' : match[1];
}

// --- Entries of a container ---

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

// --- Whole lines and sections ---

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
