// Final shape of a stroke – exactly what was painted while drawing (`render/stage.ts`): every segment a straight
// piece with round ends, as wide as the pressure at its end point; the first point a dot. All of it goes into one
// Path2D (rectangles and circles of the same winding, filled with the nonzero rule = their union), so a stroke is one
// fill and see-through ink doesn't get darker where the pieces overlap. Nothing is smoothed or simplified here:
// smoothing happens while drawing (`smooth.ts`). Computed once per stroke when finished or loaded.

import type { Ink, InkTool, Stroke } from './items.js';
import { inkStrokes } from './shapes.js';

/** How much the pressure changes the width (0: constant) */
const THINNING: Record<InkTool, number> = { pen: 0.6, highlighter: 0 };

/** Diameter at a pressure: `size` at medium pressure, thinner when lighter, up to 1.6 × when pressed hard */
export function diameter(tool: InkTool, size: number, pressure: number): number {
	return 2 * size * (0.5 - THINNING[tool] * (0.5 - pressure));
}

/** Opacity of a highlighter whose color has none of its own */
const HIGHLIGHTER_ALPHA = 0.35;

/** Opacity of ink: the color's own (`#rrggbbaa`), else highlighters see-through, pens opaque */
export function inkAlpha(tool: InkTool, color?: string): number {
	if (color?.length === 9) return parseInt(color.slice(7, 9), 16) / 255;
	return tool === 'highlighter' ? HIGHLIGHTER_ALPHA : 1;
}

/** The color as it looks, with its opacity (`#rrggbbaa` for see-through ink) – what color fields show */
export function inkColor(tool: InkTool, color: string): string {
	if (color.length === 9) return color;
	return tool === 'highlighter' ? color + Math.round(HIGHLIGHTER_ALPHA * 255).toString(16).padStart(2, '0') : color;
}

function dot(path: Path2D, x: number, y: number, r: number) {
	path.moveTo(x + r, y);
	path.arc(x, y, r, 0, Math.PI * 2);
}

export function pathOf(s: Stroke): Path2D {
	const path = new Path2D();
	const pts = s.points;
	if (pts.length < 3) return path;
	dot(path, pts[0], pts[1], diameter(s.tool, s.size, pts[2]) / 2);
	for (let i = 3; i < pts.length; i += 3) {
		const ax = pts[i - 3];
		const ay = pts[i - 2];
		const bx = pts[i];
		const by = pts[i + 1];
		const r = diameter(s.tool, s.size, pts[i + 2]) / 2;
		const len = Math.hypot(bx - ax, by - ay);
		if (len > 0) {
			// Normal of the segment; corners in the same turning direction as `arc` (else the union gets holes)
			const nx = (-(by - ay) / len) * r;
			const ny = ((bx - ax) / len) * r;
			path.moveTo(ax - nx, ay - ny);
			path.lineTo(bx - nx, by - ny);
			path.lineTo(bx + nx, by + ny);
			path.lineTo(ax + nx, ay + ny);
			path.closePath();
			dot(path, ax, ay, r);
		}
		dot(path, bx, by, r);
	}
	return path;
}

/** Outline of an ink item: a stroke's, or the union of a shape's strokes (dashes, edges, arrowheads) */
export function inkPath(item: Ink): Path2D {
	const strokes = inkStrokes(item);
	if (strokes.length === 1) return pathOf(strokes[0]);
	const path = new Path2D();
	for (const s of strokes) path.addPath(pathOf(s));
	return path;
}
