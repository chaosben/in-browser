import { describe, expect, it } from 'vitest';
import { pdfLib } from '../pdf-lib.js';
import { openPdf } from '../pdfjs.js';
import { IncrementalPdf } from '../write/incremental.js';

// Editing a page's own content, in real Chromium: written by our writer, read back by PDF.js and by pdf-lib. What
// is taken out of a page must be gone from the file – not only from the page – so such a file is written anew.

/** Two pages: "Keep this" and "Secret 4711" with a picture on the first, "Other page" on the second */
async function sample(): Promise<Uint8Array> {
	const { PDFDocument, StandardFonts } = await pdfLib();
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const page = doc.addPage([300, 400]);
	page.drawText('Keep this', { x: 20, y: 360, size: 18, font });
	page.drawText('Secret 4711', { x: 20, y: 300, size: 18, font });
	const canvas = new OffscreenCanvas(8, 8);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#c02040';
	ctx.fillRect(0, 0, 8, 8);
	const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
	page.drawImage(await doc.embedPng(png), { x: 100, y: 100, width: 80, height: 40 });
	doc.addPage([300, 400]).drawText('Other page', { x: 20, y: 360, size: 18, font });
	return doc.save({ useObjectStreams: false });
}

/** The text of each page, as PDF.js reads it, with where each piece starts */
async function texts(bytes: Uint8Array) {
	const pdf = await openPdf(bytes.slice());
	const out: { str: string; x: number; y: number }[][] = [];
	for (let n = 1; n <= pdf.numPages; n++) {
		const content = await (await pdf.getPage(n)).getTextContent();
		out.push(content.items.flatMap((item) => ('str' in item && item.str.trim() ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }] : [])));
	}
	await pdf.loadingTask.destroy();
	return out;
}

/** Every stream and string of a file, decoded, as one text: what anyone could still find in it */
async function everything(bytes: Uint8Array): Promise<string> {
	const { PDFDocument, PDFRawStream, decodePDFRawStream } = await pdfLib();
	const doc = await PDFDocument.load(bytes, { updateMetadata: false });
	const latin1 = new TextDecoder('latin1');
	let out = latin1.decode(bytes);
	for (const [, object] of doc.context.enumerateIndirectObjects()) if (object instanceof PDFRawStream) out += latin1.decode(decodePDFRawStream(object).decode());
	return out;
}

const hexOf = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();

