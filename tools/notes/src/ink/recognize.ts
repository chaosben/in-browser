// Shape recognition for "hold to straighten": after the pen rests at the end of a stroke, the stroke is replaced by
// the line, triangle, rectangle, quadrilateral or ellipse it resembles.

import { strokesOf } from '@in-browser/graphics/shapes.js';

export type ShapeFit =
	| { kind: 'line'; x0: number; y0: number; x1: number; y1: number }
	| { kind: 'polygon'; points: number[] }
	| { kind: 'ellipse'; x: number; y: number; w: number; h: number };

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
		return corners.length === 2 ? { kind: 'line', x0: xs[0], y0: ys[0], x1: xs[n - 1], y1: ys[n - 1] } : null;
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

/** Points of the shape (x, y, pressure 0.5), dense enough for the eraser and selection */
export function shapePoints(fit: ShapeFit): Float32Array {
	let path: { x: number; y: number }[];
	if (fit.kind === 'ellipse') path = strokesOf({ kind: 'ellipse', seed: '', sketch: false, x: fit.x, y: fit.y, w: fit.w, h: fit.h })[0];
	else if (fit.kind === 'line') path = [{ x: fit.x0, y: fit.y0 }, { x: fit.x1, y: fit.y1 }];
	else {
		path = [];
		for (let i = 0; i < fit.points.length; i += 2) path.push({ x: fit.points[i], y: fit.points[i + 1] });
		path.push(path[0]);
	}
	// Straight edges: points every few points of length, so erasing cuts precisely
	const out: number[] = [];
	for (let i = 0; i < path.length; i++) {
		if (i > 0) {
			const a = path[i - 1];
			const b = path[i];
			const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
			for (let k = 1; k < steps; k++) out.push(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps, 0.5);
		}
		out.push(path[i].x, path[i].y, 0.5);
	}
	return new Float32Array(out);
}
