// Formatted text of text boxes, the same in every tool: paragraphs of spans, each span with what differs from the
// box's own style (bold, italic, underline, font, size, color); a paragraph may be an item of a list. Pure and
// unit-free like `text-box.ts`: the tool measures and draws. Positions in a text count its characters with one for
// each paragraph break – the positions of its plain text (`plainOf`).

export type FontFamily = 'sans' | 'serif' | 'mono';
export const FONT_FAMILIES: readonly FontFamily[] = ['sans', 'serif', 'mono'];

/** What a span may set; a key left out takes the box's own style */
export interface TextStyle {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	font?: FontFamily;
	/** Font size in the tool's unit */
	size?: number;
	/** `#rrggbb[aa]` */
	color?: string;
}

export interface Span extends TextStyle {
	text: string;
}

export type ListKind = 'bullet' | 'number';

export interface Paragraph {
	spans: Span[];
	list?: ListKind;
	/** Indented this many steps (lists: nested) */
	level?: number;
}

export type RichText = Paragraph[];

/** A style with every key set */
export type FullStyle = Required<TextStyle>;

/** Deepest level of a list */
export const MAX_LEVEL = 4;
/** Line heights to choose from (× font size); 1.2 is what a text box always had */
export const LINE_HEIGHTS: readonly number[] = [1, 1.2, 1.5, 2];
export const DEFAULT_LINE_HEIGHT = 1.2;

const STYLE_KEYS = ['bold', 'italic', 'underline', 'font', 'size', 'color'] as const;

/** A span's style alone, without what is false or missing */
export function styleOf(span: TextStyle): TextStyle {
	const out: TextStyle = {};
	for (const key of STYLE_KEYS) if (span[key] !== undefined && span[key] !== false) (out as Record<string, unknown>)[key] = span[key];
	return out;
}

const sameStyle = (a: TextStyle, b: TextStyle) => STYLE_KEYS.every((key) => (a[key] || undefined) === (b[key] || undefined));

/** The style a span shows in, on a box of style `base` */
export const fullStyle = (span: TextStyle, base: FullStyle): FullStyle => ({ ...base, ...styleOf(span) });

/** Plain text as formatted text: a paragraph per line */
export const richOf = (text: string): RichText => text.split('\n').map((line) => ({ spans: [{ text: line }] }));

/** The text without its formats (paragraphs as lines) */
export const plainOf = (rich: RichText): string => rich.map((p) => p.spans.map((s) => s.text).join('')).join('\n');

const lengthOfParagraph = (p: Paragraph) => p.spans.reduce((n, s) => n + s.text.length, 0);

/** No format anywhere: the text could be kept plain */
export const isPlain = (rich: RichText) => rich.every((p) => !p.list && !p.level && p.spans.every((s) => !Object.keys(styleOf(s)).length));

/** The same text tidied: equal neighbours joined, empty spans gone (an empty paragraph keeps one, with its style),
 * nothing false or missing kept */
export function tidy(rich: RichText): RichText {
	return rich.map((p) => {
		const spans: Span[] = [];
		const any = p.spans.some((s) => s.text);
		for (const s of p.spans) {
			// Of an empty paragraph the first span stays: its style is what typing there takes
			if (!s.text && (any || spans.length)) continue;
			const last = spans.at(-1);
			if (last && sameStyle(last, s)) last.text += s.text;
			else spans.push({ ...styleOf(s), text: s.text });
		}
		if (!spans.length) spans.push({ text: '' });
		const level = Math.min(MAX_LEVEL, Math.max(0, Math.round(p.level ?? 0)));
		return { spans, ...(p.list && { list: p.list }), ...(level > 0 && { level }) };
	});
}

/** Walks the spans with their positions in the plain text */
function mapSpans(rich: RichText, change: (span: Span, from: number, to: number) => Span[]): RichText {
	let at = 0;
	const out = rich.map((p) => {
		const spans = p.spans.flatMap((s) => {
			const from = at;
			at += s.text.length;
			return change(s, from, at);
		});
		// The paragraph break
		at++;
		return { ...p, spans };
	});
	return tidy(out);
}

/**
 * The text with `patch` set on the characters from `from` to `to` (a key with `undefined` or `false` goes back to the
 * box's own style)
 */
