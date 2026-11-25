import { describe, expect, it } from 'vitest';
import { pdfLib } from '../pdf-lib.js';
import { pageTransform } from '../geometry.js';
import { openPdf, standardFontUrl } from '../pdfjs.js';
import type { NewAnnotation } from './annotations.js';
import { IncrementalPdf, readTail, type FileBookmark, type NewBookmark } from './incremental.js';
import { pdfProducer } from '../producer.js';

// Incremental updates in real Chromium: written with our writer, read back by PDF.js (what the editor shows) and by
// pdf-lib (a second, independent parser).

async function sample(objectStreams: boolean, pages = 3): Promise<Uint8Array> {
	const { PDFDocument, StandardFonts } = await pdfLib();
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText(`Page ${i + 1}`, { x: 20, y: 360, size: 18, font });
	return doc.save({ useObjectStreams: objectStreams });
}

async function rotations(bytes: Uint8Array): Promise<number[]> {
	const pdf = await openPdf(bytes.slice());
	const out: number[] = [];
	for (let n = 1; n <= pdf.numPages; n++) out.push((await pdf.getPage(n)).rotate);
	await pdf.loadingTask.destroy();
	return out;
}

const prefix = (whole: Uint8Array, start: Uint8Array) => whole.length > start.length && whole.subarray(0, start.length).every((b, i) => b === start[i]);
const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('IncrementalPdf', () => {
	for (const objectStreams of [false, true]) {
		const kind = objectStreams ? 'stream' : 'table';
		it(`appends one section to a file with a cross-reference ${kind}`, async () => {
			const base = await sample(objectStreams);
			expect(readTail(base)?.kind).toBe(kind);
			const pdf = await IncrementalPdf.open(base);
			expect(pdf.pageCount).toBe(3);
			expect(pdf.encrypted).toBe(false);

			const out = await pdf.update({ rotate: new Map([[1, 90]]) });
			expect(prefix(out, base)).toBe(true);
			expect(await rotations(out)).toEqual([0, 90, 0]);
			const tail = readTail(out)!;
			expect(tail.kind).toBe(kind);
			expect(text(out.subarray(base.length))).toContain(`/Prev ${readTail(base)!.startxref}`);

			// pdf-lib reads it too
			const { PDFDocument } = await pdfLib();
			const again = await PDFDocument.load(out);
			expect(again.getPage(1).getRotation().angle).toBe(90);
			expect(again.getPage(0).getRotation().angle).toBe(0);
		});
	}

	it('builds the section anew on every update and gives the original back without changes', async () => {
		const base = await sample(false);
		const pdf = await IncrementalPdf.open(base);
		const first = await pdf.update({ rotate: new Map([[0, 90]]) });
		const second = await pdf.update({ rotate: new Map([[0, 180], [2, 270]]) });
		expect(prefix(second, base)).toBe(true);
		// One section: a single new trailer after the original
		expect(text(second.subarray(base.length)).match(/trailer/g)).toHaveLength(1);
		expect(second.length - base.length).toBeLessThan(2 * (first.length - base.length) + 200);
		expect(await rotations(second)).toEqual([180, 0, 270]);
		// Back to the original rotation: nothing to write
		expect(await pdf.update({ rotate: new Map([[0, 0]]) })).toBe(base);
		expect(await pdf.update({})).toBe(base);
	});

	it('keeps the first part of the document ID and changes the second', async () => {
		const { PDFDocument, PDFHexString } = await pdfLib();
		const doc = await PDFDocument.load(await sample(false));
		doc.context.trailerInfo.ID = doc.context.obj([PDFHexString.of('00112233445566778899aabbccddeeff'), PDFHexString.of('00112233445566778899aabbccddeeff')]);
		const base = await doc.save({ useObjectStreams: false });
		const pdf = await IncrementalPdf.open(base);
		const out = await pdf.update({ rotate: new Map([[0, 90]]) });
		const ids = (s: string) => [...s.matchAll(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)].map((m) => [m[1].toLowerCase(), m[2].toLowerCase()]);
		const [before] = ids(text(base));
		const after = ids(text(out.subarray(base.length)))[0];
		expect(after[0]).toBe(before[0]);
		expect(after[1]).not.toBe(before[1]);
	});

	it('repairs a file whose end can not be trusted once, then appends to the repaired file', async () => {
		const good = await sample(false);
		const s = text(good);
		const bytes = Uint8Array.from(new TextEncoder().encode(s.slice(0, s.lastIndexOf('startxref'))));
		expect(readTail(bytes)).toBeNull();
		const pdf = await IncrementalPdf.open(bytes);
		expect(pdf.repaired).toBe(true);
		expect(readTail(pdf.base)).not.toBeNull();
		expect(await pdf.update({})).toBe(pdf.base);
		const out = await pdf.update({ rotate: new Map([[2, 90]]) });
		expect(prefix(out, pdf.base)).toBe(true);
		expect(await rotations(out)).toEqual([0, 0, 90]);
	});

	it('adds annotations with their appearance, after those the page has', async () => {
		const base = await sample(true);
		const pdf = await IncrementalPdf.open(base);
		const ink: NewAnnotation = {
			subtype: 'Ink',
			name: 'ink-1',
			rect: [40, 40, 120, 90],
			color: [1, 0, 0],
			width: 2,
			author: 'Zoë',
			contents: 'Größer – 大きい',
			inkList: [[50, 50, 80, 70, 110, 80]],
			appearance: { content: '1 0 0 RG 2 w 1 J 1 j 50 50 m 80 70 l 110 80 l S' }
		};
		const once = await pdf.update({ annotations: new Map([[0, [ink]]]) });
		const opened = await openPdf(once.slice());
		const [annotation] = await (await opened.getPage(1)).getAnnotations();
		expect(annotation).toMatchObject({ subtype: 'Ink', annotationType: 15, titleObj: { str: 'Zoë' }, contentsObj: { str: 'Größer – 大きい' } });
		expect(annotation.rect).toEqual([40, 40, 120, 90]);
		await opened.loadingTask.destroy();

		// A second section on top of the first (the next session): both annotations, the page turned too
		const next = await IncrementalPdf.open(once);
		const twice = await next.update({ rotate: new Map([[0, 90]]), annotations: new Map([[0, [{ ...ink, name: 'ink-2', subtype: 'Square', inkList: undefined }]]]) });
		const again = await openPdf(twice.slice());
		const page = await again.getPage(1);
		expect(page.rotate).toBe(90);
		expect((await page.getAnnotations()).map((a: { subtype: string }) => a.subtype)).toEqual(['Ink', 'Square']);
		await again.loadingTask.destroy();
		const { PDFDocument } = await pdfLib();
		expect((await PDFDocument.load(twice)).getPage(0).node.Annots()?.size()).toBe(2);
	});

	it('reads annotations of the file and writes changed ones anew in their place, keeping their other entries', async () => {
		const base = await sample(true);
		const ink: NewAnnotation = {
			subtype: 'Ink',
			name: 'ink-1',
			rect: [40, 40, 120, 90],
			color: [1, 0, 0],
			width: 2,
			author: 'Zoë',
			inkList: [[50, 50, 80, 70, 110, 80]],
			data: '{"a":"ä (x)"}',
			appearance: { content: '1 0 0 RG 2 w 50 50 m 110 80 l S' }
		};
		const box: NewAnnotation = { ...ink, subtype: 'Square', name: 'box-1', inkList: undefined, data: undefined, color: [0, 0, 1], dash: [3, 2] };
		const pdf = await IncrementalPdf.open(await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [ink, box]]]) }));
		const [a, b] = pdf.annotations(0);
		expect(a).toMatchObject({ subtype: 'Ink', name: 'ink-1', author: 'Zoë', width: 2, color: [1, 0, 0], inkList: [[50, 50, 80, 70, 110, 80]] });
		expect(JSON.parse(a.data!)).toEqual({ a: 'ä (x)' });
		expect(a.id).toMatch(/^\d+R$/);
		expect(b).toMatchObject({ subtype: 'Square', dash: [3, 2], color: [0, 0, 1], opacity: 1 });

		// The ink recolored (its author stays), the box taken off
		const out = await pdf.update({ replace: new Map([[a.ref, { ...ink, author: undefined, color: [0, 1, 0] }]]), remove: new Set([b.ref]) });
		const again = await IncrementalPdf.open(out);
		const left = again.annotations(0);
		expect(left).toHaveLength(1);
		expect(left[0]).toMatchObject({ ref: a.ref, color: [0, 1, 0], author: 'Zoë' });
		const opened = await openPdf(out.slice());
		expect((await (await opened.getPage(1)).getAnnotations()).map((x: { subtype: string }) => x.subtype)).toEqual(['Ink']);
		await opened.loadingTask.destroy();
		// Nothing changed: the file as it was
		expect(await pdf.update({})).toBe(pdf.base);
	});

	it('writes subjects, replies and review states, reads them apart and patches a subject in place', async () => {
		const base = await sample(true);
		const note: NewAnnotation = { subtype: 'Text', name: 'n', rect: [10, 10, 30, 30], icon: 'Key', subject: 'Notiz', contents: 'Hi', appearance: { content: '' } };
		const reply: NewAnnotation = { subtype: 'Text', name: 'r', rect: [10, 10, 30, 30], replyTo: 'n', contents: 'Ok', author: 'Ada', appearance: { content: '' } };
		const done: NewAnnotation = { subtype: 'Text', name: 's', rect: [10, 10, 30, 30], replyTo: 'r', state: 'Completed', author: 'Ada', appearance: { content: '' } };
		const pdf = await IncrementalPdf.open(await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [note, reply, done]]]) }));
		const [read] = pdf.annotations(0);
		expect(read).toMatchObject({ name: 'n', icon: 'Key', subject: 'Notiz' });
		const replies = pdf.replies(0);
		expect(replies).toEqual([expect.objectContaining({ name: 'r', parent: read.ref, contents: 'Ok' })]);
		expect(pdf.states(0)).toEqual([expect.objectContaining({ name: 's', parent: replies[0].ref, state: 'Completed', author: 'Ada' })]);
		// The state is never shown
		const opened = await openPdf((await pdf.update({})).slice());
		const shown = (await (await opened.getPage(1)).getAnnotations()).filter((a: { noView?: boolean; hidden?: boolean }) => !a.noView && !a.hidden);
		expect(shown.map((a: { titleObj?: { str: string } }) => a.titleObj?.str)).not.toContain('Ada:Completed');
		await opened.loadingTask.destroy();
		// A subject changed: only that entry
		const patched = await IncrementalPdf.open(await pdf.update({ patch: new Map([[read.ref, { subject: 'Wichtig' }]]) }));
		expect(patched.annotations(0)[0]).toMatchObject({ ref: read.ref, subject: 'Wichtig', icon: 'Key', contents: 'Hi' });
	});

	it('writes the annotations of a page in another order, the new ones in their places', async () => {
		const base = await sample(true);
		const note = (name: string): NewAnnotation => ({ subtype: 'Square', name, rect: [10, 10, 20, 20], color: [0, 0, 0], width: 1, appearance: { content: '' } });
		const pdf = await IncrementalPdf.open(await (await IncrementalPdf.open(base)).update({ annotations: new Map([[0, [note('a'), note('b'), note('c')]]]) }));
		const [a, b, c] = pdf.annotations(0);
		// b to the back, a new one between c and a
		const out = await pdf.update({ annotations: new Map([[0, [note('d')]]]), order: new Map([[0, [b.ref, c.ref, 0, a.ref]]]) });
		expect((await IncrementalPdf.open(out)).annotations(0).map((x) => x.name)).toEqual(['b', 'c', 'd', 'a']);
	});

	/** The color of a page's pixel at a point of the page as shown (points from the top left) */
	async function pixel(bytes: Uint8Array, n: number, x: number, y: number): Promise<number[]> {
		const pdf = await openPdf(bytes.slice());
		const page = await pdf.getPage(n);
		const viewport = page.getViewport({ scale: 1 });
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await page.render({ canvas, viewport }).promise;
		const data = canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data;
		await pdf.loadingTask.destroy();
		return [data[0], data[1], data[2]];
	}

	it('puts a color under a page, replaces and removes it, also on blank and edited pages', async () => {
		const base = await sample(false, 2);
		const pdf = await IncrementalPdf.open(base);
		const red = await pdf.update({ pages: [{ base: 0 }, { blank: { width: 100, height: 100 } }, { base: 1 }], background: new Map([[0, [1, 0, 0]], [1, [0, 0, 1]]]) });
		expect(prefix(red, base)).toBe(true);
		expect(await pixel(red, 1, 150, 200)).toEqual([255, 0, 0]);
		expect(await pixel(red, 2, 50, 50)).toEqual([0, 0, 255]);
		expect(await pixel(red, 3, 150, 200)).toEqual([255, 255, 255]);
		// The page's own content lies on it
		const opened = await openPdf(red.slice());
		expect(((await (await opened.getPage(1)).getTextContent()).items as { str: string }[]).map((i) => i.str).join('')).toBe('Page 1');
		await opened.loadingTask.destroy();

		// Read again: the colors are known, another one takes the place (never two), none takes it away
		const again = await IncrementalPdf.open(red);
		expect([0, 1, 2].map((i) => again.background(i))).toEqual([[1, 0, 0], [0, 0, 1], null]);
		// The background is no object of the page's content
		expect(again.contentObjects(0)?.map((o) => o.kind)).toEqual(['text']);
		const green = await again.update({ background: new Map<number, [number, number, number] | null>([[0, [0, 1, 0]], [1, null]]) });
		expect(await pixel(green, 1, 150, 200)).toEqual([0, 255, 0]);
		expect(await pixel(green, 2, 50, 50)).toEqual([255, 255, 255]);
		const last = await IncrementalPdf.open(green);
		expect([0, 1].map((i) => last.background(i))).toEqual([[0, 1, 0], null]);
		// Content written anew keeps the color under it
		const text = last.contentObjects(0)![0];
		const moved = await last.update({ content: new Map([[0, new Map([[text.id, { matrix: [1, 0, 0, 1, 0, -100] as [number, number, number, number, number, number] }]])]]) });
		expect(await pixel(moved, 1, 150, 200)).toEqual([0, 255, 0]);
		expect((await IncrementalPdf.open(moved)).background(0)).toEqual([0, 1, 0]);
	});

	it('gives pages another size: the content and the annotations that stay go along, also on a turned page', async () => {
		const { PDFDocument, rgb, degrees } = await pdfLib();
		const doc = await PDFDocument.create();
		// A black square at the top left of each page as shown (the second page is turned a quarter)
		doc.addPage([300, 400]).drawRectangle({ x: 0, y: 300, width: 100, height: 100, color: rgb(0, 0, 0) });
		const turned = doc.addPage([400, 300]);
		turned.setRotation(degrees(90));
		turned.drawRectangle({ x: 0, y: 0, width: 100, height: 100, color: rgb(0, 0, 0) });
		const base = await doc.save({ useObjectStreams: false });
		expect(await pixel(base, 2, 50, 50)).toEqual([0, 0, 0]);
		const first = await IncrementalPdf.open(base);
		const kept: NewAnnotation = { subtype: 'Square', name: 'kept', rect: [0, 300, 100, 400], color: [0, 0, 0], width: 1, appearance: { content: '' } };
		const withNote = await first.update({ annotations: new Map([[0, [kept]]]) });
		const pdf = await IncrementalPdf.open(withNote);

		// Both pages 600 × 800 as shown, the content twice as large (it fills the page)
		const out = await pdf.update({
			resize: new Map([
				[0, { width: 600, height: 800, matrix: [2, 0, 0, 2, 0, 0] }],
				[1, { width: 800, height: 600, matrix: [2, 0, 0, 2, 0, 0] }]
			]),
			background: new Map([[0, [1, 1, 0]]])
		});
		const opened = await openPdf(out.slice());
		expect((await opened.getPage(1)).view).toEqual([0, 0, 600, 800]);
		expect((await opened.getPage(2)).view).toEqual([0, 0, 800, 600]);
		await opened.loadingTask.destroy();
		for (const n of [1, 2]) {
			expect(await pixel(out, n, 150, 150)).toEqual([0, 0, 0]);
			expect(await pixel(out, n, 250, 250)).not.toEqual([0, 0, 0]);
		}
		// The color fills the new page, the annotation lies on the square as before
		expect(await pixel(out, 1, 590, 790)).toEqual([255, 255, 0]);
		expect((await IncrementalPdf.open(out)).annotations(0).map((a) => a.rect)).toEqual([[0, 600, 200, 800]]);

		// The content keeps its size in the middle of a larger page: a margin around it
		const centered = await pdf.update({ resize: new Map([[0, { width: 500, height: 600, matrix: [1, 0, 0, 1, 100, 100] }]]) });
		expect(await pixel(centered, 1, 50, 50)).toEqual([255, 255, 255]);
		expect(await pixel(centered, 1, 150, 150)).toEqual([0, 0, 0]);
	});

	it('writes pages in a new order, without deleted ones and with blank ones, as a flat tree', async () => {
		const base = await sample(true);
		const pdf = await IncrementalPdf.open(base);
		const note: NewAnnotation = { subtype: 'Square', name: 'q', rect: [10, 10, 20, 20], color: [0, 0, 0], width: 1, appearance: { content: '' } };
		// Page 3 first, a blank one (turned) with an annotation, page 1; page 2 deleted
		const out = await pdf.update({
			pages: [{ base: 2 }, { blank: { width: 200, height: 100 } }, { base: 0 }],
			rotate: new Map([[1, 90]]),
			annotations: new Map([[1, [note]]])
		});
		expect(prefix(out, base)).toBe(true);
		const opened = await openPdf(out.slice());
		expect(opened.numPages).toBe(3);
		const words = async (n: number) => ((await (await opened.getPage(n)).getTextContent()).items as { str: string }[]).map((i) => i.str).join('');
		expect(await words(1)).toBe('Page 3');
		expect(await words(3)).toBe('Page 1');
		const blank = await opened.getPage(2);
		expect(blank.view).toEqual([0, 0, 200, 100]);
		expect(blank.rotate).toBe(90);
		expect((await blank.getAnnotations()).map((a: { subtype: string }) => a.subtype)).toEqual(['Square']);
		await opened.loadingTask.destroy();
		// Read again: three pages, the next update builds on them
		const again = await IncrementalPdf.open(out);
		expect(again.pageCount).toBe(3);
		expect(again.annotations(1).map((a) => a.name)).toEqual(['q']);
	});

	it('writes bookmarks with their style and places, keeps targets of the file, and drops those on deleted pages', async () => {
		const base = await sample(false);
		const pdf = await IncrementalPdf.open(base);
		expect(pdf.outline()).toEqual([]);
		const out = await pdf.update({
			outline: [
				{ title: 'Überblick', bold: true, color: [1, 0, 0], open: true, target: { page: 1, top: 300 }, items: [{ title: 'Inner', target: { page: 2, top: null }, items: [] }] },
				{ title: 'Last', italic: true, target: null, items: [{ title: 'Closed', target: { page: 0, top: 100 }, items: [] }] }
			]
		});
		expect(prefix(out, base)).toBe(true);
		// PDF.js reads them as viewers show them
		const shown = await openPdf(out.slice());
		const outline = await shown.getOutline();
		expect(outline.map((o) => [o.title, o.bold, o.italic, o.count])).toEqual([
			['Überblick', true, false, 1],
			['Last', false, true, -1]
		]);
		expect(await shown.getPageIndex((outline[0].dest as [{ num: number; gen: number }])[0])).toBe(1);
		await shown.loadingTask.destroy();
		// And so do we: the file's bookmarks with their pages and tops
		const read = (await IncrementalPdf.open(out)).outline();
		expect(read).toMatchObject([
			{ title: 'Überblick', bold: true, open: true, color: [1, 0, 0], page: 1, top: 300, items: [{ title: 'Inner', page: 2, top: null }] },
			{ title: 'Last', italic: true, open: false, page: null, items: [{ title: 'Closed', page: 0, top: 100 }] }
		]);
		// Written again with their targets kept and the second page deleted: the bookmark to it leads nowhere
		const again = await IncrementalPdf.open(out);
		const keep = (b: FileBookmark): NewBookmark => ({ title: b.title, target: { keep: b.ref }, items: b.items.map(keep) });
		const second = await again.update({ pages: [{ base: 0 }, { base: 2 }], outline: read.map(keep) });
		const after = (await IncrementalPdf.open(second)).outline();
		expect(after.map((b) => [b.title, b.page, b.items.map((i) => i.page)])).toEqual([
			['Überblick', null, [1]],
			['Last', null, [0]]
		]);
		// Taken away altogether
		const none = await (await IncrementalPdf.open(second)).update({ outline: [] });
		expect((await IncrementalPdf.open(none)).outline()).toEqual([]);
	});

	it('changes the properties in /Info and in the XMP metadata, and reads them back', async () => {
		const { PDFDocument } = await pdfLib();
		const made = await PDFDocument.create();
		made.addPage([300, 400]);
		made.setTitle('Old title');
		made.setAuthor('Ada');
		const xmp = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Old title</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
		made.catalog.set(made.context.obj('Metadata') as never, made.context.register(made.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })));
		const base = await made.save({ useObjectStreams: false });
		const pdf = await IncrementalPdf.open(base);
		expect(pdf.info()).toMatchObject({ title: 'Old title', author: 'Ada' });
		const out = await pdf.update({ info: { title: 'Neuer Titel – 1', author: '', keywords: 'a, b' } });
		expect(prefix(out, base)).toBe(true);
		const shown = await openPdf(out.slice());
		const meta = await shown.getMetadata();
		expect(meta.info).toMatchObject({ Title: 'Neuer Titel – 1', Keywords: 'a, b' });
		expect((meta.info as { Author?: string }).Author).toBeUndefined();
		expect(meta.metadata?.get('dc:title')).toBe('Neuer Titel – 1');
		// Written here: the producer is the suite at this address; the program that made the file stays its creator
		expect(meta.info).toMatchObject({ Producer: pdfProducer(), Creator: expect.stringContaining('pdf-lib') });
		expect(pdfProducer()).toBe(`in-browser (${location.origin})`);
		expect(meta.metadata?.get('pdf:producer')).toBe(pdfProducer());
		await shown.loadingTask.destroy();
		expect((await IncrementalPdf.open(out)).info()).toMatchObject({ title: 'Neuer Titel – 1', keywords: 'a, b' });
		// Any change names the producer; a file made here (extracted, merged) names the suite as its creator too
		const annotated = await (await IncrementalPdf.open(base)).update({ rotate: new Map([[0, 90]]) });
		const created = await (await IncrementalPdf.open(base)).update({ created: true, info: { author: 'Bea' } });
		for (const [bytes, creator] of [
			[annotated, expect.stringContaining('pdf-lib')],
			[created, pdfProducer()]
		] as const) {
			const doc = await openPdf(bytes.slice());
			expect((await doc.getMetadata()).info).toMatchObject({ Producer: pdfProducer(), Creator: creator });
			await doc.loadingTask.destroy();
		}
	});

	it('sanitizes: metadata, embedded files, scripts, bookmarks and earlier versions are gone from the bytes', async () => {
		const { PDFDocument, StandardFonts } = await pdfLib();
		const made = await PDFDocument.create();
		made.setAuthor('Ada Secretname');
		const font = await made.embedFont(StandardFonts.Helvetica);
		made.addPage([300, 400]).drawText('Kept text', { x: 20, y: 360, size: 18, font });
		await made.attach(new TextEncoder().encode('ATTACHEDSECRET'), 'secret.txt', { mimeType: 'text/plain' });
		made.addJavaScript('hello', 'app.alert("SCRIPTSECRET")');
		const base = await made.save({ useObjectStreams: false });
		// One earlier version appended, with a bookmark
		const updated = await (await IncrementalPdf.open(base)).update({ outline: [{ title: 'Chapter', target: { page: 0, top: null }, items: [] }], rotate: new Map([[0, 90]]) });
		const pdf = await IncrementalPdf.open(updated);
		expect(pdf.inspect()).toMatchObject({ attachments: 1, scripts: 1, bookmarks: 1, versions: 1 });
		expect(pdf.inspect().metadata).toBeGreaterThan(0);
		const out = await pdf.sanitize({ metadata: true, attachments: true, scripts: true, bookmarks: true });
		const raw = text(out);
		for (const secret of ['Secretname', 'ATTACHEDSECRET', 'SCRIPTSECRET', 'Chapter']) expect(raw).not.toContain(secret);
		expect(raw.match(/startxref/g)).toHaveLength(1);
		expect(await rotations(out)).toEqual([90]);
		const shown = await openPdf(out.slice());
		expect((await (await shown.getPage(1)).getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join('')).toBe('Kept text');
		await shown.loadingTask.destroy();
		expect((await IncrementalPdf.open(out)).inspect()).toEqual({ metadata: 0, attachments: 0, scripts: 0, bookmarks: 0, versions: 0 });
	});

	it('lists the fonts the pages use with their programs: complete, a subset, or only named', async () => {
		const { PDFDocument, StandardFonts } = await pdfLib();
		const fontkit = (await import('@pdf-lib/fontkit')).default;
		const bytes = new Uint8Array(await (await fetch(standardFontUrl('LiberationSans-Regular.ttf')!)).arrayBuffer());
		const made = await PDFDocument.create();
		made.registerFontkit(fontkit);
		const page = made.addPage([300, 400]);
		page.drawText('Whole', { font: await made.embedFont(bytes, { subset: false }), size: 12, x: 10, y: 300 });
		page.drawText('Part', { font: await made.embedFont(await (await fetch(standardFontUrl('LiberationSans-Bold.ttf')!)).arrayBuffer(), { subset: true }), size: 12, x: 10, y: 200 });
		page.drawText('Std', { font: await made.embedFont(StandardFonts.Courier), size: 12, x: 10, y: 100 });
		const fonts = (await IncrementalPdf.open(await made.save())).fonts();
		const by = (name: string) => fonts.find((f) => f.name === name);
		expect(by('LiberationSans')).toMatchObject({ subset: false, kind: 'truetype' });
		expect(by('LiberationSans')!.bytes!.length).toBe(bytes.length);
		// pdf-lib doesn't mark its subsets by name: the program is just smaller
		expect(by('LiberationSans-Bold')).toMatchObject({ kind: 'truetype' });
		expect(by('LiberationSans-Bold')!.bytes!.length).toBeLessThan(bytes.length / 2);
		expect(by('Courier')).toMatchObject({ kind: 'none', bytes: null });
	});

	it('copies pages of another PDF in, with everything they use, and draws on them', async () => {
		const base = await sample(true);
		const other = await sample(false, 2);
		const pdf = await IncrementalPdf.open(base);
		const note: NewAnnotation = { subtype: 'Square', name: 'c', rect: [10, 10, 20, 20], color: [0, 0, 0], width: 1, appearance: { content: '' } };
		const out = await pdf.update({
			pages: [{ base: 0 }, { copy: { pdf: other, index: 1 } }, { copy: { pdf: other, index: 0 } }, { base: 1 }, { base: 2 }],
			annotations: new Map([[1, [note]]]),
			rotate: new Map([[2, 180]])
		});
		expect(prefix(out, base)).toBe(true);
		const opened = await openPdf(out.slice());
		expect(opened.numPages).toBe(5);
		const words = async (n: number) => ((await (await opened.getPage(n)).getTextContent()).items as { str: string }[]).map((i) => i.str).join('');
		expect(await Promise.all([1, 2, 3, 4, 5].map(words))).toEqual(['Page 1', 'Page 2', 'Page 1', 'Page 2', 'Page 3']);
		expect((await (await opened.getPage(2)).getAnnotations()).map((a: { subtype: string }) => a.subtype)).toEqual(['Square']);
		expect((await opened.getPage(3)).rotate).toBe(180);
		await opened.loadingTask.destroy();
		const { PDFDocument } = await pdfLib();
		expect((await PDFDocument.load(out)).getPageCount()).toBe(5);
	});

	it('takes inherited rotations into account', async () => {
		const { PDFDocument, PDFName, PDFNumber } = await pdfLib();
		const doc = await PDFDocument.load(await sample(false));
		doc.catalog.Pages().set(PDFName.of('Rotate'), PDFNumber.of(90));
		const base = await doc.save({ useObjectStreams: false });
		const pdf = await IncrementalPdf.open(base);
		expect(pdf.rotation(0)).toBe(90);
		expect(await pdf.update({ rotate: new Map([[0, 90]]) })).toBe(base);
		expect(await rotations(await pdf.update({ rotate: new Map([[0, 180]]) }))).toEqual([180, 90, 90]);
	});

	it('computes the same page transform as PDF.js (geometry.ts)', async () => {
		const pdf = await openPdf((await sample(false, 1)).slice());
		const page = await pdf.getPage(1);
		for (const rotation of [0, 90, 180, 270]) expect(pageTransform(page.view, rotation)).toEqual(page.getViewport({ scale: 1, rotation }).transform);
		await pdf.loadingTask.destroy();
	});
});
