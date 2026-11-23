import { describe, expect, it } from 'vitest';
import type { ShapeItem, Stroke } from '@in-browser/ink/items.js';
import { pageTransform, toShown, toUserSpace } from '@in-browser/pdf/geometry.js';
import { pdfLib } from '@in-browser/pdf/pdf-lib.js';
import { openPdf } from '@in-browser/pdf/pdfjs.js';
import type { NewAnnotation } from '@in-browser/pdf/write/annotations.js';
import { IncrementalPdf } from '@in-browser/pdf/write/incremental.js';
import { pdfKit, type MarkupItem, type PdfItem } from '#lib/render/markup.js';
import { registerStampImage, stampBitmap, stampsSharp, type StampItem } from '#lib/render/stamp.js';
import type { CaretItem } from '#lib/render/caret.js';
import type { LinkItem } from '#lib/render/link.js';
import { isMeasured, measureText } from '#lib/render/measure.js';
import { attachedFiles } from '#lib/render/note.js';
import { formBitmap, isForm, type PdfForm } from '@in-browser/pdf/write/form.js';
import { encodeImage, imageBitmap } from '@in-browser/pdf/write/image.js';
import { pieceForm } from '@in-browser/pdf/write/piece.js';
import { svgForm } from '@in-browser/pdf/write/svg.js';
import type { NoteItem } from '#lib/render/note.js';
import { loadFonts, measureStyled } from '@in-browser/graphics/fonts.js';
import type { RichText } from '@in-browser/graphics/rich-text.js';
import { loadTextFont, withRich, withText, type TextItem } from '#lib/render/textbox.js';
import { annotationOf, partsOf } from './annots.js';
import { itemsOf, withData } from './imported.js';
import { isNotesAnnotation, notesAnnotation } from './notes.js';
import { flipsOf, withFlips } from '#lib/render/steps.js';

// Drawn items written as annotations and drawn again by PDF.js: they must appear where they were drawn on the page
// as shown – also on a turned page and on one whose box doesn't start at the origin.

async function sample(): Promise<Uint8Array> {
	const { PDFDocument } = await pdfLib();
	const doc = await PDFDocument.create();
	doc.addPage([300, 400]);
	const moved = doc.addPage([300, 400]);
	moved.setMediaBox(50, 100, 300, 400);
	return doc.save();
}

/** The color at a point of the page as shown (page points) */
async function pixel(bytes: Uint8Array, pageNumber: number, rotation: number, x: number, y: number): Promise<number[]> {
	const pdf = await openPdf(bytes.slice());
	const page = await pdf.getPage(pageNumber);
	const viewport = page.getViewport({ scale: 2, rotation });
	const canvas = document.createElement('canvas');
	canvas.width = Math.ceil(viewport.width);
	canvas.height = Math.ceil(viewport.height);
	await page.render({ canvas, viewport }).promise;
	const data = canvas.getContext('2d')!.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data;
	await pdf.loadingTask.destroy();
	return [...data.slice(0, 3)];
}

/** How many dark pixels a region of the page has (page points, rendered at 2×) */
async function darkIn(bytes: Uint8Array, x0: number, y0: number, x1: number, y1: number): Promise<number> {
	const pdf = await openPdf(bytes.slice());
	const page = await pdf.getPage(1);
	const viewport = page.getViewport({ scale: 2 });
	const canvas = document.createElement('canvas');
	canvas.width = Math.ceil(viewport.width);
	canvas.height = Math.ceil(viewport.height);
	await page.render({ canvas, viewport }).promise;
	const data = canvas.getContext('2d')!.getImageData(x0 * 2, y0 * 2, (x1 - x0) * 2, (y1 - y0) * 2).data;
	await pdf.loadingTask.destroy();
	let n = 0;
	for (let i = 0; i < data.length; i += 4) if (data[i] < 100) n++;
	return n;
}

const red = (c: number[]) => c[0] > 200 && c[1] < 80 && c[2] < 80;
const white = (c: number[]) => c.every((v) => v > 240);

const stroke: Stroke = { id: 's1', tool: 'pen', color: '#ff0000', size: 6, points: Float32Array.of(40, 60, 0.5, 120, 60, 0.5) };
const box: ShapeItem = { id: 'b1', type: 'shape', color: '#ff0000', size: 4, fit: { kind: 'roundedRect', x: 150, y: 150, w: 60, h: 40 }, fill: '#ff0000ff' };