export function styleRange(rich: RichText, from: number, to: number, patch: TextStyle): RichText {
	if (to <= from) return rich;
	return mapSpans(rich, (s, a, b) => {
		if (b <= from || a >= to) return [s];
		const cut = (x: number) => Math.min(Math.max(x - a, 0), s.text.length);
		const [i, j] = [cut(from), cut(to)];
		return [
			{ ...s, text: s.text.slice(0, i) },
			{ ...s, ...patch, text: s.text.slice(i, j) },
			{ ...s, text: s.text.slice(j) }
		].filter((part, n) => part.text || (n === 1 && !s.text));
	});
}

/** The whole text with `patch` set (also on empty paragraphs, so what is typed there takes it) */
export const styleAll = (rich: RichText, patch: TextStyle): RichText => tidy(rich.map((p) => ({ ...p, spans: p.spans.map((s) => ({ ...s, ...patch })) })));

/** What the characters from `from` to `to` have in common, on a box of style `base`: a key they differ in is null.
 * With nothing between them: the style of the character before `from` (what typing there takes) */
export function rangeStyle(rich: RichText, from: number, to: number, base: FullStyle): { [K in keyof FullStyle]: FullStyle[K] | null } {
	const styles: FullStyle[] = [];
	let at = 0;
	let hit = false;
	for (const p of rich) {
		p.spans.forEach((s, k) => {
			const a = at;
			at += s.text.length;
			if (to > from) {
				if (s.text && at > from && a < to) styles.push(fullStyle(s, base));
			} else if (!hit && ((from > a && from <= at) || (from === a && k === 0))) {
				styles.push(fullStyle(s, base));
				hit = true;
			}
		});
		at++;
	}
	const first = styles[0] ?? base;
	const out = { ...first } as { [K in keyof FullStyle]: FullStyle[K] | null };
	for (const key of STYLE_KEYS) if (styles.some((s) => s[key] !== first[key])) out[key] = null;
	return out;
}

/** The paragraphs the characters from `from` to `to` lie in (first and last index) */
export function paragraphsIn(rich: RichText, from: number, to: number): [number, number] {
	let at = 0;
	let first = -1;
	let last = rich.length - 1;
	for (let i = 0; i < rich.length; i++) {
		const end = at + lengthOfParagraph(rich[i]);
		if (first < 0 && from <= end) first = i;
		if (to <= end) {
			last = i;
			break;
		}
		at = end + 1;
	}
	return [Math.max(0, first), Math.max(first, last)];
}

/** The paragraphs `first`…`last` as items of a list (null: plain paragraphs again); all already of that kind: plain */
export function withList(rich: RichText, first: number, last: number, kind: ListKind | null): RichText {
	const all = rich.slice(first, last + 1).every((p) => p.list === kind);
	return tidy(rich.map((p, i) => (i < first || i > last ? p : { ...p, list: kind && !all ? kind : undefined, ...(!(kind && !all) && { level: 0 }) })));
}

/** The paragraphs `first`…`last` one level deeper (`by` 1) or back (-1) */
export const withLevel = (rich: RichText, first: number, last: number, by: number): RichText =>
	tidy(rich.map((p, i) => (i < first || i > last ? p : { ...p, level: (p.level ?? 0) + by })));

/** `text` typed at `at` in the style `patch` over what stands there (the box's own without); for one line of text */
export function insertText(rich: RichText, at: number, text: string, patch: TextStyle): RichText {
	let done = false;
	const out = mapSpans(rich, (s, a, b) => {
		if (done || at < a || at > b) return [s];
		done = true;
		const i = at - a;
		return [
			{ ...s, text: s.text.slice(0, i) },
			{ ...s, ...patch, text },
			{ ...s, text: s.text.slice(i) }
		];
	});
	return out;
}

/** The text with every size of its own scaled (the box's font scales with it) */
export const scaleRich = (rich: RichText, k: number): RichText =>
	rich.map((p) => ({ ...p, spans: p.spans.map((s) => (s.size ? { ...s, size: Math.round(s.size * k * 100) / 100 } : s)) }));

// --- Lines ---

/** A piece of a line in one style, where it stands from the line's start */
export interface RichRun {
	x: number;
	width: number;
	text: string;
	style: FullStyle;
	/** A list's bullet or number (not part of the text) */
	marker?: true;
}

