// Selection on vector data: which items a drawn loop encloses, and moving/scaling them.

import { isInk, isShape, isStroke, type Item, type Stroke } from '#lib/model/types.js';
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

/** Strokes with at least half of their points inside the loop, pictures with their center inside */
export function itemsInLasso(items: Iterable<Item>, poly: ArrayLike<number>): Item[] {
	if (poly.length < 6) return [];
	const found: Item[] = [];
	for (const s of items) {
		if (!isInk(s)) {
			if (pointInPolygon(s.x + s.w / 2, s.y + s.h / 2, poly)) found.push(s);
			continue;
		}
		const pts = inkPoints(s);
		let inside = 0;
		const n = pts.length / 3;
		for (let i = 0; i < pts.length; i += 3) if (pointInPolygon(pts[i], pts[i + 1], poly)) inside++;
		if (inside * 2 >= n) found.push(s);
	}
	return found;
}

/** Move by (dx, dy) after scaling by `scale` around (ox, oy) */
export interface Transform {
	dx: number;
	dy: number;
	scale: number;
	ox: number;
	oy: number;
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
	if (isShape(item)) return { ...item, fit: transformFit(item.fit, t), size: item.size * t.scale };
	return { ...item, x: t.ox + (item.x - t.ox) * t.scale + t.dx, y: t.oy + (item.y - t.oy) * t.scale + t.dy, w: item.w * t.scale, h: item.h * t.scale };
}
