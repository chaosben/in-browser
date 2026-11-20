// Text beyond WinAnsi in appearances (ł, ő, Greek, Cyrillic …): tools write it with `unicodeText()` in a font named
// `UNICODE_FONT` (`fonts: { [name]: UNICODE_FONT }`); `IncrementalPdf.update` embeds Liberation Sans – Helvetica's
// metrics, the font the tools measure their text with – as a subset of just those characters (pdf-lib + fontkit,
// loaded only then) and puts the glyphs in. Characters the font lacks (CJK, emoji …) become `?` there; `/Contents`
// keeps the text as it is.

import type { PDFDocument } from 'pdf-lib';
import { standardFontUrl } from '../pdfjs.js';
import { pdfLib } from '../pdf-lib.js';

/** Stands for the embedded font in `appearance.fonts` */
export const UNICODE_FONT = 'Unicode';

/** A text shown in the embedded font (a placeholder in the content stream, replaced when it is written) */
export function unicodeText(text: string): string {
	let hex = '';
	for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
	return `<U:${hex}>`;
}

export const UNICODE_TEXT = /<U:([0-9A-F]*)>/g;

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

/** Embeds the subset holding the placeholders' characters (their hex as written by `unicodeText`) */
export async function unicodeFont(placeholders: Iterable<string>): Promise<UnicodeFont> {
	const [{ PDFDocument }, fontkit] = await Promise.all([pdfLib(), import('@pdf-lib/fontkit').then((m) => m.default)]);
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
	const doc = await PDFDocument.create();
	doc.registerFontkit(fontkit);
	const before = doc.context.largestObjectNumber;
	const font = await doc.embedFont(await fontBytes, { subset: true });
	const has = (font as unknown as { embedder: { font: { hasGlyphForCodePoint(c: number): boolean } } }).embedder.font;
	const glyphs = new Map<string, string>();
	for (const hex of placeholders) {
		if (glyphs.has(hex)) continue;
		let text = '';
		for (const char of decode(hex)) text += has.hasGlyphForCodePoint(char.codePointAt(0) ?? 0) ? char : '?';
		glyphs.set(hex, font.encodeText(text).toString());
	}
	await doc.flush();
	const numbers = doc.context
		.enumerateIndirectObjects()
		.map(([ref]) => ref.objectNumber)
		.filter((n) => n > before);
	return { doc, numbers, font: font.ref.objectNumber, glyphs };
}

/** The placeholders in a content stream */
export const placeholdersOf = (content: string): string[] => [...content.matchAll(UNICODE_TEXT)].map((m) => m[1]);
