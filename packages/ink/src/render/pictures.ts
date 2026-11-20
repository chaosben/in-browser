// Decoded pictures of a notebook for drawing: images from `assets/` (as bitmaps, at most MAX_SIDE pixels on their
// longer side – enough for a page, and memory stays bounded) and icons (SVG images in their color, so they stay sharp
// at every zoom). Loading is asynchronous: until a picture is there, a placeholder is drawn and `loaded` reports
// when it arrived (the tiles showing it are then rendered again).

import { iconSvg } from '@in-browser/graphics/icons/types.js';
import type { Picture } from '../items.js';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Longest side of a decoded image (pixels) */
const MAX_SIDE = 2048;

export interface PictureSource {
	/** The decoded picture, or null while it loads (loading starts here) or when it failed */
	get(p: Picture): CanvasImageSource | null;
}

interface Entry {
	image: CanvasImageSource | null;
	failed: boolean;
	done: Promise<void>;
}

export const pictureKey = (p: Picture) => (p.type === 'image' ? `image:${p.asset}` : `icon:${p.color}:${p.icon.body}`);

/** Decodes an image file; scaled down to `max` pixels on its longer side */
export async function decodeImage(blob: Blob, max = MAX_SIDE): Promise<ImageBitmap | OffscreenCanvas> {
	const bitmap = await createImageBitmap(blob);
	const k = max / Math.max(bitmap.width, bitmap.height);
	if (k >= 1) return bitmap;
	const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * k)), Math.max(1, Math.round(bitmap.height * k)));
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return canvas;
}

async function loadSvg(svg: string): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		return img;
	} finally {
		URL.revokeObjectURL(url);
	}
}

export class PictureCache implements PictureSource {
	private readonly entries = new Map<string, Entry>();

	constructor(
		/** Content of an asset file */
		private readonly readAsset: (name: string) => Promise<Blob>,
		/** A picture finished loading (or failed): redraw where it is used */
		private readonly loaded: (key: string) => void
	) {}

	get(p: Picture): CanvasImageSource | null {
		return this.entry(p).image;
	}

	/** The picture once it is loaded (null if it failed) */
	async load(p: Picture): Promise<CanvasImageSource | null> {
		const entry = this.entry(p);
		await entry.done;
		return entry.image;
	}

	private entry(p: Picture): Entry {
		const key = pictureKey(p);
		let entry = this.entries.get(key);
		if (!entry) {
			const load = p.type === 'image' ? this.readAsset(p.asset).then((blob) => decodeImage(blob)) : loadSvg(iconSvg(p.icon, p.color));
			const e: Entry = { image: null, failed: false, done: Promise.resolve() };
			e.done = load
				.then((image) => {
					e.image = image;
				})
				.catch((err) => {
					console.error('[notes] picture', key.slice(0, 80), err);
					e.failed = true;
				})
				.finally(() => this.loaded(key));
			this.entries.set(key, (entry = e));
		}
		return entry;
	}

	/** Frees the decoded images */
	destroy() {
		for (const { image } of this.entries.values()) if (image instanceof ImageBitmap) image.close();
		this.entries.clear();
	}
}

/** Draws a picture into its box (page points); a placeholder while it loads */
export function drawPicture(ctx: Ctx, p: Picture, source: PictureSource | null) {
	const image = source?.get(p) ?? null;
	if (image) {
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(image, p.x, p.y, p.w, p.h);
		return;
	}
	if (p.type === 'icon') return;
	ctx.fillStyle = 'rgba(100, 116, 139, 0.12)';
	ctx.fillRect(p.x, p.y, p.w, p.h);
}
