import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PdfBackgrounds } from './backgrounds';
import { TILE, tileRange } from './tiles';

// Benchmark: a dense text page (like an official gazette) at the scale of a tablet (dpr 1.75, zoom 1.5)

async function densePdf(): Promise<Blob> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	const page = doc.addPage([595, 842]);
	for (let col = 0; col < 3; col++) {
		for (let row = 0; row < 110; row++) {
			page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit', { x: 30 + col * 185, y: 820 - row * 7.3, size: 5.5, font });
		}
	}
	return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });
}

describe('PDF page rendering budget', () => {
	it('shows a dense page at tablet scale', async () => {
		const pdf = await densePdf();
		const bg = { asset: 'a.pdf', page: 1 };
		let scale = 2.66;
		let { tx0, ty0, tx1, ty1 } = tileRange(scale, { x0: 0, y0: 0, x1: 595, y1: 842 });
		let wake = () => {};
		const backgrounds = new PdfBackgrounds(async () => pdf, () => wake());
		backgrounds.max = 200;
		const missing = (exact: boolean) => {
			let n = 0;
			for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
				const piece = backgrounds.tile(bg, scale, tx, ty);
				if (!piece || (exact && !piece.exact)) n++;
			}
			return n;
		};
		const until = async (exact: boolean) => {
			while (missing(exact)) await new Promise<void>((r) => (wake = r));
		};
		const measure = async (label: string) => {
			const t0 = performance.now();
			await until(false);
			const first = performance.now() - t0;
			await until(true);
			const sharp = performance.now() - t0;
			console.info(`[bench] PDF page, ${label}: first view ${first.toFixed(0)} ms, sharp ${sharp.toFixed(0)} ms`);
			return sharp;
		};
		await measure('cold (worker start, fonts)');
		scale = 2.67;
		({ tx0, ty0, tx1, ty1 } = tileRange(scale, { x0: 0, y0: 0, x1: 595, y1: 842 }));
		expect(await measure(`warm, ${(tx1 - tx0 + 1) * (ty1 - ty0 + 1)} tiles of ${TILE}px`)).toBeLessThan(3000);
		backgrounds.destroy();
	}, 30_000);
});
