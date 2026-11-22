import { describe, expect, it, vi } from 'vitest';
import { degrees, PDFDict, PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib';
import { PdfPages, type Piece } from './pages';
import { openPdf, PdfError } from './pdfjs';

const TILE = 512;

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
	it('rejects files that are no PDF', async () => {
		await expect(openPdf(new TextEncoder().encode('hello'))).rejects.toBeInstanceOf(PdfError);
	});

	it('renders a preview first, then the sharp piece at the tile scale', async () => {
		const pdf = await makePdf();
		let ready = () => {};
		const pages = new PdfPages(async () => pdf, () => ready());
		expect(pages.tile('a.pdf', 1, 2, 0, 0)).toBeNull();
		// First a stretched preview, then the sharp piece
		let piece = pages.tile('a.pdf', 1, 2, 0, 0);
		while (!piece?.exact) {
			await new Promise<void>((resolve) => (ready = resolve));
			piece = pages.tile('a.pdf', 1, 2, 0, 0);
		}
		// Scale 2: the red half is 200 px wide, the rest white
		expect(pixel(piece, 100, 100)).toEqual([255, 0, 0, 255]);
		expect(pixel(piece, 300, 20)).toEqual([255, 255, 255, 255]);
		pages.destroy();
	});

	it('keeps showing a refreshed page until it is rendered anew', async () => {
		const pdf = await makePdf();
		let ready = () => {};
		const pages = new PdfPages(async () => pdf, () => ready());
		const sharp = async () => {
			let piece = pages.tile('a.pdf', 1, 2, 0, 0);
			while (!piece?.exact) {
				await new Promise<void>((resolve) => (ready = resolve));
				piece = pages.tile('a.pdf', 1, 2, 0, 0);
			}
			return piece;
		};
		const first = await sharp();
		pages.refresh('a.pdf', 1);
		// The old picture right away (never nothing), as a preview
		const meanwhile = pages.tile('a.pdf', 1, 2, 0, 0)!;
		expect(meanwhile.exact).toBe(false);
		expect(meanwhile.image).toBe(first.image);
		const again = await sharp();
		expect(again.image).not.toBe(first.image);
		expect(pixel(again, 100, 100)).toEqual([255, 0, 0, 255]);
		// Then it rests: asked again and again (every frame), it is rendered no more
		let renders = 0;
		ready = () => renders++;
		for (let i = 0; i < 5; i++) {
			expect(pages.tile('a.pdf', 1, 2, 0, 0)?.exact).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		expect(renders).toBe(0);
		pages.destroy();
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
		const pages = new PdfPages(async () => pdf, () => {});
		const pixels = async (page: number) => {
			const canvas = await pages.render('a.pdf', page, 2);
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
		pages.destroy();
	});
});