describe('annotations of drawn items', () => {
	for (const rotation of [0, 90]) {
		it(`appear where they were drawn (page turned ${rotation}°)`, async () => {
			const base = await sample();
			const pdf = await IncrementalPdf.open(base);
			const view = (await (await openPdf(base.slice())).getPage(1)).view;
			const toUser = toUserSpace(pageTransform(view, rotation));
			const out = await pdf.update({
				rotate: new Map([[0, rotation]]),
				annotations: new Map([[0, [annotationOf(stroke, toUser, 'Me', new Date()), annotationOf(box, toUser, undefined, new Date())]]])
			});
			expect(red(await pixel(out, 1, rotation, 80, 60))).toBe(true);
			expect(red(await pixel(out, 1, rotation, 180, 170))).toBe(true);
			expect(white(await pixel(out, 1, rotation, 80, 90))).toBe(true);
		});
	}

	it('appear where they were drawn on a page whose box is moved', async () => {
		const base = await sample();
		const pdf = await IncrementalPdf.open(base);
		const view = (await (await openPdf(base.slice())).getPage(2)).view;
		const toUser = toUserSpace(pageTransform(view, 0));
		const out = await pdf.update({ annotations: new Map([[1, [annotationOf(stroke, toUser, undefined, new Date())]]]) });
		expect(red(await pixel(out, 2, 0, 80, 60))).toBe(true);
		expect(white(await pixel(out, 2, 0, 80, 100))).toBe(true);
	});

	it('marks a highlighter see-through and multiplied, a line as /Line with its arrowhead', () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const marker = annotationOf({ ...stroke, tool: 'highlighter' }, toUser, undefined, new Date());
		expect(marker.subtype).toBe('Ink');
		expect(marker.appearance.states?.L0).toEqual({ alpha: 0.35, multiply: true });
		expect(marker.appearance.content).toContain('/L0 gs /X0 Do');
		// Only in the appearance: `/CA` would apply on top of it in viewers that honor it
		expect(marker.opacity).toBeUndefined();
		const arrow = annotationOf({ ...box, fill: undefined, fit: { kind: 'line', x0: 10, y0: 20, x1: 110, y1: 20, end: true } }, toUser, undefined, new Date());
		expect(arrow).toMatchObject({ subtype: 'Line', line: [10, 380, 110, 380], lineEndings: ['None', 'OpenArrow'] });
	});

	it('draws see-through ink evenly: where its line crosses itself it is no darker', async () => {
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		// An X: two crossing lines in one stroke, half see-through
		const cross: Stroke = { ...stroke, color: '#ff000080', points: Float32Array.of(40, 40, 0.5, 140, 140, 0.5, 140, 40, 0.5, 40, 140, 0.5) };
		const ink = annotationOf(cross, toUser, undefined, new Date());
		expect(ink.opacity).toBeUndefined();
		const out = await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [ink]]]) });
		const middle = await pixel(out, 1, 0, 90, 90);
		const arm = await pixel(out, 1, 0, 60, 60);
		expect(arm[0]).toBeGreaterThan(240);
		expect(arm[1]).toBeGreaterThan(100);
		expect(arm[1]).toBeLessThan(160);
		expect(Math.abs(middle[1] - arm[1])).toBeLessThan(6);
	});

	it('writes marked text as text markup with its boxes, text and opacity (in the appearance)', async () => {
		const base = await sample();
		const pdf = await IncrementalPdf.open(base);
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const mark = annotationOf(
			{ id: 'm1', type: 'markup', kind: 'highlight', color: '#ff000080', boxes: [{ x0: 40, y0: 50, x1: 120, y1: 70 }], dir: 0, text: 'Marked' },
			toUser,
			undefined,
			new Date()
		);
		expect(mark.opacity).toBeUndefined();
		expect(mark.appearance.states?.M).toEqual({ alpha: 0.5, multiply: true });
		expect(mark).toMatchObject({ subtype: 'Highlight', contents: 'Marked', quadPoints: [40, 350, 120, 350, 40, 330, 120, 330] });
		const out = await pdf.update({ annotations: new Map([[0, [mark]]]) });
		// Half see-through red, multiplied on white: a light red
		const c = await pixel(out, 1, 0, 80, 60);
		expect(c[0]).toBeGreaterThan(240);
		expect(c[1]).toBeGreaterThan(100);
		expect(c[1]).toBeLessThan(160);
		const opened = await openPdf(out.slice());
		const [annotation] = await (await opened.getPage(1)).getAnnotations();
		expect(annotation).toMatchObject({ subtype: 'Highlight', contentsObj: { str: 'Marked' } });
		await opened.loadingTask.destroy();
	});

	it('writes a wavy underline as /Squiggly, drawn below its text, and reads it back from the standard entries', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const wavy: MarkupItem = { id: 'w1', type: 'markup', kind: 'squiggly', color: '#000000ff', boxes: [{ x0: 40, y0: 50, x1: 120, y1: 70 }], dir: 0, text: 'Wavy' };
		const annotation = annotationOf(wavy, toUser, undefined, new Date());
		expect(annotation).toMatchObject({ subtype: 'Squiggly', contents: 'Wavy' });
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [annotation]]]) });
		// The line swings around the underline's place just below the box, nothing above it
		expect(await darkIn(out, 40, 68, 120, 76)).toBeGreaterThan(0);
		expect(await darkIn(out, 40, 50, 120, 66)).toBe(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(itemsOf(found, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x')).toEqual([wavy]);
	});

	it('writes an open line as /PolyLine with what its ends carry and a cloud with /BE, and reads both back from the standard entries', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const open: ShapeItem = { id: 'p1', type: 'shape', color: '#000000', size: 2, fit: { kind: 'polyline', points: [40, 60, 100, 100, 160, 60], start: 'circle', end: true } };
		const cloud: ShapeItem = { id: 'c1', type: 'shape', color: '#000000', size: 2, fit: { kind: 'polygon', points: [40, 200, 200, 200, 200, 320, 40, 320] }, cloud: true };
		const written = [open, cloud].map((item) => annotationOf(item, toUser, undefined, new Date()));
		expect(written[0]).toMatchObject({ subtype: 'PolyLine', vertices: [40, 340, 100, 300, 160, 340], lineEndings: ['Circle', 'OpenArrow'] });
		expect(written[1]).toMatchObject({ subtype: 'Polygon', cloud: 1 });
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, written]]) });
		// The cloud's arcs bulge out of the polygon: ink outside its top edge, none well inside
		expect(await darkIn(out, 60, 190, 180, 198)).toBeGreaterThan(0);
		expect(await darkIn(out, 80, 230, 160, 290)).toBe(0);
		const found = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.flatMap((a) => itemsOf(a, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x'))).toEqual([open, cloud]);
	});

	it('writes stamps – a framed word, a picture with see-through parts – as /Stamp and reads them back with the picture', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		// 2 × 1 pixels: opaque red, then nothing
		const canvas = document.createElement('canvas');
		canvas.width = 2;
		canvas.height = 1;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#ff0000';
		ctx.fillRect(0, 0, 1, 1);
		const image = await encodeImage(await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png')));
		registerStampImage('pic', image);
		const word: StampItem = { id: 'w', type: 'stamp', x: 40, y: 40, w: 120, h: 30, name: 'Approved', text: 'APPROVED', color: '#000000' };
		const picture: StampItem = { id: 'p', type: 'stamp', x: 40, y: 200, w: 100, h: 50, name: 'Image', color: '#000000', image: 'pic' };
		const written = [word, picture].map((item) => withData(annotationOf(item, toUser, undefined, date), item, date, 0, 300, 400));
		expect(written[0]).toMatchObject({ subtype: 'Stamp', icon: 'Approved', contents: 'APPROVED', rect: [40, 330, 160, 360] });
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, written]]) });
		// The word's frame and letters; the picture's left half red, its right half the page
		expect(await darkIn(out, 40, 40, 160, 70)).toBeGreaterThan(50);
		expect(red(await pixel(out, 1, 0, 65, 225))).toBe(true);
		expect(white(await pixel(out, 1, 0, 115, 225))).toBe(true);
		const found = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.flatMap((a) => itemsOf(a, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x'))).toEqual([word, picture]);
		expect(found[1].image).toMatchObject({ width: 2, height: 1 });
		const bitmap = await imageBitmap(found[1].image!);
		expect([bitmap.width, bitmap.height]).toEqual([2, 1]);
	});

	it('writes a stamp of an SVG as vectors – paths, arcs, transforms – and reads it back as vectors; an SVG with text stays pixels', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		// 40 × 20 pixels: a red disc filling the left half (as two arcs), the right half moved in by a transform
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 4 2"><path fill="#f00" d="M0 1a1 1 0 0 1 2 0 1 1 0 0 1-2 0z"/>' +
			'<g transform="translate(2)"><rect width="2" height="2" style="fill:none;stroke:#f00;stroke-width:.5"/></g></svg>';
		const form = (await svgForm(svg))!;
		expect([form.width, form.height]).toEqual([30, 15]);
		expect(await svgForm('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><text>a</text></svg>')).toBeNull();
		registerStampImage('vec', form);
		const item: StampItem = { id: 'v', type: 'stamp', x: 40, y: 200, w: 200, h: 100, name: 'Image', color: '#000000', image: 'vec' };
		const written = withData(annotationOf(item, toUser, undefined, date), item, date, 0, 300, 400);
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [written]]]) });
		// No picture object: the disc's middle red, its box's corner the page; the frame's edge red, its inside the page
		expect(new TextDecoder('latin1').decode(out.subarray(out.length - 6000))).not.toContain('/Subtype /Image');
		expect(red(await pixel(out, 1, 0, 90, 250))).toBe(true);
		expect(white(await pixel(out, 1, 0, 44, 204))).toBe(true);
		expect(red(await pixel(out, 1, 0, 236, 250))).toBe(true);
		expect(white(await pixel(out, 1, 0, 190, 250))).toBe(true);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(itemsOf(found, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x')).toEqual([item]);
		expect(found.image && isForm(found.image) && [found.image.width, found.image.height]).toEqual([30, 15]);
		const bitmap = await formBitmap(found.image as PdfForm);
		expect(bitmap.width / bitmap.height).toBe(2);
		// See-through where the SVG paints nothing (the frame's inside)
		const shown = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
		shown.drawImage(bitmap, 0, 0);
		expect(shown.getImageData(Math.round(bitmap.width * 0.75), Math.round(bitmap.height / 2), 1, 1).data[3]).toBe(0);
	});

	it('makes a vector picture of a piece of a page: its own content with comments drawn on top, upright as shown', async () => {
		const { PDFDocument, rgb } = await pdfLib();
		const doc = await PDFDocument.create();
		doc.addPage([300, 400]).drawRectangle({ x: 100, y: 100, width: 100, height: 100, color: rgb(0, 0, 1) });
		const pdf = await doc.save();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		// The red stroke lies at y = 60 from the top: 340 in user space
		const piece = { page: { pdf, index: 0 }, annotations: [annotationOf(stroke, toUser, undefined, new Date())], box: [30, 90, 220, 360] as const };
		const form = await pieceForm(piece);
		expect([form.width, form.height]).toEqual([190, 270]);
		const bytes = await form.pdf;
		const blue = (c: number[]) => c[2] > 200 && c[0] < 80;
		expect(blue(await pixel(bytes, 1, 0, 120, 210))).toBe(true);
		expect(red(await pixel(bytes, 1, 0, 50, 20))).toBe(true);
		expect(white(await pixel(bytes, 1, 0, 150, 60))).toBe(true);
		// Nothing left to be listed as a comment
		expect((await IncrementalPdf.open(bytes)).annotations(0)).toEqual([]);
		// A page shown turned a quarter clockwise: the piece as seen, the blue square on its left
		const turned = await pieceForm({ ...piece, rotate: 90 });
		expect([turned.width, turned.height]).toEqual([270, 190]);
		expect(blue(await pixel(await turned.pdf, 1, 0, 60, 120))).toBe(true);
	});

	it('writes a file attached to a comment as /FileAttachment with the file as it is, and reads both back', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		// Every byte value, a name beyond ASCII
		const bytes = Uint8Array.from({ length: 600 }, (_, i) => i % 256);
		attachedFiles.set('f1', bytes);
		const item: PdfItem = { id: 'a1', type: 'note', x: 100, y: 100, color: '#ffd400', text: 'see this', file: { key: 'f1', name: 'Größen (1).bin', size: 600 } };
		const date = new Date();
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [withData(annotationOf(item, toUser, undefined, date), item, date, 0, 300, 400)]]]) });
		// Other programs find the file
		const opened = await openPdf(out.slice());
		const [annotation] = await (await opened.getPage(1)).getAnnotations();
		expect(annotation).toMatchObject({ subtype: 'FileAttachment', file: { filename: 'Größen (1).bin' } });
		await opened.loadingTask.destroy();
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.file?.name).toBe('Größen (1).bin');
		expect([...found.file!.bytes]).toEqual([...bytes]);
		expect(itemsOf(found, toPage, 0, (w) => w ?? 'x')).toEqual([item]);
		// Without our entry: a note with the file in its place
		expect(itemsOf({ ...found, data: undefined }, toPage, 0, (w) => w ?? 'x')[0]).toMatchObject({ type: 'note', text: 'see this', file: { name: 'Größen (1).bin', size: 600 } });
	});

	it('writes an insertion mark as /Caret with what to insert, and reads another program\'s mark back in its place', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const caret: CaretItem = { id: 'c1', type: 'caret', x: 100, y: 80, h: 20, dir: 0, color: '#000000ff', text: 'more' };
		const written = annotationOf(caret, toUser, undefined, new Date());
		expect(written).toMatchObject({ subtype: 'Caret', contents: 'more' });
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [written]]]) });
		// Its tip just above the baseline, its feet below it
		expect(await darkIn(out, 94, 76, 106, 86)).toBeGreaterThan(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		const [read] = itemsOf(found, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x') as CaretItem[];
		expect(read).toMatchObject({ id: 'c1', type: 'caret', dir: 0, color: '#000000ff', text: 'more' });
		expect([read.x, read.y].map(Math.round)).toEqual([100, 80]);
		expect(read.h).toBeGreaterThan(19);
		expect(read.h).toBeLessThan(25);
	});

	it('writes a text replacement as a mark with its struck text as a part of it (/IRT, /RT /Group), and reads the two back as one item – also another program\'s', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const item: CaretItem = { id: 'r1', type: 'caret', x: 160, y: 80, h: 20, dir: 0, color: '#000000ff', text: 'new', replaces: [{ x0: 60, y0: 60, x1: 160, y1: 80 }], marked: 'old' };
		const whole = withData(annotationOf(item, toUser, undefined, date), item, date, 0, 300, 400);
		const parts = partsOf(item, toUser, undefined, date);
		expect(whole.intent).toBe('Replace');
		expect(parts).toMatchObject([{ subtype: 'StrikeOut', contents: 'old', replyTo: 'r1', group: true, intent: 'StrikeOutTextEdit' }]);
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [whole, ...parts]]]) });
		const tail = new TextDecoder('latin1').decode(out.subarray(out.length - 6000));
		expect(tail).toMatch(/\/IRT \d+ 0 R \/RT \/Group/);
		// The line through the text, the mark at its end
		expect(await darkIn(out, 80, 66, 140, 74)).toBeGreaterThan(0);
		expect(await darkIn(out, 154, 76, 166, 86)).toBeGreaterThan(0);
		const found = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.map((a) => a.subtype)).toEqual(['Caret']);
		expect(itemsOf(found[0], toPage, 0, (w) => w ?? 'x')).toEqual([item]);
		// Without our data (another program's): the struck boxes from the part's quadrilaterals
		const [other] = itemsOf({ ...found[0], data: undefined }, toPage, 0, (w) => w ?? 'x') as CaretItem[];
		expect(other.marked).toBe('old');
		expect(other.replaces!.map((b) => [b.x0, b.y0, b.x1, b.y1].map(Math.round))).toEqual([[60, 60, 160, 80]]);
		// The mark written anew with its struck text taken off: nothing of the group stays behind
		const again = await IncrementalPdf.open(out);
		const gone = await again.update({ remove: new Set([found[0].ref]) });
		expect((await IncrementalPdf.open(gone)).annotations(0)).toEqual([]);
		expect(await darkIn(gone, 80, 66, 140, 74)).toBe(0);
	});

	it('writes links – to a web address, to a page that moved – as /Link, reads its own back and leaves a script address out', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const web: LinkItem = { id: 'l1', type: 'link', x: 40, y: 50, w: 100, h: 20, url: 'https://example.org/a b' };
		const page: LinkItem = { id: 'l2', type: 'link', x: 40, y: 90, w: 100, h: 20, page: 'p2' };
		const bad: LinkItem = { id: 'l3', type: 'link', x: 40, y: 130, w: 100, h: 20, url: 'javascript:alert(1)' };
		// The pages are written in a new order: the second one comes first
		const placeOf = (id: string) => (id === 'p2' ? 0 : 1);
		const written = [web, page, bad].map((item) => withData(annotationOf(item, toUser, undefined, date, placeOf), item, date, 0, 300, 400));
		expect(written.map((a) => [a.subtype, a.uri, a.destPage])).toEqual([['Link', 'https://example.org/a%20b', undefined], ['Link', undefined, 0], ['Link', undefined, undefined]]);
		const out = await (await IncrementalPdf.open(await sample())).update({ pages: [{ base: 1 }, { base: 0 }], annotations: new Map([[1, written]]) });
		const found = (await IncrementalPdf.open(out)).annotations(1);
		// Read back: the web address, and the page where it is now
		expect(found.map((a) => [a.uri, a.destPage])).toEqual([['https://example.org/a%20b', undefined], [undefined, 0], [undefined, undefined]]);
		expect(itemsOf(found[0], toPage, 0, (w) => w ?? 'x')).toEqual([{ ...web, url: 'https://example.org/a%20b' }]);
		expect(itemsOf(found[1], toPage, 0, (w) => w ?? 'x')).toEqual([{ ...page, page: '0' }]);
		// Another program's link (no data of ours) stays the file's
		expect(itemsOf({ ...found[0], data: undefined }, toPage, 0, (w) => w ?? 'x')).toEqual([]);
		// PDF.js follows them as every viewer does
		const pdf = await openPdf(out.slice());
		const links = ((await (await pdf.getPage(2)).getAnnotations()) as { subtype: string; url?: string; dest?: unknown[] }[]).filter((a) => a.subtype === 'Link');
		expect(links[0].url).toBe('https://example.org/a%20b');
		expect(await pdf.getPageIndex(links[1].dest![0] as Parameters<typeof pdf.getPageIndex>[0])).toBe(0);
		await pdf.loadingTask.destroy();
	});

	it('measures a distance and an area at the PDF\'s scale, writes the number and the scale (/Measure) and reads the shape back measuring', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const measure = { scale: 100, unit: 'm' as const };
		// 200 points = 70.56 mm on paper = 7.06 m at 1 : 100; 200 × 100 points = 24.89 m²
		const line: ShapeItem = { id: 'm1', type: 'shape', color: '#000000', size: 1, fit: { kind: 'line', x0: 50, y0: 100, x1: 250, y1: 100, start: 'bar', end: 'bar' }, measure: { kind: 'distance', ...measure } };
		const field: ShapeItem = { id: 'm2', type: 'shape', color: '#000000', size: 1, fit: { kind: 'polygon', points: [50, 200, 250, 200, 250, 300, 50, 300] }, measure: { kind: 'area', ...measure } };
		expect([line, field].map((item) => isMeasured(item) && measureText(item).replace(',', '.'))).toEqual(['7.06 m', '24.89 m²']);
		const written = [line, field].map((item) => withData(annotationOf(item, toUser, undefined, date), item, date, 0, 300, 400));
		expect(written.map((a) => [a.subtype, a.intent, a.measure?.ratio])).toEqual([['Line', 'LineDimension', '1 mm = 0.1 m'], ['Polygon', 'PolygonDimension', '1 mm = 0.1 m']]);
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, written]]) });
		expect(new TextDecoder('latin1').decode(out)).toContain('/Type /Measure /Subtype /RL');
		// The number stands above the middle of the line and in the middle of the area
		expect(await darkIn(out, 130, 86, 170, 97)).toBeGreaterThan(0);
		expect(await darkIn(out, 125, 243, 175, 256)).toBeGreaterThan(0);
		const found = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.flatMap((a) => itemsOf(a, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x'))).toEqual([line, field]);
	});

	it('gives an icon stamp another color by drawing its vectors anew, saved and read back with its drawing', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const icon = { body: '<path fill="currentColor" d="M0 0h24v24H0z"/>', width: 24, height: 24 };
		const placed: StampItem = { id: 'i1', type: 'stamp', x: 100, y: 100, w: 48, h: 48, name: 'Image', color: '#000000', image: 'none', icon };
		// Through the kit, as the color field does it; the picture is still on its way when the item is saved
		const item = pdfKit.recolor!(placed, '#ff0000') as StampItem;
		expect(item).toMatchObject({ color: '#ff0000', icon });
		expect(item.image).not.toBe('none');
		expect(pdfKit.color(item)).toBe('#ff0000');
		const written = withData(annotationOf(item, toUser, undefined, date), item, date, 0, 300, 400);
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [written]]]) });
		expect(new TextDecoder('latin1').decode(out.subarray(out.length - 6000))).not.toContain('/Subtype /Image');
		expect(red(await pixel(out, 1, 0, 124, 124))).toBe(true);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(itemsOf(found, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x')).toEqual([item]);
	});

	it('draws a vector stamp again for the scale it is shown at, and keeps the sharper picture', async () => {
		const form = (await svgForm('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#f00"/></svg>'))!;
		registerStampImage('sharp', form);
		const item: StampItem = { id: 'z', type: 'stamp', x: 0, y: 0, w: 30, h: 15, name: 'Image', color: '#000000', image: 'sharp' };
		await stampsSharp([item], 2);
		const small = stampBitmap('sharp', 2)!;
		expect(small.width).toBe(60);
		await stampsSharp([item], 11);
		// Steps of two: 16 pixels per point
		expect(stampBitmap('sharp', 11)!.width).toBe(480);
		// Shown smaller again: the sharp one stays
		expect(stampBitmap('sharp', 1)!.width).toBe(480);
	});

	it('reads its own annotations back as the items they were, also on a page turned since', async () => {
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const mark: MarkupItem = { id: 'm1', type: 'markup', kind: 'strikeout', color: '#dc2626ff', boxes: [{ x0: 40, y0: 50, x1: 120, y1: 70 }], dir: 0, text: 'Gone' };
		const out = await (await IncrementalPdf.open(base)).update({
			annotations: new Map([[0, [withData(annotationOf(stroke, toUser, undefined, date), stroke, date, 0, 300, 400), withData(annotationOf(mark, toUser, undefined, date), mark, date, 0, 300, 400)]]])
		});
		const found = (await IncrementalPdf.open(out)).annotations(0);
		const id = (wanted: string | undefined) => wanted ?? 'new';
		const items = found.flatMap((a) => itemsOf(a, toShown(pageTransform([0, 0, 300, 400], 0)), 0, id));
		expect(items).toEqual([stroke, mark]);
		// Shown turned by 90° now: the items turn along
		const [turned] = itemsOf(found[1], toShown(pageTransform([0, 0, 300, 400], 90)), 90, id);
		expect(turned).toMatchObject({ dir: 90, boxes: [{ x0: 330, y0: 40, x1: 350, y1: 120 }] });
	});

	it('keeps the steps a comment shows at and a page\'s hidden speaker notes, and copies a page once more without its annotations', async () => {
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const stepped = withFlips(stroke, [0, 1, 3]);
		const out = await (await IncrementalPdf.open(base)).update({
			annotations: new Map([[0, [withData(annotationOf(stepped, toUser, undefined, date), stepped, date, 0, 300, 400), notesAnnotation('Say hello', [0, 0, 300, 400], date)]]])
		});
		const found = (await IncrementalPdf.open(out)).annotations(0);
		const notes = found.filter(isNotesAnnotation);
		expect(notes.map((a) => a.contents)).toEqual(['Say hello']);
		const items = found.filter((a) => !isNotesAnnotation(a)).flatMap((a) => itemsOf(a, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (id) => id ?? 'new'));
		expect(items.map(flipsOf)).toEqual([[0, 1, 3]]);
		// The notes are never drawn: the page stays white where they lie
		expect(white(await pixel(out, 1, 0, 0.5, 0.5))).toBe(true);
		// The first page once more at the end, without its annotations (the tool writes its items anew)
		const copied = await (await IncrementalPdf.open(out)).update({ pages: [{ base: 0 }, { base: 1 }, { copy: { pdf: out, index: 0, annotations: false } }] });
		const again = await IncrementalPdf.open(copied);
		expect(again.pageCount).toBe(3);
		expect(again.annotations(0)).toHaveLength(2);
		expect(again.annotations(2)).toEqual([]);
		expect(red(await pixel(copied, 1, 0, 80, 60))).toBe(true);
		expect(white(await pixel(copied, 3, 0, 80, 60))).toBe(true);
	});

	it('reads annotations of other programs from their standard entries, and PDF.js leaves out hidden ones', async () => {
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		// Written without the item: as another program would
		const out = await (await IncrementalPdf.open(base)).update({
			annotations: new Map([[0, [annotationOf(stroke, toUser, undefined, new Date()), annotationOf(box, toUser, undefined, new Date())]]])
		});
		const found = (await IncrementalPdf.open(out)).annotations(0);
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const [ink, square] = found.flatMap((a) => itemsOf(a, toPage, 0, (w) => w ?? 'x'));
		expect(ink).toMatchObject({ id: 's1', tool: 'pen', color: '#ff0000', size: 6 });
		expect(Array.from((ink as Stroke).points)).toEqual([40, 60, 0.5, 120, 60, 0.5]);
		expect(square).toMatchObject({ id: 'b1', type: 'shape', color: '#ff0000', size: 4, fill: '#ff0000ff' });
		const fit = (square as ShapeItem).fit as { x: number; y: number; w: number; h: number };
		expect([fit.x, fit.y, fit.w, fit.h].map(Math.round)).toEqual([150, 150, 60, 40]);

		// Hidden in PDF.js (the editor draws them itself)
		const pdf = await openPdf(out.slice());
		for (const a of found) pdf.annotationStorage.setValue(a.id, { noView: true });
		const page = await pdf.getPage(1);
		const viewport = page.getViewport({ scale: 2 });
		const canvas = document.createElement('canvas');
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		await page.render({ canvas, viewport, annotationMode: 3 }).promise;
		const c = [...canvas.getContext('2d')!.getImageData(160, 120, 1, 1).data.slice(0, 3)];
		expect(white(c)).toBe(true);
		await pdf.loadingTask.destroy();
	});

	it('reads see-through colors of other programs from their appearance, times /CA', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date();
		const items = [
			{ ...stroke, color: '#ff000080' },
			{ ...box, color: '#0000ff80', fill: '#00ff0040' },
			{ id: 'm2', type: 'markup', kind: 'highlight', color: '#ff000080', boxes: [{ x0: 40, y0: 250, x1: 120, y1: 270 }], dir: 0, text: 'x' },
			{ id: 'm3', type: 'markup', kind: 'underline', color: '#0000ff80', boxes: [{ x0: 40, y0: 300, x1: 120, y1: 320 }], dir: 0, text: 'y' },
			{ id: 'n2', type: 'note', x: 200, y: 50, color: '#fcd34d80', text: '' }
		] satisfies PdfItem[];
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, items.map((item) => annotationOf(item, toUser, undefined, date))]]) });
		const found = (await IncrementalPdf.open(out)).annotations(0);
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const read = found.flatMap((a) => itemsOf(a, toPage, 0, (w) => w ?? 'x'));
		expect(read.map((item) => ['color' in item ? item.color : undefined, 'fill' in item ? item.fill : undefined])).toEqual([
			['#ff000080', undefined],
			['#0000ff80', '#00ff0040'],
			['#ff000080', undefined],
			['#0000ff80', undefined],
			['#fcd34d80', undefined]
		]);
		// `/CA` on top: half of each
		const [ink] = itemsOf({ ...found[0], opacity: 0.5 }, toPage, 0, (w) => w ?? 'x');
		expect(ink).toMatchObject({ color: '#ff000040' });
	});

	it('writes replies as /Text notes answering their comment (/IRT), found by name or by ref, and reads them back', async () => {
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const date = new Date('2026-11-20T10:00:00Z');
		const note = annotationOf({ id: 'n9', type: 'note', x: 100, y: 50, color: '#fcd34d', text: 'Prüfen' }, toUser, 'Ann', date);
		const reply = (name: string, replyTo: string, contents: string): NewAnnotation => ({
			subtype: 'Text',
			name,
			rect: note.rect,
			author: 'Bo',
			contents,
			modified: date,
			replyTo,
			appearance: { content: '' }
		});
		// In the same update: by the note's name
		const first = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [note, reply('r1', 'n9', 'Erledigt')]]]) });
		const opened = await IncrementalPdf.open(first);
		const [found] = opened.annotations(0);
		expect(found).toMatchObject({ subtype: 'Text', author: 'Ann', contents: 'Prüfen' });
		expect(opened.replies(0)).toEqual([expect.objectContaining({ parent: found.ref, author: 'Bo', contents: 'Erledigt', name: 'r1' })]);
		// Later: by the note's ref; deleting the note takes its replies along
		const second = await opened.update({ annotations: new Map([[0, [reply('r2', found.ref, 'Danke')]]]) });
		const again = await IncrementalPdf.open(second);
		expect(again.replies(0).map((r) => r.contents)).toEqual(['Erledigt', 'Danke']);
		const gone = await again.update({ remove: new Set([found.ref]) });
		expect((await IncrementalPdf.open(gone)).replies(0)).toEqual([]);
		// PDF.js sees the reply as one
		const pdf = await openPdf(second.slice());
		const annotations = await (await pdf.getPage(1)).getAnnotations();
		expect(annotations.filter((a) => a.inReplyTo).map((a) => a.contentsObj?.str)).toEqual(['Erledigt', 'Danke']);
		await pdf.loadingTask.destroy();
	});

	it('writes a sticky note as /Text with its comment and reads it back', async () => {
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const note: NoteItem = { id: 'n1', type: 'note', x: 100, y: 50, color: '#fcd34d', text: 'Prüfen – bitte' };
		const date = new Date();
		const plain = annotationOf(note, toUser, undefined, date);
		expect(plain).toMatchObject({ subtype: 'Text', icon: 'Comment', contents: 'Prüfen – bitte', rect: [99.5, 329.5, 120.5, 350.5] });
		const out = await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [plain, withData(plain, note, date, 0, 300, 400)]]]) });
		// The bubble in its color
		const c = await pixel(out, 1, 0, 110, 56.2);
		expect(c[0] > 200 && c[1] > 150 && c[2] < 120).toBe(true);
		const opened = await openPdf(out.slice());
		const [annotation] = await (await opened.getPage(1)).getAnnotations();
		expect(annotation).toMatchObject({ subtype: 'Text', contentsObj: { str: 'Prüfen – bitte' } });
		await opened.loadingTask.destroy();
		const found = (await IncrementalPdf.open(out)).annotations(0);
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const [fromEntries, fromData] = found.map((a) => itemsOf(a, toPage, 0, (w) => w ?? 'x')[0]);
		expect(fromData).toEqual(note);
		expect(fromEntries).toEqual(note);
	});

	it('writes a text box as /FreeText in Helvetica, its lines where they are on screen, and reads it back', async () => {
		await loadTextFont();
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't1', type: 'text', x: 40, y: 100, w: 140, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [] };
		const box = withText(empty, 'Größe – zwei Zeilen');
		expect(box.lines).toEqual(['Größe – zwei', 'Zeilen']);
		expect(box.h).toBeCloseTo(2 * 2 + 2 * 20 * 1.2);
		const date = new Date();
		const out = await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [withData(annotationOf(box, toUser, undefined, date), box, date, 0, 300, 400)]]]) });
		const opened = await openPdf(out.slice());
		const [annotation] = await (await opened.getPage(1)).getAnnotations();
		expect(annotation).toMatchObject({ subtype: 'FreeText', contentsObj: { str: 'Größe – zwei Zeilen' } });
		await opened.loadingTask.destroy();
		// Ink where the first line is written, none right of its end or below the second line
		expect(await darkIn(out, 42, 104, 60, 119)).toBeGreaterThan(20);
		expect(await darkIn(out, 165, 100, 180, 150)).toBe(0);
		expect(await darkIn(out, 40, 152, 180, 170)).toBe(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.defaultAppearance).toBe('/Helv 20 Tf 0 0 0 rg');
		expect(itemsOf(found, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x')).toEqual([box]);
		// Without our entry: from its standard entries
		const [plain] = itemsOf({ ...found, data: undefined }, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x');
		expect(plain).toMatchObject({ type: 'text', size: 20, color: '#000000', lines: box.lines, rot: 0 });
	});

	it('writes formatted text in the fonts of its parts, with the formats for other programs, and reads both back', async () => {
		await Promise.all([loadTextFont(), loadFonts()]);
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 'rt', type: 'text', x: 20, y: 100, w: 0, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], sizing: 'auto-width' };
		const plain = withText(empty, 'Hello big world');
		// One word bold and red: the box grows by what bold takes; a list item below in another font
		const rich: RichText = [
			{ spans: [{ text: 'Hello ' }, { text: 'big', bold: true, color: '#ff0000', underline: true }, { text: ' world' }] },
			{ spans: [{ text: 'item', font: 'mono', italic: true }], list: 'number' }
		];
		const box = withRich(empty, rich);
		expect(box.text).toBe('Hello big world\nitem');
		expect(box.lines).toEqual(['Hello big world', 'item']);
		expect(box.w).toBeGreaterThan(plain.w);
		expect(box.h).toBeCloseTo(2 * 2 + 2 * 20 * 1.2);
		// Formats taken back: the plain box again, nothing kept that isn't needed
		expect(withRich(box, [{ spans: [{ text: 'Hello big world' }] }])).toEqual(plain);

		const date = new Date();
		const written = annotationOf(box, toUser, undefined, date);
		// (the list item's mark stands upright in its paragraph's font)
		expect(written.appearance.fonts).toEqual({ Helv: 'Helvetica', Fsans1: 'Helvetica-Bold', Fmono0: 'Courier', Fmono2: 'Courier-Oblique' });
		expect(written.richContents).toContain('<span style="font-family:Helvetica;font-size:20pt;color:#ff0000;font-weight:bold;font-style:normal;text-decoration:underline">big</span>');
		const out = await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [withData(written, box, date, 0, 300, 400)]]]) });
		// Red ink where the bold word stands (and its underline), none where the plain words are
		const pdf = await openPdf(out.slice());
		const viewport = (await pdf.getPage(1)).getViewport({ scale: 2 });
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await (await pdf.getPage(1)).render({ canvas, viewport }).promise;
		await pdf.loadingTask.destroy();
		const shown = canvas.getContext('2d')!;
		const red = (x0: number, x1: number) => {
			const { data } = shown.getImageData(Math.round(x0 * 2), 104 * 2, Math.max(1, Math.round((x1 - x0) * 2)), 24 * 2);
			let n = 0;
			for (let k = 0; k < data.length; k += 4) if (data[k] === 255 && data[k + 1] === 0 && data[k + 2] === 0) n++;
			return n;
		};
		const start = 20 + 2 + measureStyled('Hello ', { font: 'sans', bold: false, italic: false, underline: false, size: 20, color: '#000000' });
		expect(red(start, start + 30)).toBeGreaterThan(20);
		expect(red(22, start - 2)).toBe(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(itemsOf(found, toPage, 0, (w) => w ?? 'x')).toEqual([box]);
		// Another program's box (no entry of ours): its formats from `/RC`, a list item's mark as text
		const [foreign] = itemsOf({ ...found, data: undefined }, toPage, 0, (w) => w ?? 'x') as TextItem[];
		expect(foreign.rich?.[0].spans).toEqual([{ text: 'Hello ' }, { bold: true, underline: true, color: '#ff0000', text: 'big' }, { text: ' world' }]);
		expect(foreign.rich?.[1].spans).toEqual([{ text: '1. ' }, { italic: true, font: 'mono', text: 'item' }]);
		expect(foreign.sizing).toBe('fixed');
		// Broken markup: the plain text
		expect((itemsOf({ ...found, data: undefined, richContents: '<body><p>open' }, toPage, 0, (w) => w ?? 'x')[0] as TextItem).rich).toBeUndefined();
	});

	it('writes a callout as a text box with its line and arrow (/CL, /IT /FreeTextCallout), and reads it back – also another program\'s', async () => {
		await loadTextFont();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		// The box right of its tip: the line leaves the left side's middle, 14 points straight, then to the tip
		const empty: TextItem = { id: 't7', type: 'text', x: 150, y: 100, w: 100, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], border: '#000000', borderWidth: 2, sizing: 'auto-height', callout: [50, 250] };
		const box = withText(empty, 'Hi');
		const middle = box.y + box.h / 2;
		const date = new Date();
		const written = withData(annotationOf(box, toUser, undefined, date), box, date, 0, 300, 400);
		expect(written).toMatchObject({ intent: 'FreeTextCallout', callout: [50, 150, 136, 400 - middle, 150, 400 - middle] });
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [written]]]) });
		// Ink on the straight piece and halfway down the slanted one, none beside it
		expect(await darkIn(out, 140, middle - 3, 146, middle + 3)).toBeGreaterThan(5);
		expect(await darkIn(out, 88, (middle + 250) / 2 - 6, 98, (middle + 250) / 2 + 6)).toBeGreaterThan(5);
		expect(await darkIn(out, 20, 100, 80, 160)).toBe(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(itemsOf(found, toPage, 0, (w) => w ?? 'x')).toEqual([box]);
		// Without our entry: the box from /Rect and /RD, the tip from /CL
		const [plain] = itemsOf({ ...found, data: undefined }, toPage, 0, (w) => w ?? 'x');
		expect(plain).toMatchObject({ type: 'text', x: 150, y: 100, w: 100, callout: [50, 250] });
	});

	it('writes a right-aligned text box with its lines at the right edge and /Q 2, and reads it back', async () => {
		await loadTextFont();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't5', type: 'text', x: 40, y: 100, w: 200, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], align: 'right', sizing: 'auto-height' };
		const box = withText(empty, 'Hi');
		const date = new Date();
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [withData(annotationOf(box, toUser, undefined, date), box, date, 0, 300, 400)]]]) });
		// Ink at the right end of the box (inside its padding), none at the left
		expect(await darkIn(out, 210, 104, 238, 119)).toBeGreaterThan(10);
		expect(await darkIn(out, 42, 100, 180, 125)).toBe(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.quadding).toBe(2);
		const [plain] = itemsOf({ ...found, data: undefined }, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x');
		expect(plain).toMatchObject({ type: 'text', align: 'right' });
	});

	it('justifies all but the last line of a paragraph, without /Q (other programs know no justified text)', async () => {
		await loadTextFont();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't6', type: 'text', x: 40, y: 100, w: 200, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], align: 'justify', sizing: 'auto-height' };
		const box = withText(empty, 'aa bb cc dd ee ff gg hh ii');
		expect(box.lines.length).toBe(2);
		const date = new Date();
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [withData(annotationOf(box, toUser, undefined, date), box, date, 0, 300, 400)]]]) });
		// The first line reaches the right edge, the last one stays short at the left
		expect(await darkIn(out, 220, 104, 238, 119)).toBeGreaterThan(5);
		expect(await darkIn(out, 42, 128, 60, 143)).toBeGreaterThan(5);
		expect(await darkIn(out, 200, 128, 238, 143)).toBe(0);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.quadding).toBeUndefined();
	});

	it('writes lines beyond WinAnsi in an embedded subset of Liberation Sans, the others in Helvetica', async () => {
		await loadTextFont();
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't2', type: 'text', x: 40, y: 100, w: 200, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], sizing: 'auto-height' };
		const box = withText(empty, 'Łódź\nПривет\nplain');
		const date = new Date();
		const written = annotationOf(box, toUser, undefined, date);
		expect(written.appearance.fonts).toEqual({ Helv: 'Helvetica', Uni: 'Unicode' });
		const out = await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [written]]]) });
		// The font is in the file as a subset (Type0 with an embedded TrueType), the placeholders replaced
		const text = new TextDecoder('latin1').decode(out);
		expect(text).toMatch(/\/Subtype \/Type0/);
		expect(text).toMatch(/\/FontFile2/);
		expect(text).not.toContain('<U:');
		// Ink on both lines that need it
		expect(await darkIn(out, 42, 104, 90, 119)).toBeGreaterThan(20);
		expect(await darkIn(out, 42, 128, 110, 143)).toBeGreaterThan(20);
		const opened = await openPdf(out.slice());
		const [annotation] = await (await opened.getPage(1)).getAnnotations();
		expect(annotation).toMatchObject({ subtype: 'FreeText', contentsObj: { str: 'Łódź\nПривет\nplain' } });
		await opened.loadingTask.destroy();
	});

	it('writes a see-through background of a text box with its opacity', async () => {
		await loadTextFont();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't3', type: 'text', x: 40, y: 100, w: 140, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], fill: '#0000ff80' };
		const box = withText(empty, 'Hallo');
		const date = new Date();
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [withData(annotationOf(box, toUser, undefined, date), box, date, 0, 300, 400)]]]) });
		const c = await pixel(out, 1, 0, 170, 110);
		expect(c.every((v, i) => Math.abs(v - [127, 127, 255][i]) < 30)).toBe(true);
		// Read like another program's (without our entry): the background's opacity from the appearance
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(found.paint).toEqual({ fill: 0.5, text: 1 });
		const toPage = toShown(pageTransform([0, 0, 300, 400], 0));
		const [plain] = itemsOf({ ...found, data: undefined }, toPage, 0, (w) => w ?? 'x');
		expect(plain).toMatchObject({ fill: '#0000ff80', color: '#000000' });
		// `/CA`: the whole box see-through – text and background
		const [whole] = itemsOf({ ...found, data: undefined, paint: undefined, opacity: 0.5 }, toPage, 0, (w) => w ?? 'x');
		expect(whole).toMatchObject({ fill: '#0000ff80', color: '#00000080' });
	});

	it('writes text running out of a fixed size inside /Rect, the box as /RD, and reads its sizing back', async () => {
		await loadTextFont();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't4', type: 'text', x: 40, y: 100, w: 140, h: 30, rot: 0, size: 20, color: '#000000', text: '', lines: [], fill: '#ffff00', sizing: 'fixed' };
		const box = withText(empty, 'Eins\nZwei\nDrei');
		expect(box.h).toBe(30);
		const date = new Date();
		const annotation = annotationOf(box, toUser, undefined, date);
		// The box is 30 high, the three lines 76: `/Rect` reaches down past them, `/RD` keeps the box
		expect(annotation.rect).toEqual([40, 224, 180, 300]);
		expect(annotation.inset).toEqual([0, 0, 0, 46]);
		const out = await (await IncrementalPdf.open(await sample())).update({ annotations: new Map([[0, [withData(annotation, box, date, 0, 300, 400)]]]) });
		// The third line shows below the box, on white
		expect(await darkIn(out, 42, 150, 90, 172)).toBeGreaterThan(10);
		const below = await pixel(out, 1, 0, 170, 160);
		expect(white(below)).toBe(true);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		expect(itemsOf(found, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x')).toEqual([box]);
		// Another program's: fixed, its box without `/RD`
		const [plain] = itemsOf({ ...found, data: undefined }, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x');
		expect(plain).toMatchObject({ sizing: 'fixed', x: 40, y: 100, w: 140, h: 30 });
	});

	it('writes a text box with background and border (inside the box, the text inside it) and reads them back', async () => {
		await loadTextFont();
		const base = await sample();
		const toUser = toUserSpace(pageTransform([0, 0, 300, 400], 0));
		const empty: TextItem = { id: 't2', type: 'text', x: 40, y: 100, w: 140, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], fill: '#ffff00', border: '#ff0000', borderWidth: 4 };
		const box = withText(empty, 'Hallo');
		expect(box.h).toBeCloseTo(2 * (2 + 4) + 20 * 1.2);
		const date = new Date();
		const annotation = annotationOf(box, toUser, undefined, date);
		expect(annotation).toMatchObject({ color: [1, 1, 0], width: 4, defaultAppearance: '1 0 0 RG /Helv 20 Tf 0 0 0 rg' });
		const out = await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [withData(annotation, box, date, 0, 300, 400)]]]) });
		// Border at the edge, background inside, the text inside the border
		expect(red(await pixel(out, 1, 0, 41, 120))).toBe(true);
		const inside = await pixel(out, 1, 0, 170, 120);
		expect(inside[0] > 240 && inside[1] > 240 && inside[2] < 40).toBe(true);
		expect(await darkIn(out, 46, 108, 70, 124)).toBeGreaterThan(20);
		const [found] = (await IncrementalPdf.open(out)).annotations(0);
		const [plain] = itemsOf({ ...found, data: undefined }, toShown(pageTransform([0, 0, 300, 400], 0)), 0, (w) => w ?? 'x');
		expect(plain).toMatchObject({ fill: '#ffff00', border: '#ff0000', borderWidth: 4, lines: box.lines });
	});
});
