// Marked text (highlight, underline, wavy underline, strike out) as items on a page, next to the ink core's strokes
// and shapes: the boxes of the characters it covers (page points as shown) with a color – saved as `/Highlight`,
// `/Underline`, `/Squiggly` and `/StrikeOut` annotations. A highlighted area is a highlight with one box drawn by hand. `pdfKit` draws, hits and moves both kinds; the ink core's selection, eraser and undo work
// on them unchanged.

import { scaleRich } from '@in-browser/graphics/rich-text.js';
import type { Box } from '@in-browser/ink/geometry.js';
import { isInk, isShape, type Ink, type Item } from '@in-browser/ink/items.js';
import { pointInPolygon, rotateItem, type Transform } from '@in-browser/ink/lasso.js';
import { inkKit } from '@in-browser/ink/render/ink-kit.js';
import type { Ctx, ItemKit, ItemMark } from '@in-browser/ink/render/kit.js';
import { snapTargets } from '@in-browser/graphics/snap.js';
import { m } from '#lib/i18n/index.js';
import type { MarkKind } from '@in-browser/pdf/text-layer.js';
import { drawNote, isNote, noteBounds, NOTE_SIZE, type NoteItem } from './note.js';
import { caretBounds, drawCaret, isCaret, markBounds, type CaretItem } from './caret.js';
import { drawLink, isLink, linkBounds, linkView, type LinkItem } from './link.js';
import { drawMeasure, isMeasured, labelBox } from './measure.js';

const unionBox = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
import { drawStamp, isStamp, recolorIcon, stampBounds, type StampItem } from './stamp.js';
import { drawStepMark, flipsOf, stepLabel, stepView, withFlips } from './steps.js';
import { drawCallout, drawText, hitsText, isText, itemBounds, moveTextHandle, paddingOf, roundInsets, textHandles, withText, type TextItem } from './textbox.js';
import { scaleInsets } from '@in-browser/graphics/text-box.js';

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
	/** A highlighted area: its box was drawn, not taken from text – so it can be moved and scaled */
	area?: true;
}

/** What lies on the pages of a PDF in the editor */
export type PdfItem = Item | MarkupItem | NoteItem | TextItem | StampItem | CaretItem | LinkItem;

