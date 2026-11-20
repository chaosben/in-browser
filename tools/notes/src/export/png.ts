// One page as a PNG image: paper, PDF page, strokes and pictures – drawn like on screen, at about 216 dpi.

import { isPicture, type PageMeta } from '#lib/model/types.js';
import { drawPaper } from '#lib/render/paper.js';
import type { ExportSource } from './source.js';

/** Pixels per point (3 = 216 dpi), less for huge pages */
const SCALE = 3;
const MAX_SIDE = 4096;

export async function exportPng(source: ExportSource, page: PageMeta): Promise<Blob> {
	const scene = source.scene(page.id);
	if (!scene) throw new Error('page not loaded');
	const scale = Math.min(SCALE, MAX_SIDE / Math.max(page.w, page.h));
	const canvas = new OffscreenCanvas(Math.round(page.w * scale), Math.round(page.h * scale));
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	drawPaper(ctx, page.paper, page.w, page.h, { x0: 0, y0: 0, x1: page.w, y1: page.h }, scale);
	if (page.background) {
		const pdf = await source.backgrounds.render(page.background.asset, page.background.page, scale);
		ctx.drawImage(pdf, 0, 0, page.w, page.h);
	}
	// Pictures are drawn from the cache: wait until all of them are there
	await Promise.all(scene.items.flatMap((i) => (isPicture(i) ? [source.pictures.load(i)] : [])));
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, page.w, page.h);
	ctx.clip();
	scene.draw(ctx, scene.items);
	ctx.restore();
	return canvas.convertToBlob({ type: 'image/png' });
}
