// Snapping in the preview: edges and centers of the dragged item snap to the canvas edges and center and to the
// edges and centers of the other visible items; moved items also snap to equal spacing between them. All values
// in normalized content coordinates.

import type { Point, Rect } from '#lib/project/types.js';

/** A line to snap to and where it comes from: `box` indexes `SnapTargets.boxes`, `null` is the canvas */
export interface SnapLine {
	at: number;
	box: number | null;
}

/** Vertical (`xs`) and horizontal (`ys`) lines to snap to, and the other items (for equal spacing) */
export interface SnapTargets {
	xs: SnapLine[];
	ys: SnapLine[];
	boxes: Rect[];
}

/** Snap distance per axis */
export interface Tolerance {
	x: number;
	y: number;
}

/** Space between two items along `axis`, from `from` to `to`, drawn across at `at` */
export interface Gap {
	axis: 'x' | 'y';
	from: number;
	to: number;
	at: number;
}

/** Lines snapped to and equal gaps, shown as guides while dragging */
export interface Guides {
	x: SnapLine | null;
	y: SnapLine | null;
	gaps: Gap[];
}

/** Canvas edges and center plus edges and centers of `boxes`; the canvas first, so it wins a tie */
export function snapTargets(boxes: Rect[]): SnapTargets {
	const canvas = (at: number): SnapLine => ({ at, box: null });
	const xs = [0, 0.5, 1].map(canvas);
	const ys = [0, 0.5, 1].map(canvas);
	boxes.forEach((b, box) => {
		xs.push(...[b.x, b.x + b.w / 2, b.x + b.w].map((at) => ({ at, box })));
		ys.push(...[b.y, b.y + b.h / 2, b.y + b.h].map((at) => ({ at, box })));
	});
	return { xs, ys, boxes };
}

/** Closest line to any of the candidates within `tol`: offset to add and the line (`null`: none in reach) */
function nearest(candidates: number[], lines: SnapLine[], tol: number) {
	let offset = 0;
	let line: SnapLine | null = null;
	for (const c of candidates) {
		for (const l of lines) {
			const d = l.at - c;
			if (Math.abs(d) <= tol && (line === null || Math.abs(d) < Math.abs(offset))) {
				offset = d;
				line = l;
			}
		}
	}
	return { offset, line };
}

const AXES = {
	x: { pos: 'x', size: 'w', crossPos: 'y', crossSize: 'h' },
	y: { pos: 'y', size: 'h', crossPos: 'x', crossSize: 'w' }
} as const;

/**
 * Equal spacing along one axis among the items in the same row (column): centered between the neighbors before
 * and after, or as far from a neighbor as two other items in the row are apart. `null`: nothing in reach.
 */
export function snapSpacing(box: Rect, boxes: Rect[], axis: 'x' | 'y', tol: number) {
	const { pos, size, crossPos, crossSize } = AXES[axis];
	const end = (b: Rect) => b[pos] + b[size];
	const row = boxes
		.filter((b) => b[crossPos] < box[crossPos] + box[crossSize] && b[crossPos] + b[crossSize] > box[crossPos])
		.sort((a, b) => a[pos] - b[pos]);
	const pairs: [Rect, Rect][] = [];
	for (let i = 0; i + 1 < row.length; i++) if (row[i + 1][pos] > end(row[i])) pairs.push([row[i], row[i + 1]]);
	const center = box[pos] + box[size] / 2;
	const before = row.filter((b) => end(b) <= center).sort((a, b) => end(b) - end(a))[0];
	const after = row.find((b) => b[pos] >= center);

	// Candidate positions of the box with the gap it gets
	const candidates: { at: number; gap: number }[] = [];
	if (before && after) {
		const at = (end(before) + after[pos] - box[size]) / 2;
		if (at >= end(before)) candidates.push({ at, gap: at - end(before) });
	}
	for (const [a, b] of pairs) {
		const gap = b[pos] - end(a);
		if (before) candidates.push({ at: end(before) + gap, gap });
		if (after) candidates.push({ at: after[pos] - gap - box[size], gap });
	}
	let best: { at: number; gap: number } | null = null;
	for (const c of candidates) {
		if (Math.abs(c.at - box[pos]) <= tol && (!best || Math.abs(c.at - box[pos]) < Math.abs(best.at - box[pos]))) best = c;
	}
	if (!best) return null;

	// Every gap of that size in the row, the new ones next to the box included
	const placed = { ...box, [pos]: best.at };
	const all = [...row, placed].sort((a, b) => a[pos] - b[pos]);
	const across = (a: Rect, b: Rect) => {
		const lo = Math.max(a[crossPos], b[crossPos]);
		const hi = Math.min(a[crossPos] + a[crossSize], b[crossPos] + b[crossSize]);
		return (lo + hi) / 2;
	};
	const gaps: Gap[] = [];
	for (let i = 0; i + 1 < all.length; i++) {
		const [a, b] = [all[i], all[i + 1]];
		if (Math.abs(b[pos] - end(a) - best.gap) < 1e-6) gaps.push({ axis, from: end(a), to: b[pos], at: across(a, b) });
	}
	return { offset: best.at - box[pos], gaps };
}

/**
 * Moved box: left edge, center or right edge (top, middle, bottom) snap to the lines, or the box snaps to equal
 * spacing – per axis whichever is closer. Returns the correction to add.
 */
export function snapMove(box: Rect, targets: SnapTargets, tol: Tolerance) {
	const guides: Guides = { x: null, y: null, gaps: [] };
	const offsets = { x: 0, y: 0 };
	for (const axis of ['x', 'y'] as const) {
		const { pos, size } = AXES[axis];
		const line = nearest([box[pos], box[pos] + box[size] / 2, box[pos] + box[size]], axis === 'x' ? targets.xs : targets.ys, tol[axis]);
		const spacing = snapSpacing(box, targets.boxes, axis, tol[axis]);
		if (spacing && (line.line === null || Math.abs(spacing.offset) < Math.abs(line.offset))) {
			offsets[axis] = spacing.offset;
			guides.gaps.push(...spacing.gaps);
		} else {
			offsets[axis] = line.offset;
			guides[axis] = line.line;
		}
	}
	return { dx: offsets.x, dy: offsets.y, guides };
}

/** A single dragged edge (e.g. the side of a text box) snaps to `lines` */
export function snapLine(v: number, lines: SnapLine[], tol: number) {
	const { offset, line } = nearest([v], lines, tol);
	return { value: v + offset, line };
}

/** A dragged point (corner, end of an arrow) snaps on both axes */
export function snapPoint(p: Point, targets: SnapTargets, tol: Tolerance) {
	const x = nearest([p.x], targets.xs, tol.x);
	const y = nearest([p.y], targets.ys, tol.y);
	return { point: { x: p.x + x.offset, y: p.y + y.offset }, guides: { x: x.line, y: y.line, gaps: [] } };
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
	if (!useX && y.line === null) return { rect: r, guides: { x: null, y: null, gaps: [] } };
	const aspect = r.h / r.w;
	const w = Math.max(useX ? r.w + sx * x.offset : (r.h + sy * y.offset) / aspect, min);
	const h = w * aspect;
	return {
		rect: { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h },
		guides: useX ? { x: x.line, y: null, gaps: [] } : { x: null, y: y.line, gaps: [] }
	};
}
