// Marked text (highlight, underline, strike out) as items on a page, next to the ink core's strokes and shapes: the
// boxes of the characters it covers (page points as shown) with a color – saved as `/Highlight`, `/Underline` and
// `/StrikeOut` annotations. `pdfKit` draws, hits and moves both kinds; the ink core's selection, eraser and undo work
// on them unchanged.

import type { Box } from '@in-browser/ink/geometry.js';
import { isInk, type Ink, type Item } from '@in-browser/ink/items.js';
import { pointInPolygon, rotateItem, type Transform } from '@in-browser/ink/lasso.js';
import { inkKit } from '@in-browser/ink/render/ink-kit.js';
import type { ItemKit } from '@in-browser/ink/render/kit.js';
import type { MarkKind } from '@in-browser/pdf/text-layer.js';
import { drawNote, isNote, noteBounds, NOTE_SIZE, type NoteItem } from './note.js';
import { drawText, isText, moveTextHandle, textBounds, textHandles, withText, type TextItem } from './textbox.js';

export type { MarkKind };

export interface MarkupItem {
	id: string;
	type: 'markup';
	kind: MarkKind;
	/** `#rrggbbaa`: see-through, so the text stays readable */
	color: string;
	/** Boxes of the marked characters, one per run of text */
	boxes: Box[];
	/** Reading direction on the page as shown (degrees clockwise; 0 = left to right): where "below" the text is */
	dir: number;
	/** The marked text (the annotation's contents, so viewers list it) */
	text: string;
}

/** What lies on the pages of a PDF in the editor */
export type PdfItem = Item | MarkupItem | NoteItem | TextItem;

export const isMarkup = (item: { readonly id: string }): item is MarkupItem => (item as MarkupItem).type === 'markup';

/** Bounds of what is drawn: the boxes, or the lines of an underline or strike out */
export function markupBounds(item: MarkupItem): Box {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (const b of item.boxes) {
		x0 = Math.min(x0, b.x0);
		y0 = Math.min(y0, b.y0);
		x1 = Math.max(x1, b.x1);
		y1 = Math.max(y1, b.y1);
		if (item.kind === 'underline') {
			const { line, width } = markLine(item.kind, b, item.dir);
			const half = width / 2;
			x0 = Math.min(x0, line[0] - half, line[2] - half);
			y0 = Math.min(y0, line[1] - half, line[3] - half);
			x1 = Math.max(x1, line[0] + half, line[2] + half);
			y1 = Math.max(y1, line[1] + half, line[3] + half);
		}
	}
	return { x0, y0, x1, y1 };
}

/** Where a strike out lies in a text box, from its top (the box is the baseline up by the font size) */
export const STRIKE_AT = 0.7;
/** Where an underline lies, from the box's top (below the baseline) */
export const UNDERLINE_AT = 1.07;

/** The line of an underline or strike out in a box, as [x0, y0, x1, y1] and its width (along the reading direction) */
export function markLine(kind: MarkKind, b: Box, dir: number): { line: [number, number, number, number]; width: number } {
	const vertical = dir === 90 || dir === 270;
	const across = vertical ? b.x1 - b.x0 : b.y1 - b.y0;
	const width = Math.max(0.5, across * 0.07);
	// Distance of the line from the box's "top" edge in reading direction. The box reaches from the baseline up by the
	// font size, so a strike out goes through the middle of lower-case letters (0.3 em above the baseline), an
	// underline lies just below the baseline (and so a little outside the box – `markupBounds` covers it)
	const at = across * (kind === 'strikeout' ? STRIKE_AT : UNDERLINE_AT);
	if (dir === 90) return { line: [b.x1 - at, b.y0, b.x1 - at, b.y1], width };
	if (dir === 180) return { line: [b.x0, b.y1 - at, b.x1, b.y1 - at], width };
	if (dir === 270) return { line: [b.x0 + at, b.y0, b.x0 + at, b.y1], width };
	return { line: [b.x0, b.y0 + at, b.x1, b.y0 + at], width };
}

const inBox = (b: Box, x: number, y: number, r: number) => x >= b.x0 - r && x <= b.x1 + r && y >= b.y0 - r && y <= b.y1 + r;

/** The item turned with its page by quarter turns (see `rotateItem`) */
export function rotatePdfItem(item: PdfItem, quarters: number, w: number, h: number): PdfItem {
	if (!isMarkup(item) && !isNote(item) && !isText(item)) return rotateItem(item, quarters, w, h);
	const q = ((quarters % 4) + 4) % 4;
	if (!q) return item;
	const turn = (x: number, y: number): [number, number] => (q === 1 ? [h - y, x] : q === 2 ? [w - x, h - y] : [y, w - x]);
	if (isText(item)) {
		// The box turns, the text with it
		const [ax, ay] = turn(item.x, item.y);
		const [bx, by] = turn(item.x + item.w, item.y + item.h);
		return { ...item, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), rot: (item.rot + q * 90) % 360 };
	}
	if (isNote(item)) {
		// The bubble stays upright: its box turns, it takes the box's top left corner
		const [ax, ay] = turn(item.x, item.y);
		const [bx, by] = turn(item.x + NOTE_SIZE, item.y + NOTE_SIZE);
		return { ...item, x: Math.min(ax, bx), y: Math.min(ay, by) };
	}
	const boxes = item.boxes.map((b) => {
		const [ax, ay] = turn(b.x0, b.y0);
		const [bx, by] = turn(b.x1, b.y1);
		return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
	});
	return { ...item, boxes, dir: (item.dir + q * 90) % 360 };
}

