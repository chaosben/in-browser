// Pixel eraser: cuts the part of a stroke under the eraser out, the rest stays as one or more new strokes.

import type { Stroke } from './items.js';
import { diameter } from './outline.js';

/**
 * Pieces of the stroke outside a circle of radius `r` at (x, y), each as points (x, y, pressure); `null` if the
 * eraser doesn't touch it. Long segments are subdivided first, so the cut follows the circle.
 */
export function eraseFromStroke(s: Stroke, x: number, y: number, r: number): Float32Array[] | null {
	const src = s.points;
	const step = Math.max(0.5, r / 2);
	const pieces: number[][] = [];
	let piece: number[] = [];
	let touched = false;
	const visit = (px: number, py: number, p: number) => {
		const reach = r + diameter(s.tool, s.size, p) / 2;
		if ((px - x) ** 2 + (py - y) ** 2 <= reach * reach) {
			touched = true;
			if (piece.length) pieces.push(piece);
			piece = [];
		} else piece.push(px, py, p);
	};
	visit(src[0], src[1], src[2]);
	for (let i = 3; i < src.length; i += 3) {
		const ax = src[i - 3];
		const ay = src[i - 2];
		const ap = src[i - 1];
		const bx = src[i];
		const by = src[i + 1];
		const bp = src[i + 2];
		const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
		for (let k = 1; k < n; k++) {
			const t = k / n;
			visit(ax + (bx - ax) * t, ay + (by - ay) * t, ap + (bp - ap) * t);
		}
		visit(bx, by, bp);
	}
	if (!touched) return null;
	if (piece.length) pieces.push(piece);
	// Single points left at the edge of the cut would show as dots
	return pieces.filter((p) => p.length >= 6).map((p) => new Float32Array(p));
}
