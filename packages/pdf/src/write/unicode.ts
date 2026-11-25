// Text beyond WinAnsi in appearances (ł, ő, Greek, Cyrillic …): tools write it with `unicodeText()` in a font named
// `UNICODE_FONT` (`fonts: { [name]: UNICODE_FONT }`); `IncrementalPdf.update` embeds Liberation Sans – Helvetica's
// metrics, the font the tools measure their text with – as a subset of just those characters (pdf-lib + fontkit,
// loaded only then) and puts the glyphs in. Characters the font lacks (CJK, emoji …) become `?` there; `/Contents`
// keeps the text as it is. A tool's own font files (a user's fonts) are embedded the same way (`embeddedFont`).

import type { PDFDocument } from 'pdf-lib';
import { standardFontUrl } from '../pdfjs.js';
import { pdfLib } from '../pdf-lib.js';

/** Stands for the embedded Liberation Sans in `appearance.fonts` */
export const UNICODE_FONT = 'Unicode';

/** Other fonts a tool embeds (a user's font file): key → its bytes, read when an update needs them */
const embeddable = new Map<string, () => Promise<ArrayBuffer | Uint8Array>>();

/**
 * Registers a font file to embed (a subset of the characters used, like Liberation Sans): its key stands for it in
 * `appearance.fonts`, `unicodeText(text, key)` writes text in it. The same `id` gives the same key.
 */
export function embeddedFont(id: string, bytes: () => Promise<ArrayBuffer | Uint8Array>): string {
	for (const [key, entry] of keyOf) if (entry === id) return key;
	const key = `Font${keyOf.size + 1}`;
	keyOf.set(key, id);
	embeddable.set(key, bytes);
	return key;
}
const keyOf = new Map<string, string>();

/** A text shown in an embedded font (a placeholder in the content stream, replaced when it is written); `font`: its key
 * (`embeddedFont`), else Liberation Sans */
export function unicodeText(text: string, font = UNICODE_FONT): string {
	let hex = '';
	for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
	return font === UNICODE_FONT ? `<U:${hex}>` : `<${font}:${hex}>`;
}

export const UNICODE_TEXT = /<(U|Font\d+):([0-9A-F]*)>/g;

function decode(hex: string): string {
	let out = '';
	for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
	return out;
}

/** The subset font of one update: its objects (as pdf-lib made them, numbered in `doc`), the font's object number and
 * the glyphs of each placeholder (`<…>` hex strings) */
export interface UnicodeFont {
	doc: PDFDocument;
	numbers: number[];
	font: number;
	glyphs: Map<string, string>;
}

let fontBytes: Promise<ArrayBuffer> | null = null;

function liberationSans(): Promise<ArrayBuffer> {
	fontBytes ??= (async () => {
		const url = standardFontUrl('LiberationSans-Regular.ttf');
		if (!url) throw new Error('Liberation Sans is missing');
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Liberation Sans not loaded (${response.status})`);
		return response.arrayBuffer();
	})().catch((e: unknown) => {
		fontBytes = null;
		throw e;
	});
	return fontBytes;
}

/** Embeds the subset of one font holding the placeholders' characters (their hex as written by `unicodeText`) */
export async function unicodeFont(placeholders: Iterable<string>, font = UNICODE_FONT): Promise<UnicodeFont> {
	const [{ PDFDocument }, fontkit] = await Promise.all([pdfLib(), import('@pdf-lib/fontkit').then((m) => m.default)]);
	const source = font === UNICODE_FONT ? await liberationSans() : await embeddable.get(font)?.();
	if (!source) throw new Error(`font ${font} is not registered`);
	const doc = await PDFDocument.create();
	doc.registerFontkit(fontkit);
	const before = doc.context.largestObjectNumber;
	const embedded = await doc.embedFont(source instanceof Uint8Array ? source : new Uint8Array(source), { subset: true });
	const has = (embedded as unknown as { embedder: { font: { hasGlyphForCodePoint(c: number): boolean } } }).embedder.font;
	const glyphs = new Map<string, string>();
	for (const hex of placeholders) {
		if (glyphs.has(hex)) continue;
		let text = '';
		for (const char of decode(hex)) text += has.hasGlyphForCodePoint(char.codePointAt(0) ?? 0) ? char : '?';
		glyphs.set(hex, embedded.encodeText(text).toString());
	}
	await doc.flush();
	const numbers = doc.context
		.enumerateIndirectObjects()
		.map(([ref]) => ref.objectNumber)
		.filter((n) => n > before);
	return { doc, numbers, font: embedded.ref.objectNumber, glyphs };
}

/** The placeholders in a content stream: the font's key and the text's hex */
export const placeholdersOf = (content: string): { font: string; hex: string }[] =>
	[...content.matchAll(UNICODE_TEXT)].map((m) => ({ font: m[1] === 'U' ? UNICODE_FONT : m[1], hex: m[2] }));
