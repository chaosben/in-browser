// Shape recognition: after a pen stroke, the line, arrow, triangle, rectangle, quadrilateral or ellipse it resembles
// is offered as a suggestion (tap → the stroke becomes that shape, `ShapeSuggestion`). Only for strokes large enough
// not to be handwriting. More polygons are left to the shape tool: a sloppy circle would otherwise often become a
// hexagon.

import type { ShapeFit } from './shapes.js';

/** Ramer–Douglas–Peucker: indices of the points kept */
function simplify(xs: number[], ys: number[], eps: number): number[] {
	const keep = new Uint8Array(xs.length);
	keep[0] = keep[xs.length - 1] = 1;
	const stack: [number, number][] = [[0, xs.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop()!;
		let max = 0;
		let at = -1;
		const dx = xs[b] - xs[a];
		const dy = ys[b] - ys[a];
		const len = Math.hypot(dx, dy) || 1;
		for (let i = a + 1; i < b; i++) {
			const d = Math.abs(dy * (xs[i] - xs[a]) - dx * (ys[i] - ys[a])) / len;
			if (d > max) {
				max = d;
				at = i;
			}
		}
		if (at >= 0 && max > eps) {
			keep[at] = 1;
			stack.push([a, at], [at, b]);
		}
	}
	return [...keep.keys()].filter((i) => keep[i]);
}

/** Angle at b between b→a and b→c (radians) */
const angle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
	Math.abs(Math.atan2((ax - bx) * (cy - by) - (ay - by) * (cx - bx), (ax - bx) * (cx - bx) + (ay - by) * (cy - by)));

/**
 * An arrow drawn in one go: a long shaft, then the head near its end – a "V" through the tip or a single hook. All
 * points after the shaft stay close to the tip and behind it; the wing reaches back at an angle of 10–75°.
 */
function arrow(xs: number[], ys: number[], diag: number): ShapeFit | null {
	const idx = simplify(xs, ys, diag * 0.05);
	if (idx.length < 3) return null;
	const t = idx[1];
	const [x0, y0, x1, y1] = [xs[0], ys[0], xs[t], ys[t]];
	const shaft = Math.hypot(x1 - x0, y1 - y0);
	if (shaft < diag * 0.55) return null;
	// Unit vector from the tip back along the shaft
	const ux = (x0 - x1) / shaft;
	const uy = (y0 - y1) / shaft;
	let wing = 0;
	let wingAngle = 0;
	for (let i = t + 1; i < xs.length; i++) {
		const dx = xs[i] - x1;
		const dy = ys[i] - y1;
		const d = Math.hypot(dx, dy);
		if (d > shaft * 0.45) return null;
		// Not ahead of the tip (a little overshoot is fine)
		if (dx * ux + dy * uy < -shaft * 0.08) return null;
		if (d > wing) {
			wing = d;
			wingAngle = Math.acos(Math.min(1, Math.max(-1, (dx * ux + dy * uy) / d)));
		}
	}
	if (wing < shaft * 0.1) return null;
	if (wingAngle < (10 * Math.PI) / 180 || wingAngle > (75 * Math.PI) / 180) return null;
	return { kind: 'line', x0, y0, x1, y1, end: true };
}

/** The shape a stroke (x, y, pressure) resembles, or null */
export function recognize(points: Float32Array): ShapeFit | null {
	const n = points.length / 3;
	if (n < 3) return null;
	const xs: number[] = [];
	const ys: number[] = [];
	for (let i = 0; i < points.length; i += 3) {
		xs.push(points[i]);
		ys.push(points[i + 1]);
	}
	const x0 = Math.min(...xs);
	const x1 = Math.max(...xs);
	const y0 = Math.min(...ys);
	const y1 = Math.max(...ys);
	const diag = Math.hypot(x1 - x0, y1 - y0);
	if (diag < 8) return null;
	const gap = Math.hypot(xs[0] - xs[n - 1], ys[0] - ys[n - 1]);

	if (gap > diag * 0.25) {
		// Open: a straight line if no point strays far from the chord
		const corners = simplify(xs, ys, gap * 0.08);
		if (corners.length === 2) return { kind: 'line', x0: xs[0], y0: ys[0], x1: xs[n - 1], y1: ys[n - 1] };
		return arrow(xs, ys, diag);
	}

	// Closed: corners of the loop (the start/end point is a corner candidate too)
	const idx = simplify(xs, ys, diag * 0.07);
	let corners = idx.slice(0, -1).map((i) => [xs[i], ys[i]] as const);
	// Drop "corners" on a straight run (also where start and end meet mid-edge)
	corners = corners.filter((c, i) => {
		const p = corners[(i + corners.length - 1) % corners.length];
		const q = corners[(i + 1) % corners.length];
		return angle(p[0], p[1], c[0], c[1], q[0], q[1]) < Math.PI * 0.85;
	});
	if (corners.length === 3) return { kind: 'polygon', points: corners.flat() };
	if (corners.length === 4) {
		// Nearly axis-parallel edges: an exact rectangle of the bounds
		const axis = corners.every((c, i) => {
			const d = corners[(i + 1) % 4];
			const a = Math.abs(Math.atan2(d[1] - c[1], d[0] - c[0])) % (Math.PI / 2);
			return a < 0.26 || a > Math.PI / 2 - 0.26;
		});
		return axis ? { kind: 'polygon', points: [x0, y0, x1, y0, x1, y1, x0, y1] } : { kind: 'polygon', points: corners.flat() };
	}
	// Round: an ellipse in the bounds (a circle if nearly round)
	const w = x1 - x0;
	const h = y1 - y0;
	if (w / h > 0.85 && w / h < 1.18) {
		const d = (w + h) / 2;
		return { kind: 'ellipse', x: (x0 + x1 - d) / 2, y: (y0 + y1 - d) / 2, w: d, h: d };
	}
	return { kind: 'ellipse', x: x0, y: y0, w, h };
}

/** Strokes smaller than this (diagonal of their bounds) get no suggestion: page points … */
const SUGGEST_MIN = 40;
/** … and screen pixels (handwriting zoomed in) */
const SUGGEST_MIN_SCREEN = 60;

/** The shape to suggest for a finished pen stroke at a zoom (screen pixels per point), or null */
export function suggestShape(points: Float32Array, zoom: number): ShapeFit | null {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (let i = 0; i < points.length; i += 3) {
		x0 = Math.min(x0, points[i]);
		x1 = Math.max(x1, points[i]);
		y0 = Math.min(y0, points[i + 1]);
		y1 = Math.max(y1, points[i + 1]);
	}
	const diag = Math.hypot(x1 - x0, y1 - y0);
	if (diag < SUGGEST_MIN || diag * zoom < SUGGEST_MIN_SCREEN) return null;
	return recognize(points);
}

export type ShapeName = 'line' | 'arrow' | 'doubleArrow' | 'triangle' | 'rectangle' | 'quadrilateral' | 'polygon' | 'roundedRect' | 'circle' | 'ellipse';

/** What to call a shape (the suggestion's label) */
export function shapeName(fit: ShapeFit): ShapeName {
	switch (fit.kind) {
		case 'line':
			return fit.start && fit.end ? 'doubleArrow' : fit.start || fit.end ? 'arrow' : 'line';
		case 'polyline':
			return 'line';
		case 'roundedRect':
			return 'roundedRect';
		case 'ellipse':
			return Math.abs(fit.w - fit.h) < 0.01 * Math.max(fit.w, fit.h) ? 'circle' : 'ellipse';
		case 'polygon': {
			const p = fit.points;
			if (p.length === 6) return 'triangle';
			if (p.length !== 8) return 'polygon';
			// Edges alternately horizontal and vertical
			const axis = (i: number, j: number) => Math.abs(p[i] - p[j]) < 0.01;
			const rect = (axis(1, 3) && axis(2, 4) && axis(5, 7) && axis(6, 0)) || (axis(0, 2) && axis(3, 5) && axis(4, 6) && axis(7, 1));
			return rect ? 'rectangle' : 'quadrilateral';
		}
	}
}