function transformMarkup(item: MarkupItem, t: Transform): MarkupItem {
	const tx = (x: number) => t.ox + (x - t.ox) * t.scale + t.dx;
	const ty = (y: number) => t.oy + (y - t.oy) * t.scale + t.dy;
	return { ...item, boxes: item.boxes.map((b) => ({ x0: tx(b.x0), y0: ty(b.y0), x1: tx(b.x1), y1: ty(b.y1) })) };
}

function transformNote(item: NoteItem, t: Transform): NoteItem {
	// Moved with the others, never scaled: its middle goes where theirs go
	const half = NOTE_SIZE / 2;
	return { ...item, x: t.ox + (item.x + half - t.ox) * t.scale + t.dx - half, y: t.oy + (item.y + half - t.oy) * t.scale + t.dy - half };
}

function transformText(item: TextItem, t: Transform): TextItem {
	const x = t.ox + (item.x - t.ox) * t.scale + t.dx;
	const y = t.oy + (item.y - t.oy) * t.scale + t.dy;
	if (t.scale === 1) return { ...item, x, y };
	// Scaled with its font (its lines stay as they are) only with K; otherwise only its box, now of fixed size
	if (!t.scaleText) return withText({ ...item, x, y, w: item.w * t.scale, h: item.h * t.scale, sizing: 'fixed' }, item.text);
	const round = (v: number) => Math.round(v * t.scale * 100) / 100;
	return { ...item, x, y, w: item.w * t.scale, h: item.h * t.scale, size: round(item.size), ...(item.borderWidth ? { borderWidth: round(item.borderWidth) } : {}) };
}

/** The editor's own items (the ink core's are strokes, shapes and pictures) */
type Own = MarkupItem | NoteItem | TextItem;
const isOwn = (item: PdfItem): item is Own => isMarkup(item) || isNote(item) || isText(item);
const ownBounds = (item: Own): Box => (isMarkup(item) ? markupBounds(item) : isNote(item) ? noteBounds(item) : textBounds(item));
const ownHit = (item: Own, x: number, y: number, r: number) => (isMarkup(item) ? item.boxes.some((b) => inBox(b, x, y, r)) : inBox(ownBounds(item), x, y, r));

/** The text box being typed into: its editor shows it instead (it would show through a see-through one) */
export const typing = { id: '' };

/** Strokes and shapes as the ink core draws them, marked text as boxes or lines in its color, notes as bubbles, text
 * boxes as their lines */
export const pdfKit: ItemKit<PdfItem> = {
	bounds: (item) => (isOwn(item) ? ownBounds(item) : inkKit.bounds(item)),
	draw(ctx, item, cx) {
		if (isNote(item)) return drawNote(ctx, item);
		if (isText(item)) return item.id === typing.id ? undefined : drawText(ctx, item);
		if (!isMarkup(item)) return inkKit.draw(ctx, item, cx as Parameters<typeof inkKit.draw>[2]);
		ctx.fillStyle = item.color;
		ctx.strokeStyle = item.color;
		if (item.kind === 'highlight') {
			// Multiply: the text below stays readable (the same in the saved appearance)
			ctx.globalCompositeOperation = 'multiply';
			for (const b of item.boxes) ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
			ctx.globalCompositeOperation = 'source-over';
			return;
		}
		for (const b of item.boxes) {
			const { line, width } = markLine(item.kind, b, item.dir);
			ctx.lineWidth = width;
			ctx.beginPath();
			ctx.moveTo(line[0], line[1]);
			ctx.lineTo(line[2], line[3]);
			ctx.stroke();
		}
	},
	hit: (item, x, y, r) => (isOwn(item) ? ownHit(item, x, y, r) : inkKit.hit(item, x, y, r)),
	erases: (item, x, y, r) => (isOwn(item) ? ownHit(item, x, y, r) : inkKit.erases(item, x, y, r)),
	inLasso(item, poly) {
		if (!isOwn(item)) return inkKit.inLasso(item, poly);
		const b = ownBounds(item);
		return pointInPolygon((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, poly);
	},
	snapBox(item) {
		if (!isOwn(item)) return inkKit.snapBox(item);
		if (isText(item)) return { x: item.x, y: item.y, w: item.w, h: item.h };
		const b = ownBounds(item);
		return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
	},
	targets: (items, exclude, w, h) => inkKit.targets(items.filter((i): i is Item => !isOwn(i)), exclude, w, h),
	// Only ink items are snapped to (`targets`)
	mark: (item) => inkKit.mark!(item as Item),
	color: (item) => (isOwn(item) ? item.color : inkKit.color(item)),
	transform: (item, t) =>
		isMarkup(item) ? transformMarkup(item, t) : isNote(item) ? transformNote(item, t) : isText(item) ? transformText(item, t) : inkKit.transform(item, t),
	// Marked text belongs to its text: it never moves away from it
	fixed: isMarkup,
	// A text box's corners and sides change its box (its font only with K); a shape's points
	handles: (item) => (isText(item) ? textHandles(item) : isOwn(item) ? null : (inkKit.handles?.(item) ?? null)),
	moveHandle: (item, index, x, y, o) => (isText(item) ? moveTextHandle(item, index, x, y, o) : isOwn(item) ? item : inkKit.moveHandle!(item, index, x, y, o)),
	ownScale: isText
};

/** Ink, marked text, notes and text boxes: everything the editor writes as annotations (pictures aren't yet) */
export type Annotatable = Ink | Own;

export const isAnnotatable = (item: PdfItem): item is Annotatable => isOwn(item) || isInk(item);
