// Snapping in the preview: edges and centers of the dragged item snap to the canvas edges and center and to the
// edges and centers of the other visible items. All values in normalized content coordinates.

import type { Point, Rect } from '#lib/project/types.js';

/** Vertical (`xs`) and horizontal (`ys`) lines to snap to */
export interface SnapTargets {
	xs: number[];
	ys: number[];
}

/** Snap distance per axis */
export interface Tolerance {
	x: number;
	y: number;
}

/** Lines snapped to, shown as guides while dragging */
export interface Guides {
	x: number | null;
	y: number | null;
}

/** Canvas edges and center plus edges and centers of `boxes` */
export function snapTargets(boxes: Rect[]): SnapTargets {
	const xs = [0, 0.5, 1];
	const ys = [0, 0.5, 1];
	for (const b of boxes) {
		xs.push(b.x, b.x + b.w / 2, b.x + b.w);
		ys.push(b.y, b.y + b.h / 2, b.y + b.h);
	}
	return { xs, ys };
}

/** Closest line to any of the candidates within `tol`: offset to add and the line (`null`: none in reach) */
function nearest(candidates: number[], lines: number[], tol: number) {
	let offset = 0;
	let line: number | null = null;
	for (const c of candidates) {
		for (const l of lines) {
			const d = l - c;
			if (Math.abs(d) <= tol && (line === null || Math.abs(d) < Math.abs(offset))) {
				offset = d;
				line = l;
			}
		}
	}
	return { offset, line };
}

/** Moved box: left edge, center or right edge (top, middle, bottom) snap; returns the correction to add */
export function snapMove(box: Rect, targets: SnapTargets, tol: Tolerance) {
	const x = nearest([box.x, box.x + box.w / 2, box.x + box.w], targets.xs, tol.x);
	const y = nearest([box.y, box.y + box.h / 2, box.y + box.h], targets.ys, tol.y);
	return { dx: x.offset, dy: y.offset, guides: { x: x.line, y: y.line } };
}

/** A single dragged edge (e.g. the side of a text box) snaps to `lines` */
export function snapLine(v: number, lines: number[], tol: number) {
	const { offset, line } = nearest([v], lines, tol);
	return { value: v + offset, line };
}

/** A dragged point (corner, end of an arrow) snaps on both axes */
export function snapPoint(p: Point, targets: SnapTargets, tol: Tolerance) {
	const x = nearest([p.x], targets.xs, tol.x);
	const y = nearest([p.y], targets.ys, tol.y);
	return { point: { x: p.x + x.offset, y: p.y + y.offset }, guides: { x: x.line, y: y.line } };
}

/**
 * Rect resized at a corner with a fixed aspect ratio (`sx`/`sy`: direction of the dragged corner, the opposite
 * corner stays): the closer of the two moved edges snaps, the other follows the aspect ratio.
 */
export function snapAspect(r: Rect, sx: 1 | -1, sy: 1 | -1, targets: SnapTargets, tol: Tolerance, min: number) {
	const ax = sx > 0 ? r.x : r.x + r.w;
	const ay = sy > 0 ? r.y : r.y + r.h;
	const x = nearest([sx > 0 ? r.x + r.w : r.x], targets.xs, tol.x);
	const y = nearest([sy > 0 ? r.y + r.h : r.y], targets.ys, tol.y);
	const useX = x.line !== null && (y.line === null || Math.abs(x.offset) <= Math.abs(y.offset));
	if (!useX && y.line === null) return { rect: r, guides: { x: null, y: null } };
	const aspect = r.h / r.w;
	const w = Math.max(useX ? r.w + sx * x.offset : (r.h + sy * y.offset) / aspect, min);
	const h = w * aspect;
	return {
		rect: { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h },
		guides: useX ? { x: x.line, y: null } : { x: null, y: y.line }
	};
}
