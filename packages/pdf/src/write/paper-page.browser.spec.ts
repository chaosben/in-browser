import { describe, expect, it } from 'vitest';
import { openPdf } from '../pdfjs';
import { LINE_SPACING, PAGE_FORMATS, paperPdf } from './paper-page';

describe('new pages with a paper', () => {
	it('makes pages of the size asked for, with lines a centimeter apart drawn as page content', async () => {
		const { w, h } = PAGE_FORMATS.a5;
		const pdf = await openPdf(await paperPdf({ width: w, height: h, paper: 'lined', pages: 2 }));
		expect(pdf.numPages).toBe(2);
		const page = await pdf.getPage(2);
		const viewport = page.getViewport({ scale: 2 });
		expect([viewport.width / 2, viewport.height / 2].map(Math.round)).toEqual([420, 595]);
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await page.render({ canvas, viewport }).promise;
		const ctx = canvas.getContext('2d')!;
		// The darkest pixel around a height (a hairline lies between two rows of pixels)
		const light = (y: number) => Math.min(...[-1, 0, 1].map((d) => ctx.getImageData(100, Math.round(y * 2) + d, 1, 1).data[0]));
		// On the first and third line, not between them
		expect(light(LINE_SPACING)).toBeLessThan(235);
		expect(light(LINE_SPACING * 3)).toBeLessThan(235);
		expect(light(LINE_SPACING * 1.5)).toBe(255);
		await pdf.loadingTask.destroy();
	});
});
