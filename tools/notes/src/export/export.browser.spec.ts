import { describe, expect, it } from 'vitest';
import { degrees, PDFDocument, rgb } from 'pdf-lib';
import type { ImageItem, PageMeta, ShapeItem, Stroke } from '#lib/model/types.js';
import { PdfBackgrounds } from '#lib/render/backgrounds.js';
import { readPdfPages } from '#lib/render/pdf.js';
import { PictureCache } from '#lib/render/pictures.js';
import { PageScene } from '#lib/render/scene.js';
import { exportPdf } from './pdf';
import { exportPng } from './png';
import type { ExportSource } from './source';

// Exports in real Chromium, checked by rendering the result again

/** Page 1: 200×100 pt, left half red; page 2 the same, rotated by 90° (shown 100×200, top half red) */
async function sourcePdf(): Promise<Blob> {
	const doc = await PDFDocument.create();
	for (const rotate of [0, 90]) {
		const page = doc.addPage([200, 100]);
		page.drawRectangle({ x: 0, y: 0, width: 100, height: 100, color: rgb(1, 0, 0) });
		page.setRotation(degrees(rotate));
	}
	return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });
}

async function greenPng(): Promise<Blob> {
	const canvas = new OffscreenCanvas(10, 10);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#00ff00';
	ctx.fillRect(0, 0, 10, 10);
	return canvas.convertToBlob({ type: 'image/png' });
}

const line = (id: string, x0: number, x1: number, y: number, color: string, tool: Stroke['tool'] = 'pen'): Stroke => ({
	id,
	tool,
	color,
	size: 6,
	points: new Float32Array([x0, y, 0.5, (x0 + x1) / 2, y, 0.5, x1, y, 0.5])
});

async function notebook(): Promise<ExportSource> {
	const assets: Record<string, Blob> = { 'a.pdf': await sourcePdf(), 'g.png': await greenPng() };
	const readAsset = async (name: string) => assets[name];
	const pictures = new PictureCache(readAsset, () => {});
	const pages: PageMeta[] = [
		{ id: 'p1', w: 200, h: 100, paper: 'blank', background: { asset: 'a.pdf', page: 1 } },
		{ id: 'p2', w: 100, h: 200, paper: 'blank', background: { asset: 'a.pdf', page: 2 } },
		{ id: 'p3', w: 200, h: 100, paper: 'lined' }
	];
	const shape: ShapeItem = { id: 'r', type: 'shape', fit: { kind: 'line', x0: 10, y0: 180, x1: 90, y1: 180 }, color: '#0000ff', size: 6 };
	const image: ImageItem = { id: 'i', type: 'image', asset: 'g.png', x: 20, y: 20, w: 40, h: 40 };
	const scenes: Record<string, PageScene> = {
		p1: new PageScene({ items: [line('s', 110, 190, 80, '#0000ff')] }, pictures),
		p2: new PageScene({ items: [shape] }, pictures),
		p3: new PageScene({ items: [image, line('h', 100, 180, 50, '#ffff00', 'highlighter')] }, pictures)
	};
	return { pages, scene: (id) => scenes[id], pictures, backgrounds: new PdfBackgrounds(readAsset, () => {}), readAsset };
}

/** Renders page `n` of a PDF at 1 px per point and reads pixels */
async function rendered(pdf: Blob, n: number) {
	const backgrounds = new PdfBackgrounds(async () => pdf, () => {});
	const canvas = await backgrounds.render({ asset: 'x.pdf', page: n }, 1);
	const ctx = canvas.getContext('2d')!;
	return (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
}

const near = (actual: number[], expected: number[]) => actual.every((v, i) => Math.abs(v - expected[i]) <= 40);

describe('PDF export', () => {
	it('embeds PDF pages (rotation applied), strokes, shapes, paper and images in place', async () => {
		const pdf = await exportPdf(await notebook());
		expect(await readPdfPages(pdf)).toEqual([
			{ w: 200, h: 100 },
			{ w: 100, h: 200 },
			{ w: 200, h: 100 }
		]);

		const p1 = await rendered(pdf, 1);
		expect(near(p1(50, 50), [255, 0, 0])).toBe(true);
		expect(near(p1(150, 80), [0, 0, 255])).toBe(true);
		expect(near(p1(150, 30), [255, 255, 255])).toBe(true);

		const p2 = await rendered(pdf, 2);
		expect(near(p2(50, 50), [255, 0, 0])).toBe(true);
		expect(near(p2(50, 150), [255, 255, 255])).toBe(true);
		expect(near(p2(50, 180), [0, 0, 255])).toBe(true);

		const p3 = await rendered(pdf, 3);
		expect(near(p3(40, 40), [0, 255, 0])).toBe(true);
		// Highlighter: see-through yellow on white
		const marker = p3(140, 50);
		expect(marker[2]).toBeLessThan(220);
		expect(marker[0]).toBeGreaterThan(220);
	});
});

describe('PNG export', () => {
	it('draws a page like on screen', async () => {
		const source = await notebook();
		const png = await exportPng(source, source.pages[0]);
		const bitmap = await createImageBitmap(png);
		expect([bitmap.width, bitmap.height]).toEqual([600, 300]);
		const ctx = new OffscreenCanvas(600, 300).getContext('2d')!;
		ctx.drawImage(bitmap, 0, 0);
		const at = (x: number, y: number) => [...ctx.getImageData(x * 3, y * 3, 1, 1).data].slice(0, 3);
		expect(near(at(50, 50), [255, 0, 0])).toBe(true);
		expect(near(at(150, 80), [0, 0, 255])).toBe(true);
	});
});
