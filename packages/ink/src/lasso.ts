// Selection on vector data: which items a drawn loop encloses, and moving/scaling them.

import { isStroke, type Item, type ShapeItem, type Stroke } from './items.js';
import { inkPoints, transformFit } from './shapes.js';

/** Is (x, y) inside the polygon (x, y pairs)? Even-odd rule, the loop closes itself */
export function pointInPolygon(x: number, y: number, poly: ArrayLike<number>): boolean {
	let inside = false;
	const n = poly.length;
	for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
		const xi = poly[i];
		const yi = poly[i + 1];
		const xj = poly[j];
		const yj = poly[j + 1];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/** A stroke or shape with at least half of its points inside the loop */
export function inLasso(s: Item, poly: ArrayLike<number>): boolean {
	const pts = inkPoints(s);
	let inside = 0;
	const n = pts.length / 3;
	for (let i = 0; i < pts.length; i += 3) if (pointInPolygon(pts[i], pts[i + 1], poly)) inside++;
	return inside * 2 >= n;
}

/** The items a loop selects (`inLasso`) */
export function itemsInLasso(items: Iterable<Item>, poly: ArrayLike<number>): Item[] {
	if (poly.length < 6) return [];
	const found: Item[] = [];
	for (const s of items) if (inLasso(s, poly)) found.push(s);
	return found;
}

/** Move by (dx, dy) after scaling by `scale` around (ox, oy) */
export interface Transform {
	dx: number;
	dy: number;
	scale: number;
	ox: number;
	oy: number;
	/** Scales what sizes itself too (a text box's font; K held) */
	scaleText?: boolean;
}

export const IDENTITY: Transform = { dx: 0, dy: 0, scale: 1, ox: 0, oy: 0 };

export const isIdentity = (t: Transform) => t.dx === 0 && t.dy === 0 && t.scale === 1;

/** The stroke moved/scaled: new points, the width scaled along */
export function transformStroke(s: Stroke, t: Transform): Stroke {
	const points = new Float32Array(s.points.length);
	for (let i = 0; i < s.points.length; i += 3) {
		points[i] = t.ox + (s.points[i] - t.ox) * t.scale + t.dx;
		points[i + 1] = t.oy + (s.points[i + 1] - t.oy) * t.scale + t.dy;
		points[i + 2] = s.points[i + 2];
	}
	return { ...s, size: s.size * t.scale, points };
}

/** Any item moved/scaled */
export function transformItem<T extends Item>(item: T, t: Transform): T {
	if (isStroke(item)) return transformStroke(item, t) as T;
	const shape = item as T & ShapeItem;
	return { ...shape, fit: transformFit(shape.fit, t), size: shape.size * t.scale };
}

/**
 * The item on a page of `w` × `h` points turned with the page by `quarters` quarter turns clockwise (the page is
 * then `h` × `w` for odd turns). Exact for strokes and every shape (boxes stay axis-parallel).
 */
export function rotateItem<T extends Item>(item: T, quarters: number, w: number, h: number): T {
	const q = ((quarters % 4) + 4) % 4;
	if (!q) return item;
	const turn = (x: number, y: number): [number, number] => (q === 1 ? [h - y, x] : q === 2 ? [w - x, h - y] : [y, w - x]);
	const box = (x: number, y: number, bw: number, bh: number) => {
		const [ax, ay] = turn(x, y);
		const [bx, by] = turn(x + bw, y + bh);
		return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
	};
	if (isStroke(item)) {
		const points = new Float32Array(item.points.length);
		for (let i = 0; i < points.length; i += 3) {
			[points[i], points[i + 1]] = turn(item.points[i], item.points[i + 1]);
			points[i + 2] = item.points[i + 2];
		}
		return { ...item, points };
	}
	{
		const fit = (item as T & ShapeItem).fit;
		switch (fit.kind) {
			case 'line': {
				const [x0, y0] = turn(fit.x0, fit.y0);
				const [x1, y1] = turn(fit.x1, fit.y1);
				return { ...item, fit: { ...fit, x0, y0, x1, y1 } };
			}
			case 'polyline':
			case 'polygon': {
				const points: number[] = [];
				for (let i = 0; i < fit.points.length; i += 2) points.push(...turn(fit.points[i], fit.points[i + 1]));
				return { ...item, fit: { ...fit, points } };
			}
			default:
				return { ...item, fit: { ...fit, ...box(fit.x, fit.y, fit.w, fit.h) } };
		}
	}
}
