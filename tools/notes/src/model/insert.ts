// Putting pictures on a page: preparing image files for the notebook's assets and placing a new picture.

import type { IconData } from '@in-browser/graphics/icons/types.js';
import { decodeImage } from '@in-browser/ink/render/pictures.js';
import type { IconItem, ImageItem } from './types.js';

/** Image files that can be inserted: extension → type */
const IMAGE_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	bmp: 'image/bmp'
};

export const IMAGE_EXTENSIONS = Object.keys(IMAGE_TYPES).map((ext) => `.${ext}`);

/** Longest side of a stored image (pixels): larger ones are scaled down when inserted (a page needs no more) */
const STORE_MAX = 2560;

/** Size of a newly inserted icon (points) */
const ICON_SIZE = 48;

/** CSS pixels → points: images appear at their natural size (96 dpi) unless they don't fit */
const PX_TO_PT = 72 / 96;

export interface PreparedImage {
	blob: Blob;
	ext: string;
	/** Pixels */
	width: number;
	height: number;
}

const extOf = (type: string) => Object.entries(IMAGE_TYPES).find(([, t]) => t === type)?.[0] ?? null;

/** Checks that an image file can be decoded and scales it down if it is huge; throws if it is no image */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
	const decoded = await decodeImage(file, STORE_MAX);
	const { width, height } = decoded;
	const ext = extOf(file.type);
	if (decoded instanceof ImageBitmap) {
		decoded.close();
		// Small enough and a known type: the original file as it is
		if (ext) return { blob: file, ext, width, height };
	}
	// Scaled down (or an unusual type): stored again, photos as JPEG, everything else as PNG (keeps transparency)
	const canvas = decoded instanceof OffscreenCanvas ? decoded : new OffscreenCanvas(width, height);
	if (!(decoded instanceof OffscreenCanvas)) {
		const bitmap = await createImageBitmap(file);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
		bitmap.close();
	}
	const jpeg = file.type === 'image/jpeg';
	const blob = await canvas.convertToBlob(jpeg ? { type: 'image/jpeg', quality: 0.9 } : { type: 'image/png' });
	return { blob, ext: jpeg ? 'jpg' : 'png', width, height };
}

/**
 * Box of a new picture (points): natural size, scaled down to fit into most of the page, centered at (cx, cy)
 * and kept on the page.
 */
export function placeBox(page: { w: number; h: number }, width: number, height: number, cx: number, cy: number) {
	const k = Math.min(1, (page.w * 0.7) / width, (page.h * 0.5) / height);
	const w = width * k;
	const h = height * k;
	const x = Math.min(Math.max(0, cx - w / 2), page.w - w);
	const y = Math.min(Math.max(0, cy - h / 2), page.h - h);
	return { x, y, w, h };
}

export function imageItem(asset: string, image: PreparedImage, page: { w: number; h: number }, cx: number, cy: number): ImageItem {
	return { id: crypto.randomUUID(), type: 'image', asset, ...placeBox(page, image.width * PX_TO_PT, image.height * PX_TO_PT, cx, cy) };
}

export function iconItem(icon: IconData, color: string, page: { w: number; h: number }, cx: number, cy: number): IconItem {
	const k = ICON_SIZE / Math.max(icon.width, icon.height);
	return { id: crypto.randomUUID(), type: 'icon', icon, color, ...placeBox(page, icon.width * k, icon.height * k, cx, cy) };
}
