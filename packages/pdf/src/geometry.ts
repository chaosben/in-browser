// Where things of a PDF page lie: PDF user space (y up, origin at the page's box) ↔ the page as shown (points, y down,
// origin top left, its rotation applied) – the same transform as PDF.js's viewport at scale 1, without needing the
// document (e.g. to write annotations after it was closed).

/** [a, b, c, d, e, f]: user space → shown */
export type Matrix = [number, number, number, number, number, number];

/** The transform of a page with box `view` ([x0, y0, x1, y1], PDF.js `page.view`) shown turned by `rotation` degrees */
export function pageTransform(view: readonly number[], rotation: number): Matrix {
	const [x0, y0, x1, y1] = view;
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	const r = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
	const [a, b, c, d] = r === 90 ? [0, 1, 1, 0] : r === 180 ? [-1, 0, 0, 1] : r === 270 ? [0, -1, -1, 0] : [1, 0, 0, -1];
	const [ox, oy] = a === 0 ? [Math.abs(cy - y0), Math.abs(cx - x0)] : [Math.abs(cx - x0), Math.abs(cy - y0)];
	return [a, b, c, d, ox - a * cx - c * cy, oy - b * cx - d * cy];
}

/** Shown → user space */
export function toUserSpace([a, b, c, d, e, f]: Matrix): (x: number, y: number) => [number, number] {
	const det = a * d - b * c;
	return (x, y) => {
		const px = x - e;
		const py = y - f;
		return [(d * px - c * py) / det, (a * py - b * px) / det];
	};
}

/** User space → shown */
export function toShown([a, b, c, d, e, f]: Matrix): (x: number, y: number) => [number, number] {
	return (x, y) => [a * x + c * y + e, b * x + d * y + f];
}
