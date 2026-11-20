// The text of PDF pages for searching: one string per page with where each run of text lies (page points, origin top
// left, rotation applied), and the hits of a search with the words around them and their boxes on the page.

/** A run of text of a page: its characters `start`…`end` in `PageText.str`, its box in page points */
export interface TextRun {
	start: number;
	end: number;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	/** Reading direction on the page as shown, in degrees clockwise (the page's rotation); 0 when left to right */
	dir?: number;
	/** The font's ascent and descent (× the box's height across its lines, descent below 0), when PDF.js knows them */
	ascent?: number;
	descent?: number;
}

export interface PageText {
	str: string;
	runs: TextRun[];
}

/** A text item as PDF.js gives it (`getTextContent`) */
export interface RawTextItem {
	str: string;
	/** [a, b, c, d, e, f] in PDF space */
	transform: number[];
	width: number;
	height: number;
	hasEOL?: boolean;
	fontName?: string;
}

/** Font metrics of a page's text by font name (`getTextContent().styles`) */
export type TextStyles = Readonly<Record<string, { ascent: number; descent: number }>>;

/** PDF space → page points: two corners of a box (x0, y0, x1, y1), each turned by the page's viewport */
export type ToPage = (rect: [number, number, number, number]) => number[];

/** Joins a page's text items into one searchable string (line ends and gaps become spaces) */
export function pageText(items: readonly RawTextItem[], toPage: ToPage, rotate = 0, styles: TextStyles = {}): PageText {
	const dir = (((rotate % 360) + 360) % 360) || undefined;
	let str = '';
	const runs: TextRun[] = [];
	for (const item of items) {
		if (!item.str) {
			if (item.hasEOL && str && !str.endsWith(' ')) str += ' ';
			continue;
		}
		const [, , , , e, f] = item.transform;
		const h = item.height || Math.hypot(item.transform[2], item.transform[3]);
		const [ax, ay, bx, by] = toPage([e, f, e + item.width, f + h]);
		const start = str.length;
		str += item.str;
		// Metrics only when they make sense (some fonts report none)
		const style = item.fontName ? styles[item.fontName] : undefined;
		const metrics = style && style.ascent > 0.3 && style.ascent < 1.5 && style.descent <= 0 && style.descent > -1 ? { ascent: style.ascent, descent: style.descent } : {};
		runs.push({ start, end: str.length, x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by), ...(dir && { dir }), ...metrics });
		if (item.hasEOL && !str.endsWith(' ')) str += ' ';
	}
	return { str, runs };
}

export interface SearchHit {
	/** Page index */
	page: number;
	start: number;
	end: number;
	/** Boxes of the hit on its page (one per run it covers; with its run's font metrics) */
	boxes: { x0: number; y0: number; x1: number; y1: number; ascent?: number; descent?: number }[];
	/** Words around the hit for the list */
	before: string;
	match: string;
	after: string;
}

/** Characters of context on each side of a hit */
const CONTEXT = 32;

/** All hits of `query` in the pages, in reading order. Whitespace in the query matches any run of whitespace. */
export function findAll(pages: readonly PageText[], query: string, matchCase = false): SearchHit[] {
	const words = query.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	const pattern = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), matchCase ? 'g' : 'gi');
	const hits: SearchHit[] = [];
	pages.forEach((text, page) => {
		for (const found of text.str.matchAll(pattern)) {
			const start = found.index;
			const end = start + found[0].length;
			hits.push({
				page,
				start,
				end,
				boxes: boxesOf(text.runs, start, end),
				before: (start > CONTEXT ? '…' : '') + text.str.slice(Math.max(0, start - CONTEXT), start).trimStart(),
				match: found[0],
				after: text.str.slice(end, end + CONTEXT).trimEnd() + (end + CONTEXT < text.str.length ? '…' : '')
			});
		}
	});
	return hits;
}

/**
 * The parts of runs that characters `start`…`end` cover. Characters are taken as equally wide within a run, unless
 * `text` measures them (`measure` gives a string's width in any unit – a font like the PDF's, so a cut inside a run
 * lies between the right letters).
 */
export function boxesOf(runs: readonly TextRun[], start: number, end: number, text?: { str: string; measure: (s: string) => number }): SearchHit['boxes'] {
	const boxes: SearchHit['boxes'] = [];
	for (const run of runs) {
		if (run.end <= start || run.start >= end) continue;
		const n = run.end - run.start;
		let from = (Math.max(start, run.start) - run.start) / n;
		let to = (Math.min(end, run.end) - run.start) / n;
		if (text && (from > 0 || to < 1)) {
			const s = text.str.slice(run.start, run.end);
			const whole = text.measure(s);
			if (whole > 0) {
				from = text.measure(s.slice(0, Math.max(start, run.start) - run.start)) / whole;
				to = text.measure(s.slice(0, Math.min(end, run.end) - run.start)) / whole;
			}
		}
		const metrics = run.ascent === undefined ? {} : { ascent: run.ascent, descent: run.descent };
		const w = run.x1 - run.x0;
		const h = run.y1 - run.y0;
		if (run.dir === 90) boxes.push({ ...metrics, x0: run.x0, y0: run.y0 + h * from, x1: run.x1, y1: run.y0 + h * to });
		else if (run.dir === 180) boxes.push({ ...metrics, x0: run.x1 - w * to, y0: run.y0, x1: run.x1 - w * from, y1: run.y1 });
		else if (run.dir === 270) boxes.push({ ...metrics, x0: run.x0, y0: run.y1 - h * to, x1: run.x1, y1: run.y1 - h * from });
		else boxes.push({ ...metrics, x0: run.x0 + w * from, y0: run.y0, x1: run.x0 + w * to, y1: run.y1 });
	}
	return boxes;
}

/**
 * The position between two characters nearest to a point of the page (page points as shown): where a text selection
 * by dragging starts or ends. Prefers the run under the point, else the nearest one; null without text. `measure`:
 * letters by their widths (as in `boxesOf`), else equally wide.
 */
export function positionAt(text: PageText, x: number, y: number, measure?: (s: string) => number): number | null {
	let best: TextRun | null = null;
	let bestDist = Infinity;
	for (const run of text.runs) {
		// Distance to the box; within the line's height counts as on it (so a point between words picks that line)
		const dx = Math.max(run.x0 - x, 0, x - run.x1);
		const dy = Math.max(run.y0 - y, 0, y - run.y1);
		const across = run.dir === 90 || run.dir === 270 ? dx : dy;
		const along = run.dir === 90 || run.dir === 270 ? dy : dx;
		const dist = across * 4 + along;
		if (dist < bestDist) {
			bestDist = dist;
			best = run;
		}
	}
	if (!best) return null;
	const n = best.end - best.start;
	const w = best.x1 - best.x0;
	const h = best.y1 - best.y0;
	const clamp = (v: number) => Math.min(1, Math.max(0, v));
	const t =
		best.dir === 90
			? clamp((y - best.y0) / h)
			: best.dir === 180
				? clamp((best.x1 - x) / w)
				: best.dir === 270
					? clamp((best.y1 - y) / h)
					: clamp((x - best.x0) / w);
	if (measure) {
		// The boundary between letters nearest to the point, by their widths
		const s = text.str.slice(best.start, best.end);
		const whole = measure(s);
		if (whole > 0) {
			let k = 0;
			let gap = Infinity;
			for (let i = 0; i <= n; i++) {
				const d = Math.abs(measure(s.slice(0, i)) / whole - t);
				if (d < gap) [gap, k] = [d, i];
			}
			return best.start + k;
		}
	}
	return best.start + Math.round(t * n);
}