/** Items carrying a comment written in the field below them: sticky notes and insertion marks */
export const isCommented = (item: { readonly id: string }): item is NoteItem | CaretItem => isNote(item) || isCaret(item);

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
		if (item.kind === 'underline' || item.kind === 'squiggly') {
			const { line, width } = markLine(item.kind, b, item.dir);
			const half = item.kind === 'squiggly' ? width * (0.5 + WAVE) : width / 2;
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

/** How far a wavy underline swings to each side of its line (× the line's width) */
const WAVE = 1.5;

/** The points of a wavy underline in a box (x, y, …): a zigzag around the underline's place, starting and ending on it */
export function squiggle(b: Box, dir: number): { points: number[]; width: number } {
	const { line, width: full } = markLine('squiggly', b, dir);
	const width = full * 0.7;
	const [x0, y0, x1, y1] = line;
	const length = Math.hypot(x1 - x0, y1 - y0);
	if (!length) return { points: [x0, y0, x1, y1], width };
	const swing = full * WAVE;
	// An even number of swings, each as long as it is high
	const n = Math.max(2, Math.round(length / (swing * 2) / 2) * 2);
	const [nx, ny] = [-(y1 - y0) / length, (x1 - x0) / length];
	const points: number[] = [];
	for (let i = 0; i <= n; i++) {
		const side = i === 0 || i === n ? 0 : i % 2 ? swing : -swing;
		points.push(x0 + ((x1 - x0) * i) / n + nx * side, y0 + ((y1 - y0) * i) / n + ny * side);
	}
	return { points, width };
}

const inBox = (b: Box, x: number, y: number, r: number) => x >= b.x0 - r && x <= b.x1 + r && y >= b.y0 - r && y <= b.y1 + r;

/** The item turned with its page by quarter turns (see `rotateItem`) */
export function rotatePdfItem(item: PdfItem, quarters: number, w: number, h: number): PdfItem {
	if (!isMarkup(item) && !isNote(item) && !isText(item) && !isStamp(item) && !isCaret(item) && !isLink(item)) return rotateItem(item, quarters, w, h);
	const q = ((quarters % 4) + 4) % 4;
	if (!q) return item;
	const turn = (x: number, y: number): [number, number] => (q === 1 ? [h - y, x] : q === 2 ? [w - x, h - y] : [y, w - x]);
	if (isText(item)) {
		// The box turns, the text with it
		const [ax, ay] = turn(item.x, item.y);
		const [bx, by] = turn(item.x + item.w, item.y + item.h);
		return { ...item, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), rot: (item.rot + q * 90) % 360, ...(item.callout && { callout: turn(...item.callout) }) };
	}
	const turnBox = (b: Box): Box => {
		const [ax, ay] = turn(b.x0, b.y0);
		const [bx, by] = turn(b.x1, b.y1);
		return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
	};
	if (isLink(item)) {
		const b = turnBox(linkBounds(item));
		return { ...item, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
	}
	if (isCaret(item)) {
		const [x, y] = turn(item.x, item.y);
		return { ...item, x, y, dir: (item.dir + q * 90) % 360, ...(item.replaces && { replaces: item.replaces.map(turnBox) }) };
	}
	if (isStamp(item)) {
		// Upright as before: its middle goes where the page takes it
		const [cx, cy] = turn(item.x + item.w / 2, item.y + item.h / 2);
		return { ...item, x: cx - item.w / 2, y: cy - item.h / 2 };
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
	const moved = transformBox(item, t);
	// A callout's tip goes along
	return item.callout ? { ...moved, callout: [t.ox + (item.callout[0] - t.ox) * t.scale + t.dx, t.oy + (item.callout[1] - t.oy) * t.scale + t.dy] } : moved;
}

function transformBox(item: TextItem, t: Transform): TextItem {
	const x = t.ox + (item.x - t.ox) * t.scale + t.dx;
	const y = t.oy + (item.y - t.oy) * t.scale + t.dy;
	if (t.scale === 1) return { ...item, x, y };
	// Scaled with its font (its lines stay as they are) only with K; otherwise only its box, now of fixed size
	if (!t.scaleText) return withText({ ...item, x, y, w: item.w * t.scale, h: item.h * t.scale, sizing: 'fixed' }, item.text);
	const round = (v: number) => Math.round(v * t.scale * 100) / 100;
	return { ...item, x, y, w: item.w * t.scale, h: item.h * t.scale, size: round(item.size), ...(item.borderWidth ? { borderWidth: round(item.borderWidth) } : {}), ...(item.rich ? { rich: scaleRich(item.rich, t.scale) } : {}), padding: roundInsets(scaleInsets(paddingOf(item), t.scale)) };
}

function transformStamp<T extends StampItem | LinkItem>(item: T, t: Transform): T {
	return { ...item, x: t.ox + (item.x - t.ox) * t.scale + t.dx, y: t.oy + (item.y - t.oy) * t.scale + t.dy, w: item.w * t.scale, h: item.h * t.scale };
}

/** The editor's own items (the ink core's are strokes, shapes and pictures) */
type Own = MarkupItem | NoteItem | TextItem | StampItem | CaretItem | LinkItem;
/** The comments of our own kinds that other items snap to */
const snapsTo = (item: Own) => isText(item) || isStamp(item) || isNote(item) || (isLink(item) && linkView.shown) || (isMarkup(item) && !!item.area);

/** How a snap guide names one of our own items */
function ownMark(item: Own): ItemMark {
	if (isNote(item) && item.file) return { name: m.attach.kind, icon: 'icon-[material-symbols-light--attach-file]' };
	if (isNote(item)) return { name: m.commands.note, icon: 'icon-[material-symbols-light--sticky-note-2-outline]' };
	if (isText(item)) return { name: item.callout ? m.commands.callout : m.commands.textbox, icon: 'icon-[material-symbols-light--text-fields]' };
	if (isStamp(item)) return { name: m.commands.stamp, icon: 'icon-[material-symbols-light--approval-outline]' };
	if (isLink(item)) return { name: m.commands.link, icon: 'icon-[material-symbols-light--link]' };
	return { name: m.commands.area, icon: 'icon-[material-symbols-light--highlight-outline]' };
}

const isOwn = (item: PdfItem): item is Own => isMarkup(item) || isNote(item) || isText(item) || isStamp(item) || isCaret(item) || isLink(item);
const ownBounds = (item: Own): Box => (isMarkup(item) ? markupBounds(item) : isNote(item) ? noteBounds(item) : isStamp(item) ? stampBounds(item) : isCaret(item) ? caretBounds(item) : isLink(item) ? linkBounds(item) : itemBounds(item));
const ownHit = (item: Own, x: number, y: number, r: number) =>
	isMarkup(item)
		? item.boxes.some((b) => inBox(b, x, y, r))
		: isCaret(item)
			? inBox(markBounds(item), x, y, r) || !!item.replaces?.some((b) => inBox(b, x, y, r))
			: isText(item)
				? hitsText(item, x, y, r)
				: inBox(ownBounds(item), x, y, r);

/** Strikes out the text in `boxes` (reading along `dir`) */
function strike(ctx: Ctx, boxes: readonly Box[], dir: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineCap = 'butt';
	for (const b of boxes) {
		const { line, width } = markLine('strikeout', b, dir);
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(line[0], line[1]);
		ctx.lineTo(line[2], line[3]);
		ctx.stroke();
	}
}

/** The text box being typed into: its editor shows it instead (it would show through a see-through one) */
export const typing = { id: '' };

/** Strokes and shapes as the ink core draws them, marked text as boxes or lines in its color, notes as bubbles, text
 * boxes as their lines */
export const pdfKit: ItemKit<PdfItem> = {
	// A measured shape with its number
	bounds: (item) => (isOwn(item) ? ownBounds(item) : isMeasured(item) ? unionBox(inkKit.bounds(item), labelBox(item)) : inkKit.bounds(item)),
	draw(ctx, item, cx) {
		drawItem(ctx, item, cx);
		// While the panel of the steps is open: the steps at which the item comes and goes, marked on it
		if (stepView.shown) drawStepMark(ctx, stepLabel(item), pdfKit.bounds(item));
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
		if (isText(item) || isStamp(item) || isLink(item)) return { x: item.x, y: item.y, w: item.w, h: item.h };
		const b = ownBounds(item);
		return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
	},
	// Snapped to: the page, shapes and the comments that are boxes – text boxes, stamps, notes, highlighted areas and
	// links while their boxes show; not handwriting and not marked text or insertion marks (they belong to the text)
	targets(items, exclude, w, h) {
		const snapping = items.filter((i) => !exclude.has(i.id) && (isOwn(i) ? snapsTo(i) : isShape(i)));
		return snapTargets(snapping.map((i) => pdfKit.snapBox(i)), { x: 0, y: 0, w, h }, snapping.map((i) => i.id));
	},
	mark: (item) => (isOwn(item) ? ownMark(item) : inkKit.mark!(item)),
	// A picture has no color to set
	color: (item) => ((isStamp(item) && item.image && !item.icon) || isLink(item) ? null : isOwn(item) ? item.color : inkKit.color(item)),
	// An icon is drawn anew in its new color
	recolor: (item, color) => (isStamp(item) && item.icon ? recolorIcon({ ...item, icon: item.icon }, color) : null),
	transform: (item, t) =>
		isCaret(item) ? { ...item, x: t.ox + (item.x - t.ox) * t.scale + t.dx, y: t.oy + (item.y - t.oy) * t.scale + t.dy, h: item.h * t.scale } : isMarkup(item) ? transformMarkup(item, t) : isNote(item) ? transformNote(item, t) : isStamp(item) || isLink(item) ? transformStamp(item, t) : isText(item) ? transformText(item, t) : inkKit.transform(item, t),
	// Marked text belongs to its text: it never moves away from it (a highlighted area was drawn: it moves)
	fixed: (item) => (isMarkup(item) && !item.area) || isCaret(item),
	// A text box's corners and sides change its box (its font only with K); a shape's points
	handles: (item) => (isText(item) ? textHandles(item) : isOwn(item) ? null : (inkKit.handles?.(item) ?? null)),
	moveHandle: (item, index, x, y, o) => (isText(item) ? moveTextHandle(item, index, x, y, o) : isOwn(item) ? item : inkKit.moveHandle!(item, index, x, y, o)),
	ownScale: isText,
	// Pieces of an erased stroke and a stroke turned into a shape keep their steps
	inherit: (from, made) => withFlips(made, flipsOf(from))
};

/** An item as it looks on the page */
function drawItem(ctx: Ctx, item: PdfItem, cx: unknown) {
	if (isNote(item)) return drawNote(ctx, item);
	if (isStamp(item)) return drawStamp(ctx, item);
	if (isLink(item)) return drawLink(ctx, item);
	if (isCaret(item)) {
		// "Replace text": the text struck out, in the mark's color
		if (item.replaces) strike(ctx, item.replaces, item.dir, item.color);
		return drawCaret(ctx, item);
	}
	// Typed into: its field shows the box, its line stays
	if (isText(item)) return item.id === typing.id ? drawCallout(ctx, item) : drawText(ctx, item);
	if (!isMarkup(item)) {
		inkKit.draw(ctx, item, cx as Parameters<typeof inkKit.draw>[2]);
		if (isMeasured(item)) drawMeasure(ctx, item);
		return;
	}
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
		const { points, width } = item.kind === 'squiggly' ? squiggle(b, item.dir) : { points: markLine(item.kind, b, item.dir).line, width: markLine(item.kind, b, item.dir).width };
		ctx.lineWidth = width;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(points[0], points[1]);
		for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
		ctx.stroke();
	}
}

/** Ink, marked text, insertion marks, notes, text boxes and stamps (words or pictures): everything the editor writes
 * as annotations */
export type Annotatable = Ink | Own;

export const isAnnotatable = (item: PdfItem): item is Annotatable => isOwn(item) || isInk(item);
