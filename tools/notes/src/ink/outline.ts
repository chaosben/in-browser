// Final shape of a stroke – exactly what was painted while drawing (`render/stage.ts`): every segment a straight
// piece with round ends, as wide as the pressure at its end point; the first point a dot. All of it goes into one
// Path2D (rectangles and circles of the same winding, filled with the nonzero rule = their union), so a stroke is one
// fill and see-through ink doesn't get darker where the pieces overlap. Nothing is smoothed or simplified here:
// smoothing happens while drawing (`smooth.ts`). Computed once per stroke when finished or loaded.

import type { InkTool, Stroke } from '#lib/model/types.js';

/** How much the pressure changes the width (0: constant) */
const THINNING: Record<InkTool, number> = { pen: 0.6, highlighter: 0 };

/** Diameter at a pressure: `size` at medium pressure, thinner when lighter, up to 1.6 × when pressed hard */
export function diameter(tool: InkTool, size: number, pressure: number): number {
	return 2 * size * (0.5 - THINNING[tool] * (0.5 - pressure));
}

/** Opacity of the ink: highlighters are see-through */
export const inkAlpha = (tool: InkTool) => (tool === 'highlighter' ? 0.35 : 1);

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