describe('editing page content', () => {
	it('reads the objects of a page', async () => {
		const pdf = await IncrementalPdf.open(await sample());
		const objects = pdf.contentObjects(0)!;
		expect(objects.map((o) => o.kind)).toEqual(['text', 'text', 'image']);
		expect(objects[2].box).toEqual({ x0: 100, y0: 100, x1: 180, y1: 140 });
		expect(objects[0].box.x0).toBeCloseTo(20);
		// "Keep this" in 18 pt Helvetica is about 77 pt wide
		expect(objects[0].box.x1 - objects[0].box.x0).toBeGreaterThan(60);
		expect(objects[0].box.x1 - objects[0].box.x0).toBeLessThan(95);
	});

	it('moves one object and leaves the others where they are', async () => {
		const base = await sample();
		const pdf = await IncrementalPdf.open(base);
		const out = await pdf.update({ content: new Map([[0, new Map([[1, { matrix: [1, 0, 0, 1, 50, -100] as [number, number, number, number, number, number] }]])]]) });
		const [first, second] = await texts(out);
		expect(first).toEqual([
			{ str: 'Keep this', x: 20, y: 360 },
			{ str: 'Secret 4711', x: 70, y: 200 }
		]);
		expect(second).toEqual([{ str: 'Other page', x: 20, y: 360 }]);
		// The picture is still drawn
		const again = await IncrementalPdf.open(out);
		expect(again.contentObjects(0)!.map((o) => o.kind)).toEqual(['text', 'text', 'image']);
	});

	it('takes deleted content out of the file, also out of versions appended to it before', async () => {
		// A file that already has an appended version (as any editor may leave it)
		const first = await IncrementalPdf.open(await sample());
		const base = await first.update({ rotate: new Map([[1, 90]]) });
		expect(await everything(base)).toContain(hexOf('Secret 4711'));

		const pdf = await IncrementalPdf.open(base);
		const objects = pdf.contentObjects(0)!;
		const image = objects.find((o) => o.kind === 'image')!;
		const out = await pdf.update({ content: new Map([[0, new Map([[1, { remove: true }], [image.id, { remove: true }]])]]) });

		const all = await everything(out);
		expect(all).not.toContain(hexOf('Secret 4711'));
		expect(all).not.toContain('Secret 4711');
		expect(all).toContain(hexOf('Keep this'));
		// The picture nothing draws any more is gone as an object too; the file is no longer an appended one
		expect(all).not.toContain('/Subtype /Image');
		expect(all).not.toContain('/Prev');
		expect((await texts(out)).map((page) => page.map((t) => t.str))).toEqual([['Keep this'], ['Other page']]);
		// The other change of the earlier version is kept, and a second parser reads the file
		const { PDFDocument } = await pdfLib();
		const again = await PDFDocument.load(out);
		expect(again.getPageCount()).toBe(2);
		expect(again.getPage(1).getRotation().angle).toBe(90);
		// Without content changes the same file is appended to as before
		const appended = await pdf.update({ rotate: new Map([[0, 90]]) });
		expect(appended.subarray(0, base.length)).toEqual(base);
	});

	it('makes a drawing part of the content: on top, or in the place of an image', async () => {
		const pdf = await IncrementalPdf.open(await sample());
		const image = pdf.contentObjects(0)!.find((o) => o.kind === 'image')!;
		const box = (name: string, rect: [number, number, number, number]) => ({
			subtype: 'Square' as const,
			name,
			rect,
			appearance: { content: `1 0 0 rg ${rect[0]} ${rect[1]} ${rect[2] - rect[0]} ${rect[3] - rect[1]} re f` }
		});
		const out = await pdf.update({
			flatten: new Map([[0, [{ annotation: box('top', [10, 10, 60, 40]), matrix: [1, 0, 0, 1, 100, 0] as [number, number, number, number, number, number] }, { annotation: box('swap', [110, 105, 170, 135]), at: image.id }]]])
		});
		const again = await IncrementalPdf.open(out);
		// In the image's place (before nothing else moved), then the one on top; no annotation was written
		expect(again.contentObjects(0)!.map((o) => [o.kind, o.box])).toEqual([
			['text', expect.anything()],
			['text', expect.anything()],
			['form', { x0: 110, y0: 105, x1: 170, y1: 135 }],
			['form', { x0: 110, y0: 10, x1: 160, y1: 40 }]
		]);
		expect(again.annotations(0)).toEqual([]);
		expect(await everything(out)).not.toContain('/Subtype /Image');
		expect((await texts(out))[0].map((t) => t.str)).toEqual(['Keep this', 'Secret 4711']);
	});

	it('writes a file protected without a password encrypted again', async () => {
		const file = new Uint8Array(await (await fetch(new URL('../write/fixtures/aes-128.pdf', import.meta.url))).arrayBuffer());
		const pdf = await IncrementalPdf.open(file);
		const objects = pdf.contentObjects(0)!;
		const text = objects.find((o) => o.kind === 'text')!;
		const out = await pdf.update({ content: new Map([[0, new Map([[text.id, { remove: true }]])]]) });
		expect(new TextDecoder('latin1').decode(out)).toContain('/Encrypt');
		const before = (await texts(file))[0].map((t) => t.str);
		const after = (await texts(out))[0].map((t) => t.str);
		expect(before.join(' ')).toContain('Protected page');
		expect(after.length).toBeLessThan(before.length);
		// Our own reader opens it again (decrypted with the same key)
		expect((await IncrementalPdf.open(out)).contentObjects(0)!.length).toBe(objects.length - 1);
	});
});
