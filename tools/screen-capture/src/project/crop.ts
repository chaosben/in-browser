// Cropping a clip: `clip.crop` is the visible part of its source as fractions (0…1) of the source's used area,
// `clip.rect` the frame of that visible part on the canvas. Cropping keeps the content in place: the frame of
// the whole source (`fullRect`) stays, only the visible part changes.

import type { Rect, Source } from './types.js';

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** Edge or corner dragged while cropping */
export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Crop in source pixels from each edge (number fields) */
export interface CropInsets {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

type Size = Pick<Source, 'width' | 'height'>;

/** Smallest crop: 16 source pixels per side */
const MIN_PX = 16;

/** Frame of the whole source on the canvas for a clip showing `crop` of it in `rect` */
export function fullRect(rect: Rect, crop: Rect = FULL): Rect {
	const w = rect.w / crop.w;
	const h = rect.h / crop.h;
	return { x: rect.x - crop.x * w, y: rect.y - crop.y * h, w, h };
}

/** Frame of the visible part on the canvas, from the frame of the whole source */
export function croppedRect(full: Rect, crop: Rect = FULL): Rect {
	return { x: full.x + crop.x * full.w, y: full.y + crop.y * full.h, w: crop.w * full.w, h: crop.h * full.h };
}

/** Pixel size of the visible part (for “Fit”/“Fill”) */
export function croppedSize(source: Size, crop: Rect = FULL): Size {
	return { width: source.width * crop.w, height: source.height * crop.h };
}

/** `undefined` for the whole source, so uncropped clips carry no field */
export function cleanCrop(crop: Rect): Rect | undefined {
	const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
	return near(crop.x, 0) && near(crop.y, 0) && near(crop.w, 1) && near(crop.h, 1) ? undefined : crop;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Moves the edges of `handle` by `dx`/`dy` (canvas fractions) within the source; `full`: frame of the whole source */
export function dragCrop(crop: Rect, handle: CropHandle, dx: number, dy: number, full: Rect, source: Size): Rect {
	const minW = Math.min(1, MIN_PX / source.width);
	const minH = Math.min(1, MIN_PX / source.height);
	let x0 = crop.x;
	let y0 = crop.y;
	let x1 = crop.x + crop.w;
	let y1 = crop.y + crop.h;
	if (handle.includes('w')) x0 = clamp(x0 + dx / full.w, 0, x1 - minW);
	if (handle.includes('e')) x1 = clamp(x1 + dx / full.w, x0 + minW, 1);
	if (handle.includes('n')) y0 = clamp(y0 + dy / full.h, 0, y1 - minH);
	if (handle.includes('s')) y1 = clamp(y1 + dy / full.h, y0 + minH, 1);
	return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function cropInsets(source: Size, crop: Rect = FULL): CropInsets {
	return {
		left: Math.round(crop.x * source.width),
		top: Math.round(crop.y * source.height),
		right: Math.round((1 - crop.x - crop.w) * source.width),
		bottom: Math.round((1 - crop.y - crop.h) * source.height)
	};
}

/** Crop from pixel insets; an inset that leaves too little is limited */
export function insetsCrop(source: Size, insets: CropInsets): Rect {
	const { width: W, height: H } = source;
	const left = clamp(insets.left, 0, W - MIN_PX);
	const top = clamp(insets.top, 0, H - MIN_PX);
	const right = clamp(insets.right, 0, W - MIN_PX - left);
	const bottom = clamp(insets.bottom, 0, H - MIN_PX - top);
	return { x: left / W, y: top / H, w: (W - left - right) / W, h: (H - top - bottom) / H };
}
