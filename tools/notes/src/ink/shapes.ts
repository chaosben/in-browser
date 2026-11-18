// Geometric shapes as pen strokes: what "hold to straighten" recognizes (`recognize.ts`) and what the shape tool
// draws by dragging. Every shape is one polyline (x, y, pressure 0.5), so it is an ordinary stroke – erasers, lasso,
// recoloring, sync and export need nothing of their own. Arrows trace their head through the tip
// (shaft → tip → wing → tip → wing); the round joins of the stroke make that look clean.

import { arrowHead, strokesOf } from '@in-browser/graphics/shapes.js';

export type ShapeFit =
	| { kind: 'line'; x0: number; y0: number; x1: number; y1: number }
	| { kind: 'arrow'; x0: number; y0: number; x1: number; y1: number; double: boolean }
	/** Closed polygon through its corners */
	| { kind: 'polygon'; points: number[] }
	/** Polyline as given (closed if its last point is its first) */
	| { kind: 'path'; points: number[] }
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
/** Half the opening angle of an arrowhead */
const HEAD_SPREAD = 0.45;

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

/** The shape dragged from (x0, y0) to (x1, y1), page points */
export function fitFromDrag(kind: ShapeKind, x0: number, y0: number, x1: number, y1: number): ShapeFit {
	if (kind === 'line' || kind === 'arrow' || kind === 'doubleArrow') {
		const angle = Math.atan2(y1 - y0, x1 - x0);
		const snapped = Math.round(angle / SNAP_STEP) * SNAP_STEP;
		if (Math.abs(angle - snapped) < SNAP_RANGE) {
			const length = Math.hypot(x1 - x0, y1 - y0);
			x1 = x0 + Math.cos(snapped) * length;
			y1 = y0 + Math.sin(snapped) * length;
		}
		return kind === 'line' ? { kind, x0, y0, x1, y1 } : { kind: 'arrow', x0, y0, x1, y1, double: kind === 'doubleArrow' };
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
		case 'roundedRect': {
			const path = strokesOf({ kind: 'rect', seed: '', sketch: false, x, y, w, h, radius: Math.min(w, h) * 0.15 })[0];
			return { kind: 'path', points: path.flatMap((p) => [p.x, p.y]) };
		}
		case 'ellipse':
			return { kind: 'ellipse', x, y, w, h };
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

/** The two wing ends of an arrowhead at `tip`, pointing away from `from` */
function wings(fx: number, fy: number, tx: number, ty: number, head: number): [number, number, number, number] {
	const angle = Math.atan2(ty - fy, tx - fx);
	return [
		tx - Math.cos(angle - HEAD_SPREAD) * head,
		ty - Math.sin(angle - HEAD_SPREAD) * head,
		tx - Math.cos(angle + HEAD_SPREAD) * head,
		ty - Math.sin(angle + HEAD_SPREAD) * head
	];
}

/** Corners of the shape as one polyline (x, y pairs) */
function outline(fit: ShapeFit, size: number): number[] {
	switch (fit.kind) {
		case 'ellipse':
			return strokesOf({ kind: 'ellipse', seed: '', sketch: false, x: fit.x, y: fit.y, w: fit.w, h: fit.h })[0].flatMap((p) => [p.x, p.y]);
		case 'line':
			return [fit.x0, fit.y0, fit.x1, fit.y1];
		case 'polygon':
			return [...fit.points, fit.points[0], fit.points[1]];
		case 'path':
			return fit.points;
		case 'arrow': {
			const { x0, y0, x1, y1 } = fit;
			const head = arrowHead(size, Math.hypot(x1 - x0, y1 - y0) / (fit.double ? 2 : 1), MIN_HEAD);
			const [ax, ay, bx, by] = wings(x0, y0, x1, y1, head);
			const tip = [x1, y1, ax, ay, x1, y1, bx, by];
			if (!fit.double) return [x0, y0, ...tip];
			const [cx, cy, dx, dy] = wings(x1, y1, x0, y0, head);
			return [cx, cy, x0, y0, dx, dy, x0, y0, ...tip];
		}
	}
}

/** Points of the shape (x, y, pressure 0.5), dense enough for the eraser and selection. `size`: pen diameter */
export function shapePoints(fit: ShapeFit, size = 1.5): Float32Array {
	const path = outline(fit, size);
	// Straight edges: points every few points of length, so erasing cuts precisely
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
