import { describe, expect, it } from 'vitest';
import { prepareImage } from '#lib/model/insert.js';
import type { IconItem, ImageItem } from '#lib/model/types.js';
import { drawPicture, PictureCache } from './pictures';

// Decoding and drawing pictures in real Chromium

async function png(width: number, height: number, color = '#00ff00'): Promise<Blob> {
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, width, height);
	return canvas.convertToBlob({ type: 'image/png' });
}

function pixel(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number) {
	return [...ctx.getImageData(x, y, 1, 1).data];
}

describe('inserting images', () => {
	it('keeps small images as they are', async () => {
		const blob = await png(40, 20);
		const image = await prepareImage(new File([blob], 'a.png', { type: 'image/png' }));
		expect(image).toMatchObject({ ext: 'png', width: 40, height: 20 });
		expect(image.blob.size).toBe(blob.size);
	});
	it('scales huge images down', async () => {
		const image = await prepareImage(new File([await png(3000, 1000)], 'big.png', { type: 'image/png' }));
		expect(image).toMatchObject({ ext: 'png', width: 2560, height: 853 });
	});
	it('rejects what is no image', async () => {
		await expect(prepareImage(new File(['hello'], 'a.png', { type: 'image/png' }))).rejects.toThrow();
	});
});

describe('picture cache', () => {
	it('loads images and icons once and reports them', async () => {
		const blob = await png(10, 10, '#0000ff');
		const loaded: string[] = [];
		let reads = 0;
		let arrived = () => {};
		const both = new Promise<void>((resolve) => (arrived = resolve));
		const cache = new PictureCache(
			async () => {
				reads++;
				return blob;
			},
			(key) => {
				loaded.push(key.split(':')[0]);
				if (loaded.length === 2) arrived();
			}
		);
		const image: ImageItem = { id: 'i', type: 'image', asset: 'a.png', x: 0, y: 0, w: 10, h: 10 };
		const icon: IconItem = {
			id: 'c',
			type: 'icon',
			icon: { name: 'box', body: '<path fill="currentColor" d="M0 0h24v24H0z"/>', width: 24, height: 24 },
			color: '#ff0000',
			x: 10,
			y: 0,
			w: 10,
			h: 10
		};
		expect(cache.get(image)).toBeNull();
		expect(cache.get(icon)).toBeNull();
		cache.get(image);
		await both;
		expect(reads).toBe(1);
		expect(loaded.sort()).toEqual(['icon', 'image']);

		const ctx = new OffscreenCanvas(20, 10).getContext('2d')!;
		drawPicture(ctx, image, cache);
		drawPicture(ctx, icon, cache);
		expect(pixel(ctx, 5, 5)).toEqual([0, 0, 255, 255]);
		expect(pixel(ctx, 15, 5)).toEqual([255, 0, 0, 255]);
		cache.destroy();
	});
});
