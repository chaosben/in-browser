// Pure geometry of the preview's editing handles, in normalized canvas coordinates (0…1)

import type { CropHandle } from './crop.js';
import type { Point, Rect } from './types.js';

export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

/** Smallest side of a freely resized rect */
const MIN_SIZE = 0.01;
/** Smallest zoom view (10× zoom) */
const MIN_ZOOM = 0.1;

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Direction of a corner: 1 towards east/south, -1 towards west/north */
export const sign = (corner: Corner, towards: 'e' | 's'): 1 | -1 => (corner.includes(towards) ? 1 : -1);

/** Position of a corner of `r` */
export function cornerPoint(r: Rect, corner: Corner): Point {
	return { x: corner.includes('w') ? r.x : r.x + r.w, y: corner.includes('n') ? r.y : r.y + r.h };
}

/** `r` grown around its center to at least `min` per side (click areas of thin lines) */
export function padded(r: Rect, min: number): Rect {
	const padX = Math.max(0, min - r.w) / 2;
	const padY = Math.max(0, min - r.h) / 2;
	return { x: r.x - padX, y: r.y - padY, w: r.w + 2 * padX, h: r.h + 2 * padY };
}

/** Move a corner of a rect, the opposite corner stays fixed. */
export function resized(r: Rect, corner: Corner, dx: number, dy: number): Rect {
	let x1 = r.x;
	let y1 = r.y;
	let x2 = r.x + r.w;
	let y2 = r.y + r.h;
	if (corner.includes('w')) x1 += dx;
	else x2 += dx;
	if (corner.includes('n')) y1 += dy;
	else y2 += dy;
	return {
		x: Math.min(x1, x2),
		y: Math.min(y1, y2),
		w: Math.max(Math.abs(x2 - x1), MIN_SIZE),
		h: Math.max(Math.abs(y2 - y1), MIN_SIZE)
	};
}

/** Move a corner keeping the aspect ratio (clips, images, icons); the opposite corner stays fixed */
export function resizedKeepingAspect(r: Rect, corner: Corner, dx: number, dy: number, min = 0.05): Rect {
	const aspect = r.h / r.w;
	const sx = sign(corner, 'e');
	const sy = sign(corner, 's');
	const ax = sx > 0 ? r.x : r.x + r.w;
	const ay = sy > 0 ? r.y : r.y + r.h;
	const w = Math.max((r.w + sx * dx + (r.h + sy * dy) / aspect) / 2, min);
	const h = w * aspect;
	return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
}

/** Square zoom view with a dragged corner: the opposite corner stays, the view stays within the frame */
export function resizedZoom(r: Rect, corner: Corner, dx: number, dy: number): Rect {
	const sx = sign(corner, 'e');
	const sy = sign(corner, 's');
	const ax = sx > 0 ? r.x : r.x + r.w;
	const ay = sy > 0 ? r.y : r.y + r.h;
	const maxW = Math.min(sx > 0 ? 1 - ax : ax, sy > 0 ? 1 - ay : ay);
	const w = clamp(r.w + (sx * dx + sy * dy) / 2, MIN_ZOOM, maxW);
	return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - w, w, h: w };
}

/** Zoom view moved back into the frame */
export function clampZoomRect(r: Rect): Rect {
	return { ...r, x: clamp(r.x, 0, 1 - r.w), y: clamp(r.y, 0, 1 - r.h) };
}

/** Square zoom view of side `size` centered on (`cx`, `cy`), moved into the frame */
export function zoomRectAt(cx: number, cy: number, size: number): Rect {
	return clampZoomRect({ x: cx - size / 2, y: cy - size / 2, w: size, h: size });
}

/** Crop handles: corners, then the middle of each side */
export const CROP_HANDLES: { handle: CropHandle; at: (r: Rect) => [number, number] }[] = [
	{ handle: 'nw', at: (r) => [r.x, r.y] },
	{ handle: 'ne', at: (r) => [r.x + r.w, r.y] },
	{ handle: 'sw', at: (r) => [r.x, r.y + r.h] },
	{ handle: 'se', at: (r) => [r.x + r.w, r.y + r.h] },
	{ handle: 'n', at: (r) => [r.x + r.w / 2, r.y] },
	{ handle: 's', at: (r) => [r.x + r.w / 2, r.y + r.h] },
	{ handle: 'w', at: (r) => [r.x, r.y + r.h / 2] },
	{ handle: 'e', at: (r) => [r.x + r.w, r.y + r.h / 2] }
];
