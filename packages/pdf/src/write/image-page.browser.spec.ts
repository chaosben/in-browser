import { describe, expect, it } from 'vitest';
import { openPdf } from '../pdfjs.js';
import { imagePdf } from './image-page.js';

// Images as PDF pages: the picture fills the page, at 96 dpi, at most A4.

async function picture(width: number, height: number, type: string): Promise<Blob> {
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#ff0000';
	ctx.fillRect(0, 0, width, height);
	return canvas.convertToBlob({ type });
}

describe('imagePdf', () => {
	it('makes a page of the picture’s size (96 dpi) for PNG, JPEG and other formats', async () => {
		for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
			const pdf = await openPdf(await imagePdf(await picture(400, 200, type)));
			expect(pdf.numPages, type).toBe(1);
			expect((await pdf.getPage(1)).view, type).toEqual([0, 0, 300, 150]);
			await pdf.loadingTask.destroy();
		}
	});

	it('makes large pictures fit A4, upright or across as they are', async () => {
		const pdf = await openPdf(await imagePdf(await picture(4000, 2000, 'image/png')));
		const [, , w, h] = (await pdf.getPage(1)).view;
		expect(w).toBeCloseTo(841.89, 1);
		expect(h).toBeCloseTo(420.95, 1);
		await pdf.loadingTask.destroy();
	});
});
