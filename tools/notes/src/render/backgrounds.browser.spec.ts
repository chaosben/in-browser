import { describe, expect, it, vi } from 'vitest';
import { degrees, PDFDict, PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib';
import { PdfBackgrounds, type Piece } from './backgrounds';
import { PdfError, readPdfPages } from './pdf';
import { TILE } from './tiles';

// PDF pages rendered by PDF.js (renderer worker) in real Chromium

/** A PDF: page 1 200×100 pt, left half red; page 2 the same, rotated by 90° */
async function makePdf(): Promise<Blob> {
	const doc = await PDFDocument.create();
	for (const rotate of [0, 90]) {
		const page = doc.addPage([200, 100]);
		page.drawRectangle({ x: 0, y: 0, width: 100, height: 100, color: rgb(1, 0, 0) });
		page.drawText('Hello', { x: 120, y: 40, size: 12 });
		page.setRotation(degrees(rotate));
	}
	return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });
}

function pixel(piece: Piece, x: number, y: number) {
	const ctx = new OffscreenCanvas(TILE, TILE).getContext('2d')!;
	ctx.drawImage(piece.image, piece.sx, piece.sy, piece.sw, piece.sh, 0, 0, TILE, TILE);
	return [...ctx.getImageData(x, y, 1, 1).data];
}

describe('PDF pages', () => {
	it('reads the page sizes as shown (rotation applied)', async () => {
		expect(await readPdfPages(await makePdf())).toEqual([
			{ w: 200, h: 100 },
			{ w: 100, h: 200 }
		]);
	});

	it('rejects files that are no PDF', async () => {
		await expect(readPdfPages(new Blob(['hello']))).rejects.toBeInstanceOf(PdfError);
	});

	it('renders a preview first, then the sharp piece at the tile scale', async () => {
		const pdf = await makePdf();
		let ready = () => {};
		const backgrounds = new PdfBackgrounds(async () => pdf, () => ready());
		const bg = { asset: 'a.pdf', page: 1 };
		expect(backgrounds.tile(bg, 2, 0, 0)).toBeNull();
		// First a stretched preview, then the sharp piece
		let piece = backgrounds.tile(bg, 2, 0, 0);
		while (!piece?.exact) {
			await new Promise<void>((resolve) => (ready = resolve));
			piece = backgrounds.tile(bg, 2, 0, 0);
		}
		// Scale 2: the red half is 200 px wide, the rest white
		expect(pixel(piece, 100, 100)).toEqual([255, 0, 0, 255]);
		expect(pixel(piece, 300, 20)).toEqual([255, 255, 255, 255]);
		backgrounds.destroy();
	});

	it('draws fonts a PDF does not embed with our standard fonts (also under their Windows names)', async () => {
		// The same text in Times-Roman and in "TimesNewRomanPSMT" (not embedded, as in many office PDFs)
		const doc = await PDFDocument.create();
		const fonts = [await doc.embedFont(StandardFonts.TimesRoman), await doc.embedFont(StandardFonts.TimesRoman)];
		for (const font of fonts) doc.addPage([200, 60]).drawText('Amtsblatt Hamburg', { x: 10, y: 20, size: 20, font });
		// Font dictionaries are written on flush; then the second one gets the Windows name
		await doc.flush();
		doc.context.lookup(fonts[1].ref, PDFDict).set(PDFName.of('BaseFont'), PDFName.of('TimesNewRomanPSMT'));
		const pdf = new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });
		const backgrounds = new PdfBackgrounds(async () => pdf, () => {});
		const pixels = async (page: number) => {
			const canvas = await backgrounds.render({ asset: 'a.pdf', page }, 2);
			return [...canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data];
		};
		const fetched = vi.spyOn(globalThis, 'fetch');
		const [standard, windows] = [await pixels(1), await pixels(2)];
		// Our serif font file, not whatever the device has (Android has no Times New Roman)
		expect(fetched.mock.calls.some(([url]) => String(url).includes('FoxitSerif'))).toBe(true);
		fetched.mockRestore();
		// Text was drawn, and in the same font
		expect(standard.some((v) => v < 128)).toBe(true);
		expect(windows).toEqual(standard);
		backgrounds.destroy();
	});
});
