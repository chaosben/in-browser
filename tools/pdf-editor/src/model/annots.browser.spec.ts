import { describe, expect, it } from 'vitest';
import type { ShapeItem, Stroke } from '@in-browser/ink/items.js';
import { pageTransform, toShown, toUserSpace } from '@in-browser/pdf/geometry.js';
import { pdfLib } from '@in-browser/pdf/pdf-lib.js';
import { openPdf } from '@in-browser/pdf/pdfjs.js';
import type { NewAnnotation } from '@in-browser/pdf/write/annotations.js';
import { IncrementalPdf } from '@in-browser/pdf/write/incremental.js';
import type { MarkupItem, PdfItem } from '#lib/render/markup.js';
import type { NoteItem } from '#lib/render/note.js';
import { loadTextFont, withText, type TextItem } from '#lib/render/textbox.js';
import { annotationOf } from './annots.js';
import { itemsOf, withData } from './imported.js';

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
