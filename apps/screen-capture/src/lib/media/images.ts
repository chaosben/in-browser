// Own images (PNG, JPEG, WebP, GIF, SVG): stored unchanged in the project's media folder and listed in
// `Project.images`; on the timeline they are `image` annotations.

import { newId, type ImageAsset } from '#lib/project/types.js';
import { mediaWritable } from '#lib/storage/opfs.js';
import { m } from '#lib/i18n/index.js';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg';
const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif|svg\+xml)$|\.(png|jpe?g|webp|gif|svg)$/i;

export const isImageFile = (f: File) => IMAGE_TYPES.test(f.type) || IMAGE_TYPES.test(f.name);

const isSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

/** Default size of SVGs without own dimensions (longer side) */
const SVG_SIZE = 512;

/** Size of an SVG from its `width`/`height` (pixels) or its `viewBox`; `null` if neither is usable */
export function svgSize(text: string): { width: number; height: number } | null {
	const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
	if (!tag) return null;
	const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i').exec(tag)?.[1];
	const width = Number(attr('width'));
	const height = Number(attr('height'));
	if (width > 0 && height > 0) return { width, height };
	const box = /\sviewBox\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1].trim().split(/[\s,]+/).map(Number);
	if (!box || box.length !== 4 || !(box[2] > 0) || !(box[3] > 0)) return null;
	const scale = SVG_SIZE / Math.max(box[2], box[3]);
	return { width: Math.round(box[2] * scale), height: Math.round(box[3] * scale) };
}

async function imageSize(file: File): Promise<{ width: number; height: number }> {
	if (isSvg(file)) {
		const size = svgSize(await file.text());
		if (size) return size;
	}
	const bitmap = await createImageBitmap(file).catch(() => null);
	if (!bitmap) throw new Error(m.errors.unsupportedImage(file.name));
	const size = { width: bitmap.width, height: bitmap.height };
	bitmap.close();
	return size;
}

/** Stores an image file in the project (unchanged) */
export async function importImage(projectId: string, file: File): Promise<ImageAsset> {
	const { width, height } = await imageSize(file);
	const id = newId();
	const ext = /\.(\w+)$/.exec(file.name)?.[1].toLowerCase() ?? (isSvg(file) ? 'svg' : 'png');
	const fileName = `${id}.${ext}`;
	await file.stream().pipeTo(await mediaWritable(projectId, fileName));
	return { id, file: fileName, name: file.name.replace(/\.\w+$/, ''), width, height };
}
