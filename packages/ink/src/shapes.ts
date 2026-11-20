// Geometric shapes: what the shape tool draws by dragging and what a freehand stroke can be turned into
// (`recognize.ts`). A shape is stored as its geometry (`ShapeFit`) and style (fill, dashes, hand-drawn) in an item
// `type: 'shape'`, so everything can be changed afterwards. For drawing, erasing, hit tests and export it is a few
// pen polylines (x, y, pressure 0.5, `inkStrokes`): the outline (in dashes or dots, exact or hand-drawn via
// `@in-browser/graphics`) and the arrowheads (wing → tip → wing, always solid); a fill under it (`fillOutline`).

import { arrowHead, arrowWings, strokesOf, type Point } from '@in-browser/graphics/shapes.js';
import type { Ink, ShapeItem, Stroke } from './items.js';

export type ShapeFit =
	/** A line, with arrowheads at its start and/or end */
	| { kind: 'line'; x0: number; y0: number; x1: number; y1: number; start?: boolean; end?: boolean }
	/** Closed polygon through its corners */
	| { kind: 'polygon'; points: number[] }
	| { kind: 'roundedRect'; x: number; y: number; w: number; h: number }
	| { kind: 'ellipse'; x: number; y: number; w: number; h: number };

/** Shapes of the shape tool, in the order of its panel */
export const SHAPE_KINDS = [
	'line',
	'arrow',
	'doubleArrow',
	'rect',
	'roundedRect',
	'ellipse',
	'triangle',
	'diamond',
	'parallelogram',
	'pentagon',
	'hexagon',
	'star'
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Lines and arrows snap to multiples of this angle … */
const SNAP_STEP = Math.PI / 12;
/** … when they are closer than this */
const SNAP_RANGE = (4 * Math.PI) / 180;
/** Boxes this close to square become square (square, circle, regular polygon) */
const SQUARE_RATIO = 1.1;
/** Smallest arrowhead in points (with thin pens) */
const MIN_HEAD = 8;

/** Corners of a polygon with `n` corners (alternating radii for a star) around the unit circle, top corner up */
function unitPolygon(n: number, start: number, inner = 1): number[] {
	const points: number[] = [];
	for (let i = 0; i < n; i++) {
		const angle = start + (i / n) * 2 * Math.PI;
		const r = i % 2 ? inner : 1;
		points.push(Math.cos(angle) * r, Math.sin(angle) * r);
	}
	return points;
}

/** Stretches points so their bounds fill the box */
function fitInto(points: number[], x: number, y: number, w: number, h: number): number[] {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (let i = 0; i < points.length; i += 2) {
		x0 = Math.min(x0, points[i]);
		x1 = Math.max(x1, points[i]);
		y0 = Math.min(y0, points[i + 1]);
		y1 = Math.max(y1, points[i + 1]);
	}
	return points.map((v, i) => (i % 2 ? y + ((v - y0) / (y1 - y0 || 1)) * h : x + ((v - x0) / (x1 - x0 || 1)) * w));
}

const PENTAGON = unitPolygon(5, -Math.PI / 2);
const HEXAGON = unitPolygon(6, 0);
const STAR = unitPolygon(10, -Math.PI / 2, 0.4);

/** The end of a line from (x0, y0) to (x1, y1), snapped to a multiple of 15° when close to one */
function snapEnd(x0: number, y0: number, x1: number, y1: number): [number, number] {
	const angle = Math.atan2(y1 - y0, x1 - x0);
	const snapped = Math.round(angle / SNAP_STEP) * SNAP_STEP;
	if (Math.abs(angle - snapped) >= SNAP_RANGE) return [x1, y1];
	const length = Math.hypot(x1 - x0, y1 - y0);
	return [x0 + Math.cos(snapped) * length, y0 + Math.sin(snapped) * length];
}

/** The shape dragged from (x0, y0) to (x1, y1), page points; lines snap to 15° steps if `snapAngle` */
export function fitFromDrag(kind: ShapeKind, x0: number, y0: number, x1: number, y1: number, snapAngle = true): ShapeFit {
	if (kind === 'line' || kind === 'arrow' || kind === 'doubleArrow') {
		if (snapAngle) [x1, y1] = snapEnd(x0, y0, x1, y1);
		return withHeads({ kind: 'line', x0, y0, x1, y1 }, kind === 'doubleArrow', kind !== 'line');
	}
	let w = Math.abs(x1 - x0);
	let h = Math.abs(y1 - y0);
	if (w > 0 && h > 0 && Math.max(w, h) / Math.min(w, h) < SQUARE_RATIO) w = h = Math.max(w, h);
	// The box grows away from where the drag started
	const x = x1 < x0 ? x0 - w : x0;
	const y = y1 < y0 ? y0 - h : y0;
	const r = x + w;
	const b = y + h;
	switch (kind) {
		case 'rect':
			return { kind: 'polygon', points: [x, y, r, y, r, b, x, b] };
		case 'roundedRect':
		case 'ellipse':
			return { kind, x, y, w, h };
		case 'triangle':
			return { kind: 'polygon', points: [x + w / 2, y, r, b, x, b] };
		case 'diamond':
			return { kind: 'polygon', points: [x + w / 2, y, r, y + h / 2, x + w / 2, b, x, y + h / 2] };
		case 'parallelogram': {
			const o = w * 0.25;
			return { kind: 'polygon', points: [x + o, y, r, y, r - o, b, x, b] };
		}
		case 'pentagon':
			return { kind: 'polygon', points: fitInto(PENTAGON, x, y, w, h) };
		case 'hexagon':
			return { kind: 'polygon', points: fitInto(HEXAGON, x, y, w, h) };
		case 'star':
			return { kind: 'polygon', points: fitInto(STAR, x, y, w, h) };
	}
}

/** Arrowhead at (`tx`, `ty`) pointing away from (`fx`, `fy`) as polyline wing → tip → wing */
function headAt(fx: number, fy: number, tx: number, ty: number, head: number): number[] {
	const [a, b] = arrowWings({ x: tx, y: ty }, Math.atan2(ty - fy, tx - fx), head);
	return [a.x, a.y, tx, ty, b.x, b.y];
}

type Line = Extract<ShapeFit, { kind: 'line' }>;

/** A line with arrowheads as given (stored only where there is one) */
export function withHeads(fit: Line, start: boolean, end: boolean): Line {
	const { x0, y0, x1, y1 } = fit;
	return { kind: 'line', x0, y0, x1, y1, ...(start && { start: true }), ...(end && { end: true }) };
}

/** Arrowheads of a line as polylines wing → tip → wing (x, y pairs) */
function heads(fit: ShapeFit, size: number): number[][] {
	if (fit.kind !== 'line' || (!fit.start && !fit.end)) return [];
	const { x0, y0, x1, y1 } = fit;
	const head = arrowHead(size, Math.hypot(x1 - x0, y1 - y0) / (fit.start && fit.end ? 2 : 1), MIN_HEAD);
	const out: number[][] = [];
	if (fit.end) out.push(headAt(x0, y0, x1, y1, head));
	if (fit.start) out.push(headAt(x1, y1, x0, y0, head));
	return out;
}

const flat = (points: Point[]) => points.flatMap((p) => [p.x, p.y]);
const corners = (points: number[]): Point[] => {
	const out: Point[] = [];
	for (let i = 0; i < points.length; i += 2) out.push({ x: points[i], y: points[i + 1] });
	return out;
};

/** Outline of the shape as polylines (x, y pairs): one when exact, one per edge or stroke when hand-drawn */
function outlines(fit: ShapeFit, sketch: boolean, seed: string): number[][] {
	const base = { seed, sketch };
	switch (fit.kind) {
		case 'line':
			return sketch ? strokesOf({ kind: 'line', ...base, from: { x: fit.x0, y: fit.y0 }, to: { x: fit.x1, y: fit.y1 } }).map(flat) : [[fit.x0, fit.y0, fit.x1, fit.y1]];
		case 'polygon':
			return strokesOf({ kind: 'polygon', ...base, points: corners(fit.points) }).map(flat);
		case 'roundedRect': {
			const { x, y, w, h } = fit;
			return strokesOf({ kind: 'rect', ...base, x, y, w, h, radius: Math.min(w, h) * 0.15 }).map(flat);
		}
		case 'ellipse':
			return strokesOf({ kind: 'ellipse', ...base, x: fit.x, y: fit.y, w: fit.w, h: fit.h }).map(flat);
	}
}

/** Polyline (x, y pairs) as points (x, y, pressure 0.5) every few points of length, so erasing cuts precisely */
function dense(path: number[]): Float32Array {
	const out: number[] = [];
	for (let i = 0; i < path.length; i += 2) {
		if (i > 0) {
			const ax = path[i - 2];
			const ay = path[i - 1];
			const bx = path[i];
			const by = path[i + 1];
			const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
			for (let k = 1; k < steps; k++) out.push(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps, 0.5);
		}
		out.push(path[i], path[i + 1], 0.5);
	}
	return new Float32Array(out);
}

/**
 * One polyline as one piece per dash: `on` long (0: a dot), then `off` free (> 0), along its length. The round ends
 * of the pen add half its width at each end, so the dash lengths account for that (`dashLengths`).
 */
export function dashes(path: number[], on: number, off: number): number[][] {
	const out: number[][] = [];
	let piece: number[] | null = [path[0], path[1]];
	let left = on;
	for (let i = 2; i < path.length; i += 2) {
		const ax = path[i - 2];
		const ay = path[i - 1];
		const len = Math.hypot(path[i] - ax, path[i + 1] - ay);
		let at = 0;
		while (len - at >= left) {
			at += left;
			const t = len ? at / len : 0;
			const x = ax + (path[i] - ax) * t;
			const y = ay + (path[i + 1] - ay) * t;
			if (piece) {
				piece.push(x, y);
				out.push(piece);
				piece = null;
				left = off;
			} else {
				// A dot (`on` 0) ends right here in the next round
				piece = [x, y];
				left = on;
			}
		}
		left -= len - at;
		if (piece) piece.push(path[i], path[i + 1]);
	}
	if (piece && piece.length >= 4) out.push(piece);
	return out;
}

export type Dash = 'solid' | 'dashed' | 'dotted';
export const DASHES: readonly Dash[] = ['solid', 'dashed', 'dotted'];

/** How a shape is drawn besides color and pen size */
export interface ShapeStyle {
	/** `#rrggbbaa` under the outline, null: none (lines have none) */
	fill: string | null;
	dash: Dash;
	/** Hand-drawn instead of exact (irregularity fixed by the item's id) */
	sketch: boolean;
}

export const PLAIN: ShapeStyle = { fill: null, dash: 'solid', sketch: false };

export const styleOf = (item: ShapeItem): ShapeStyle => ({ fill: item.fill ?? null, dash: item.dash ?? 'solid', sketch: item.sketch ?? false });

/** The item with a style (fields stored only when not the default) */
export function withStyle(item: ShapeItem, style: Partial<ShapeStyle>): ShapeItem {
	const s = { ...styleOf(item), ...style };
	const { fill: _f, dash: _d, sketch: _s, ...rest } = item;
	return { ...rest, ...(s.fill && closed(item.fit) && { fill: s.fill }), ...(s.dash !== 'solid' && { dash: s.dash }), ...(s.sketch && { sketch: true }) };
}

/** Shapes that enclose an area (can be filled) */
export const closed = (fit: ShapeFit) => fit.kind !== 'line';

/** Points of the shape as one polyline (x, y, pressure 0.5): previews (shape tool while dragging, panel icons) */
export function shapePoints(fit: ShapeFit, size = 1.5): Float32Array {
	const [body] = outlines(fit, false, '');
	if (fit.kind !== 'line') return dense(body);
	// Arrowheads traced through the tip (wing → tip → wing), so it stays one polyline
	const [end, start] = fit.end ? heads(fit, size) : [undefined, ...heads(fit, size)];
	const path = [...(start ? [...start, fit.x0, fit.y0] : body.slice(0, 2)), fit.x1, fit.y1, ...(end ? [...end.slice(0, 4), fit.x1, fit.y1, ...end.slice(4)] : [])];
	return dense(path);
}

// --- Shapes as items: drawn as pen strokes, edited by their points ---

const inks = new WeakMap<ShapeItem, Stroke[]>();

/** Dashes of a pen of diameter `size` (on, off) */
function dashLengths(dash: Dash, size: number): [number, number] {
	return dash === 'dotted' ? [0, size * 2 + 2] : [size * 3 + 2, size * 2 + 3];
}

/** What an ink item looks like as pen strokes: a stroke itself, a shape its outline pieces (computed once per object) */
export function inkStrokes(item: Ink): Stroke[] {
	if ('points' in item) return [item];
	let strokes = inks.get(item);
	if (!strokes) {
		const { dash, sketch } = styleOf(item);
		const bodies = outlines(item.fit, sketch, item.id);
		const pieces = dash === 'solid' ? bodies : bodies.flatMap((b) => dashes(b, ...dashLengths(dash, item.size)));
		strokes = [...pieces, ...heads(item.fit, item.size)].map((p) => ({ id: item.id, tool: 'pen' as const, color: item.color, size: item.size, points: dense(p) }));
		inks.set(item, strokes);
	}
	return strokes;
}

/** All points of an ink item's strokes (x, y, pressure), e.g. for the lasso */
export function inkPoints(item: Ink): Float32Array {
	const strokes = inkStrokes(item);
	if (strokes.length === 1) return strokes[0].points;
	const out = new Float32Array(strokes.reduce((n, s) => n + s.points.length, 0));
	let at = 0;
	for (const s of strokes) {
		out.set(s.points, at);
		at += s.points.length;
	}
	return out;
}

/** The exact outline to fill (x, y pairs), null when the shape has no fill */
export function fillOutline(item: ShapeItem): number[] | null {
	if (!item.fill || !closed(item.fit)) return null;
	return outlines(item.fit, false, '')[0];
}

/** Points of a shape that can be dragged: ends of lines, corners of polygons, corners of boxes (nw, ne, se, sw) */
export function handlesOf(fit: ShapeFit): [number, number][] {
	switch (fit.kind) {
		case 'line':
			return [
				[fit.x0, fit.y0],
				[fit.x1, fit.y1]
			];
		case 'polygon': {
			const out: [number, number][] = [];
			for (let i = 0; i < fit.points.length; i += 2) out.push([fit.points[i], fit.points[i + 1]]);
			return out;
		}
		case 'roundedRect':
		case 'ellipse':
			return [
				[fit.x, fit.y],
				[fit.x + fit.w, fit.y],
				[fit.x + fit.w, fit.y + fit.h],
				[fit.x, fit.y + fit.h]
			];
	}
}

/** Boxes don't get thinner than this (points) */
const MIN_BOX = 1;

/** The shape with handle `index` (see `handlesOf`) moved to (x, y); line ends snap to 15° steps if `snapAngle` */
export function moveHandle(fit: ShapeFit, index: number, x: number, y: number, snapAngle = true, keepAspect = false): ShapeFit {
	switch (fit.kind) {
		case 'line':
			if (index === 0) {
				const [x0, y0] = snapAngle ? snapEnd(fit.x1, fit.y1, x, y) : [x, y];
				return { ...fit, x0, y0 };
			} else {
				const [x1, y1] = snapAngle ? snapEnd(fit.x0, fit.y0, x, y) : [x, y];
				return { ...fit, x1, y1 };
			}
		case 'polygon': {
			const points = [...fit.points];
			points[index * 2] = x;
			points[index * 2 + 1] = y;
			return { ...fit, points };
		}
		case 'roundedRect':
		case 'ellipse': {
			// The opposite corner stays where it is
			const [ox, oy] = handlesOf(fit)[(index + 2) % 4];
			let w = Math.max(MIN_BOX, Math.abs(x - ox));
			let h = Math.max(MIN_BOX, Math.abs(y - oy));
			// Shift: the proportions stay (the side dragged further leads)
			if (keepAspect && fit.w > 0 && fit.h > 0) {
				const ratio = fit.w / fit.h;
				if (w / ratio > h) h = w / ratio;
				else w = h * ratio;
			}
			return { ...fit, x: x < ox ? ox - w : ox, y: y < oy ? oy - h : oy, w, h };
		}
	}
}

/** The shape scaled by `scale` around (ox, oy), then moved by (dx, dy) – like `transformItem` */
export function transformFit(fit: ShapeFit, t: { dx: number; dy: number; scale: number; ox: number; oy: number }): ShapeFit {
	const tx = (x: number) => t.ox + (x - t.ox) * t.scale + t.dx;
	const ty = (y: number) => t.oy + (y - t.oy) * t.scale + t.dy;
	switch (fit.kind) {
		case 'line':
			return { ...fit, x0: tx(fit.x0), y0: ty(fit.y0), x1: tx(fit.x1), y1: ty(fit.y1) };
		case 'polygon':
			return { ...fit, points: fit.points.map((v, i) => (i % 2 ? ty(v) : tx(v))) };
		case 'roundedRect':
		case 'ellipse':
			return { ...fit, x: tx(fit.x), y: ty(fit.y), w: fit.w * t.scale, h: fit.h * t.scale };
	}
}

const round = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/** A shape read from a page file, or null if it isn't a valid one; coordinates rounded to 0.01 */
export function parseFit(raw: unknown): ShapeFit | null {
	const r = raw as Record<string, unknown> | null;
	if (!r || typeof r !== 'object') return null;
	switch (r.kind) {
		case 'line':
		case 'arrow': {
			const [x0, y0, x1, y1] = [r.x0, r.y0, r.x1, r.y1].map(num);
			if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
			const line: Line = { kind: 'line', x0: round(x0), y0: round(y0), x1: round(x1), y1: round(y1) };
			// `arrow` (with `double`): the first shapes, before arrowheads were a setting of lines
			return r.kind === 'arrow' ? withHeads(line, r.double === true, true) : withHeads(line, r.start === true, r.end === true);
		}
		case 'polygon': {
			if (!Array.isArray(r.points) || r.points.length < 6 || r.points.length % 2) return null;
			const points = r.points.map(num);
			return points.every(Number.isFinite) ? { kind: 'polygon', points: points.map(round) } : null;
		}
		case 'roundedRect':
		case 'ellipse': {
			const [x, y, w, h] = [r.x, r.y, r.w, r.h].map(num);
			if (![x, y].every(Number.isFinite) || !(w > 0) || !(h > 0)) return null;
			return { kind: r.kind, x: round(x), y: round(y), w: round(w), h: round(h) };
		}
	}
	return null;
}

/** A small drawing of a shape kind for pickers and menus: the points of its outline in a 24 × 24 box (`x,y x,y …`),
 * drawn by the same geometry as on the page */
export function shapeGlyph(kind: ShapeKind): string {
	const line = kind === 'line' || kind === 'arrow' || kind === 'doubleArrow';
	const pts = shapePoints(line ? fitFromDrag(kind, 3, 18, 21, 6) : fitFromDrag(kind, 3, 5, 21, 19), 1);
	let points = '';
	for (let i = 0; i < pts.length; i += 3) points += `${pts[i].toFixed(1)},${pts[i + 1].toFixed(1)} `;
	return points.trim();
}