export interface RichLine {
	runs: RichRun[];
	/** From the start of the line's room to the end of its text (indent included) */
	width: number;
	/** Top of the line from the top of the text, its height, and its baseline from its top */
	y: number;
	height: number;
	baseline: number;
	/** Largest font size on it */
	size: number;
	/** Ends its paragraph */
	last: boolean;
	paragraph: number;
	/** The line's plain text */
	text: string;
}

/** Where the baseline lies in a line as high as the font needs (× font size), and that height – what a browser does
 * with the suite's text font, so a field typed into shows the text where it is drawn */
export const NATURAL_HEIGHT = 1.2;
export const ASCENT = 0.947;

/** Indent of one list level (× the box's font size) */
export const LIST_INDENT = 1.5;

export interface LayoutOptions {
	/** Room for a line; without it lines break only at paragraph ends */
	maxWidth?: number;
	/** Line height × font size */
	lineHeight?: number;
	align?: 'left' | 'center' | 'right' | 'justify';
	/** The style a character is shown in when its span's font can't show it (the tool knows its fonts) */
	fallback?: (char: string, style: FullStyle) => FullStyle;
}

interface Piece {
	text: string;
	style: FullStyle;
}

const sameFull = (a: FullStyle, b: FullStyle) => STYLE_KEYS.every((key) => a[key] === b[key]);

/** A list item's number among its neighbours of the same level */
function numberOf(rich: RichText, index: number): number {
	const level = rich[index].level ?? 0;
	let n = 1;
	for (let i = index - 1; i >= 0; i--) {
		const p = rich[i];
		const l = p.level ?? 0;
		if (l < level || (l === level && p.list !== 'number')) break;
		if (l === level) n++;
	}
	return n;
}

/** The mark before a list item */
export const markerOf = (rich: RichText, index: number): string => (rich[index].list === 'number' ? `${numberOf(rich, index)}.` : rich[index].list === 'bullet' ? '•' : '');

/**
 * Breaks formatted text into lines like `wrapText` does plain text: at paragraph ends; with `maxWidth` between words
 * (spaces stay with the word before, trailing ones don't count), a word too long on its own between characters. Each
 * line is as high as its largest font needs; runs stand where the alignment puts them in a room of `maxWidth` (or of
 * the widest line without it).
 */
