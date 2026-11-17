// Geometry on page items in page points: bounding boxes, distances, hit tests and a grid index for fast lookups.

import { isStroke, type Item, type Picture, type Stroke } from '#lib/model/types.js';

export interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** Bounding box of the points, grown by `pad` */
export function boundsOf(points: Float32Array, pad = 0): Box {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (let i = 0; i < points.length; i += 3) {
		const x = points[i];
		const y = points[i + 1];
		if (x < x0) x0 = x;
		if (x > x1) x1 = x;
		if (y < y0) y0 = y;
		if (y > y1) y1 = y;
	}
	return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Box of a stroke including its width (pressure can't make it wider than `size`) */
export const strokeBounds = (s: Stroke): Box => boundsOf(s.points, s.size / 2 + 1);

/** Box of a picture */
export const pictureBounds = (p: Picture): Box => ({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h });

export const itemBounds = (i: Item): Box => (isStroke(i) ? strokeBounds(i) : pictureBounds(i));

export const intersects = (a: Box, b: Box) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;

export function union(a: Box | null, b: Box): Box {
	if (!a) return { ...b };
	return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** Squared distance from (px, py) to the segment (ax, ay)–(bx, by) */
export function segmentDistance2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
	t = t < 0 ? 0 : t > 1 ? 1 : t;
	const ex = ax + t * dx - px;
	const ey = ay + t * dy - py;
	return ex * ex + ey * ey;
}

/** Does a circle of `radius` at (x, y) touch the stroke (its line, including half its width)? */
export function hitsStroke(s: Stroke, x: number, y: number, radius: number): boolean {
	const r = radius + s.size / 2;
	const r2 = r * r;
	const pts = s.points;
	if (pts.length === 3) return (pts[0] - x) ** 2 + (pts[1] - y) ** 2 <= r2;
	for (let i = 3; i < pts.length; i += 3) {
		if (segmentDistance2(x, y, pts[i - 3], pts[i - 2], pts[i], pts[i + 1]) <= r2) return true;
	}
	return false;
}

/**
 * Uniform grid over a page: each cell knows the strokes whose box touches it. Lookups for a region (rendering a
 * tile, erasing) only look at the strokes there instead of all of them.
 */
export class GridIndex<T extends { id: string }> {
	private cells = new Map<number, Set<T>>();
	private boxes = new Map<string, Box>();

	constructor(private readonly cell = 64) {}

	private key = (cx: number, cy: number) => cx * 65536 + cy;

	private each(box: Box, fn: (key: number) => void) {
		const c = this.cell;
		const cx0 = Math.max(0, Math.floor(box.x0 / c));
		const cy0 = Math.max(0, Math.floor(box.y0 / c));
		const cx1 = Math.max(0, Math.floor(box.x1 / c));
		const cy1 = Math.max(0, Math.floor(box.y1 / c));
		for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) fn(this.key(cx, cy));
	}

	add(item: T, box: Box) {
		this.boxes.set(item.id, box);
		this.each(box, (k) => {
			let set = this.cells.get(k);
			if (!set) this.cells.set(k, (set = new Set()));
			set.add(item);
		});
	}

	remove(item: T) {
		const box = this.boxes.get(item.id);
		if (!box) return;
		this.boxes.delete(item.id);
		this.each(box, (k) => this.cells.get(k)?.delete(item));
	}

	box(id: string): Box | undefined {
		return this.boxes.get(id);
	}

	/** Items whose box intersects `box` (each once, unordered) */
	query(box: Box): Set<T> {
		const found = new Set<T>();
		this.each(box, (k) => {
			const set = this.cells.get(k);
			if (set) for (const item of set) if (intersects(this.boxes.get(item.id)!, box)) found.add(item);
		});
		return found;
	}

	clear() {
		this.cells.clear();
		this.boxes.clear();
	}
}
