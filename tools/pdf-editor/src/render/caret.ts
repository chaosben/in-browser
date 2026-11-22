// Insertion marks: a caret between two characters of the page's text carrying what should be inserted there as its
// comment – saved as `/Caret` annotations. "Replace text" is such a mark at the end of the text it strikes out
// (`replaces`): one item, one comment. Like marked text it belongs to its text and never moves.

import type { Box } from '@in-browser/ink/geometry.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';

export interface CaretItem {
	id: string;
	type: 'caret';
	/** The point on the baseline between the two characters (page points as shown) */
	x: number;
	y: number;
	/** Height of the text there */
	h: number;
	/** Reading direction on the page as shown (degrees clockwise; 0 = left to right) */
	dir: number;
	/** `#rrggbbaa` */
	color: string;
	/** What to insert (the annotation's contents) */
	text: string;
	/** "Replace text": the boxes of the text struck out (page points as shown) and what it says */
	replaces?: Box[];
	marked?: string;
}

export const isCaret = (item: { readonly id: string }): item is CaretItem => (item as CaretItem).type === 'caret';

/** The mark's shape for a text height of 1, reading left to right: foot, tip, foot (the tip just above the baseline) */
const SHAPE = [-0.22, 0.25, 0, -0.12, 0.22, 0.25];
/** Its line's width (× the text height) */
export const CARET_LINE = 0.07;

/** The mark's three points (x, y pairs): foot → tip → foot */
export function caretPoints(c: Pick<CaretItem, 'x' | 'y' | 'h' | 'dir'>): number[] {
	const a = (c.dir * Math.PI) / 180;
	const [cos, sin] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
	const out: number[] = [];
	for (let i = 0; i < SHAPE.length; i += 2) {
		const [lx, ly] = [SHAPE[i] * c.h, SHAPE[i + 1] * c.h];
		out.push(c.x + lx * cos - ly * sin, c.y + lx * sin + ly * cos);
	}
	return out;
}

/** The mark alone (without the text it replaces) */
export function markBounds(c: Pick<CaretItem, 'x' | 'y' | 'h' | 'dir'>): Box {
	const p = caretPoints(c);
	const pad = (c.h * CARET_LINE) / 2;
	return { x0: Math.min(p[0], p[2], p[4]) - pad, y0: Math.min(p[1], p[3], p[5]) - pad, x1: Math.max(p[0], p[2], p[4]) + pad, y1: Math.max(p[1], p[3], p[5]) + pad };
}

/** The mark and the text it replaces */
export function caretBounds(c: CaretItem): Box {
	const boxes = [markBounds(c), ...(c.replaces ?? [])];
	return { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
}

/** A mark whose shape fills `box` (another program's, read from its `/Rect`) */
export function caretIn(box: Box, dir: number): Pick<CaretItem, 'x' | 'y' | 'h' | 'dir'> {
	const upright = dir % 180 === 0;
	const h = Math.max(1, (upright ? box.y1 - box.y0 : box.x1 - box.x0) / (SHAPE[1] - SHAPE[3] + CARET_LINE));
	const at = markBounds({ x: 0, y: 0, h, dir });
	return { x: (box.x0 + box.x1) / 2 - (at.x0 + at.x1) / 2, y: (box.y0 + box.y1) / 2 - (at.y0 + at.y1) / 2, h, dir };
}

/** Draws an insertion mark (page points) */
export function drawCaret(ctx: Ctx, c: CaretItem) {
	const p = caretPoints(c);
	ctx.strokeStyle = c.color;
	ctx.lineWidth = c.h * CARET_LINE;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(p[0], p[1]);
	ctx.lineTo(p[2], p[3]);
	ctx.lineTo(p[4], p[5]);
	ctx.stroke();
}
