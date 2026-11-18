// Snapping on a page (`snap.ts` of @in-browser/graphics): boxes of items to snap to and to snap with. Targets are the
// page (edges, center) and the shapes and pictures on it – not handwriting, its boxes would only add noise.

import type { Rect, SnapTargets } from '@in-browser/graphics/snap.js';
import { snapTargets } from '@in-browser/graphics/snap.js';
import { isPicture, isShape, isStroke, type Item } from '#lib/model/types.js';
import { boundsOf } from './geometry.js';
import { handlesOf } from './shapes.js';

/** Snap distance in screen pixels */
export const SNAP_PX = 6;

/** The geometric box of an item (without the pen width): what lines up with others */
export function snapBox(item: Item): Rect {
	if (isPicture(item)) return { x: item.x, y: item.y, w: item.w, h: item.h };
	if (isStroke(item)) {
		const b = boundsOf(item.points);
		return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
	}
	const points = handlesOf(item.fit);
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Box around several boxes */
export function unionBox(boxes: Rect[]): Rect {
	const x = Math.min(...boxes.map((b) => b.x));
	const y = Math.min(...boxes.map((b) => b.y));
	return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

/** What to snap to on a page of size `w` × `h`: its edges and center, the shapes and pictures except `exclude` */
export function pageTargets(items: readonly Item[], exclude: ReadonlySet<string>, w: number, h: number): SnapTargets {
	const boxes = items.filter((i) => !exclude.has(i.id) && (isShape(i) || isPicture(i))).map(snapBox);
	return snapTargets(boxes, { x: 0, y: 0, w, h });
}

/** Millimeters of a length in points (labels of equal gaps) */
export const toMm = (pt: number) => Math.round((pt * 25.4) / 72);