export function layoutRich(rich: RichText, base: FullStyle, measure: (text: string, style: FullStyle) => number, options: LayoutOptions = {}): RichLine[] {
	const { maxWidth, fallback } = options;
	const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
	const lines: (Omit<RichLine, 'y' | 'runs'> & { pieces: Piece[]; indent: number; marker?: Piece })[] = [];
	rich.forEach((p, index) => {
		const first = fullStyle(p.spans[0] ?? {}, base);
		const markerText = markerOf(rich, index);
		const markerStyle: FullStyle = { ...first, underline: false, italic: false };
		const indent = ((p.level ?? 0) + (p.list ? 1 : 0)) * LIST_INDENT * base.size;
		const room = maxWidth === undefined ? undefined : Math.max(base.size, maxWidth - indent);
		// Pieces of one style, cut where a character needs another font
		const pieces: Piece[] = [];
		for (const span of p.spans) {
			const style = fullStyle(span, base);
			let text = '';
			let current = style;
			for (const char of span.text) {
				const shown = fallback ? fallback(char, style) : style;
				if (text && !sameFull(shown, current)) {
					pieces.push({ text, style: current });
					text = '';
				}
				current = shown;
				text += char;
			}
			if (text) pieces.push({ text, style: current });
		}
		// Words: pieces up to and with the spaces after them
		const words: Piece[][] = [[]];
		for (const piece of pieces) {
			for (const part of piece.text.split(/(?<= )/)) {
				words.at(-1)!.push({ text: part, style: piece.style });
				if (part.endsWith(' ')) words.push([]);
			}
		}
		const widthOf = (list: readonly Piece[], trimmed: boolean) =>
			list.reduce((w, piece, i) => w + measure(trimmed && i === list.length - 1 ? piece.text.trimEnd() : piece.text, piece.style), 0);
		let line: Piece[] = [];
		const flush = (last: boolean) => {
			// Trailing spaces don't count
			while (line.length && !line.at(-1)!.text.trimEnd() && line.length > 1) line.pop();
			if (line.length) line[line.length - 1] = { ...line.at(-1)!, text: line.at(-1)!.text.trimEnd() };
			const shown = line.filter((piece) => piece.text);
			const size = shown.length ? Math.max(...shown.map((piece) => piece.style.size)) : first.size;
			const isFirst = !lines.length || lines.at(-1)!.paragraph !== index;
			lines.push({
				pieces: shown,
				indent,
				...(isFirst && markerText && { marker: { text: markerText, style: markerStyle } }),
				width: 0,
				height: size * lineHeight,
				baseline: ((lineHeight - NATURAL_HEIGHT) / 2 + ASCENT) * size,
				size,
				last,
				paragraph: index,
				text: shown.map((piece) => piece.text).join('')
			});
			line = [];
		};
		for (const word of words) {
			if (!word.length) continue;
			if (room === undefined || widthOf([...line, ...word], true) <= room) {
				line.push(...word);
				continue;
			}
			if (line.length) flush(false);
			// A word wider than the room: cut between characters, at least one per line
			let rest = word;
			while (widthOf(rest, true) > room && rest.reduce((n, piece) => n + piece.text.length, 0) > 1) {
				const taken: Piece[] = [];
				let count = 0;
				outer: for (const piece of rest) {
					let text = '';
					for (const char of piece.text) {
						if (count > 0 && widthOf([...taken, { text: text + char, style: piece.style }], false) > room) {
							if (text) taken.push({ text, style: piece.style });
							break outer;
						}
						text += char;
						count++;
					}
					taken.push({ text, style: piece.style });
				}
				line = taken;
				flush(false);
				// What is left of the word
				let skip = count;
				rest = rest.flatMap((piece) => {
					const cut = Math.min(skip, piece.text.length);
					skip -= cut;
					return cut < piece.text.length ? [{ text: piece.text.slice(cut), style: piece.style }] : [];
				});
			}
			line = rest;
		}
		flush(true);
	});

	// Runs: pieces of one style joined, placed by the alignment
	const joined = lines.map((l) => {
		const runs: { text: string; style: FullStyle }[] = [];
		for (const piece of l.pieces) {
			const last = runs.at(-1);
			if (last && sameFull(last.style, piece.style)) last.text += piece.text;
			else runs.push({ ...piece });
		}
		const widths = runs.map((run) => measure(run.text, run.style));
		return { ...l, runs, widths, textWidth: widths.reduce((a, b) => a + b, 0) };
	});
	const room = maxWidth ?? Math.max(0, ...joined.map((l) => l.indent + l.textWidth));
	const align = options.align ?? 'left';
	let y = 0;
	return joined.map((l) => {
		const free = Math.max(0, room - l.indent - l.textWidth);
		const runs: RichRun[] = [];
		const justify = align === 'justify' && !l.last && l.runs.some((run) => run.text.includes(' '));
		let x = l.indent + (align === 'center' ? free / 2 : align === 'right' ? free : 0);
		if (l.marker) {
			const width = measure(l.marker.text, l.marker.style);
			runs.push({ x: l.indent - width - 0.3 * base.size, width, text: l.marker.text, style: l.marker.style, marker: true });
		}
		if (justify) {
			// Word by word, the free room shared among the gaps
			const gaps = l.runs.reduce((n, run) => n + (run.text.match(/ +/g)?.length ?? 0), 0);
			const extra = free / gaps;
			for (const run of l.runs) {
				for (const word of run.text.split(/(?<= )(?! )/)) {
					const width = measure(word, run.style);
					runs.push({ x, width, text: word, style: run.style });
					x += width + (word.endsWith(' ') ? extra : 0);
				}
			}
		} else {
			l.runs.forEach((run, i) => {
				runs.push({ x, width: l.widths[i], text: run.text, style: run.style });
				x += l.widths[i];
			});
		}
		const top = y;
		y += l.height;
		return { runs, width: l.indent + l.textWidth, y: top, height: l.height, baseline: l.baseline, size: l.size, last: l.last, paragraph: l.paragraph, text: l.text };
	});
}

/** Height of all lines */
export const linesHeight = (lines: readonly RichLine[]) => (lines.length ? lines.at(-1)!.y + lines.at(-1)!.height : 0);
