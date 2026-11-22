// Vector pictures: a one-page PDF whose page is drawn into an annotation's appearance as a form XObject – what a
// stamp made of an icon, an SVG, a PDF or a piece of a page is. The page is normalized when the form is made (its
// box starts at the origin, no rotation), so embedding it and showing it need no further geometry.

import type { PDFDocument, PDFPage, PDFRawStream, PDFRef } from 'pdf-lib';
import { loadPdf } from '../load.js';
import { pdfLib } from '../pdf-lib.js';
import { openPdf, PdfError } from '../pdfjs.js';
import type { PdfImage } from './image.js';

type Lib = Awaited<ReturnType<typeof pdfLib>>;

export interface PdfForm {
	/** Points */
	width: number;
	height: number;
	/** A PDF with one page of that size (box at the origin, upright); read from a file it is still being made */
	pdf: Uint8Array | Promise<Uint8Array>;
}

/** What a stamp shows instead of a word: pixels or vectors */
export type PdfPicture = PdfImage | PdfForm;
export const isForm = (picture: PdfPicture): picture is PdfForm => 'pdf' in picture;

type Box = { x: number; y: number; width: number; height: number };

/** The matrix that puts `box` of a page turned by `rotate` degrees (as viewers show it) upright at the origin, and
 * its size then */
function upright(box: Box, rotate: number): { matrix: [number, number, number, number, number, number]; width: number; height: number } {
	const { x: l, y: b, width: w, height: h } = box;
	switch (((rotate % 360) + 360) % 360) {
		case 90:
			return { matrix: [0, -1, 1, 0, -b, l + w], width: h, height: w };
		case 180:
			return { matrix: [-1, 0, 0, -1, l + w, b + h], width: w, height: h };
		case 270:
			return { matrix: [0, 1, -1, 0, b + h, -l], width: h, height: w };
		default:
			return { matrix: [1, 0, 0, 1, -l, -b], width: w, height: h };
	}
}

/** A document of one page showing `box` (user space; default: what viewers show of the page) of a page upright */
async function pageDocument(lib: Lib, page: PDFPage, box?: Box): Promise<{ doc: PDFDocument; width: number; height: number }> {
	const doc = await lib.PDFDocument.create();
	const shown = box ?? page.getCropBox();
	const { matrix, width, height } = upright(shown, page.getRotation().angle);
	const embedded = await doc.embedPage(page, { left: shown.x, bottom: shown.y, right: shown.x + shown.width, top: shown.y + shown.height }, matrix);
	doc.addPage([width, height]).drawPage(embedded);
	return { doc, width, height };
}

/** A page of a PDF – or the part `box` of it, in its user space – as a form */
export async function pdfForm(pdf: Uint8Array, index = 0, box?: Box): Promise<PdfForm> {
	const lib = await pdfLib();
	const loaded = await loadPdf(pdf);
	if (loaded.locked) throw new PdfError('password');
	if (index >= loaded.doc.getPageCount()) throw new PdfError('invalid');
	const { doc, width, height } = await pageDocument(lib, loaded.doc.getPage(index), box);
	return { width, height, pdf: await doc.save() };
}

/** A form XObject of a parsed document as a PDF of its own (how a stamp's vectors are read back from a file) */
export function formOfStream(lib: Lib, stream: PDFRawStream): PdfForm | undefined {
	const { PDFArray, PDFName, PDFNumber, PDFObjectCopier, PDFDocument } = lib;
	const numbers = (key: string) => {
		const array = stream.dict.lookupMaybe(PDFName.of(key), PDFArray);
		const values = array?.asArray().map((_, i) => array.lookupMaybe(i, PDFNumber)?.asNumber());
		return values?.every((v): v is number => v !== undefined) ? values : undefined;
	};
	const bbox = numbers('BBox');
	if (bbox?.length !== 4) return undefined;
	const m = numbers('Matrix') ?? [1, 0, 0, 1, 0, 0];
	if (m.length !== 6) return undefined;
	// Where the form's box lies once its matrix is applied
	const xs = [bbox[0], bbox[2]].flatMap((x) => [bbox[1], bbox[3]].map((y) => m[0] * x + m[2] * y + m[4]));
	const ys = [bbox[0], bbox[2]].flatMap((x) => [bbox[1], bbox[3]].map((y) => m[1] * x + m[3] * y + m[5]));
	const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
	const [width, height] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
	if (!(width > 0 && height > 0)) return undefined;
	const pdf = (async () => {
		const doc = await PDFDocument.create();
		const ref = doc.context.register(PDFObjectCopier.for(stream.dict.context, doc.context).copy(stream));
		const page = doc.addPage([width, height]);
		page.node.set(PDFName.of('Resources'), doc.context.obj({ XObject: { Fm0: ref } }));
		page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(`q 1 0 0 1 ${-x0} ${-y0} cm /Fm0 Do Q`)));
		return doc.save();
	})();
	// Read when it is needed; a failure shows there
	pdf.catch(() => {});
	return { width, height, pdf };
}

/** Forms as form XObjects in a document of their own (to be renumbered into an update): its new objects and each
 * form's object */
export async function embedForms(lib: Lib, forms: readonly PdfForm[]): Promise<{ doc: PDFDocument; numbers: number[]; refs: Map<PdfForm, PDFRef> }> {
	const doc = await lib.PDFDocument.create();
	const before = doc.context.largestObjectNumber;
	const refs = new Map<PdfForm, PDFRef>();
	for (const form of new Set(forms)) {
		const loaded = await loadPdf(await form.pdf);
		const embedded = await doc.embedPage(loaded.doc.getPage(0));
		await embedded.embed();
		refs.set(form, embedded.ref);
	}
	const numbers = doc.context
		.enumerateIndirectObjects()
		.map(([ref]) => ref.objectNumber)
		.filter((n) => n > before);
	return { doc, numbers, refs };
}

/** Longer side of a form drawn without a scale, in pixels (at most four times its size): previews */
const SCREEN_SIDE = 1600;

/** The form drawn as pixels, `scale` pixels per point (see-through where it paints nothing). Vectors have no
 * resolution of their own: whoever shows a form asks for the scale it is shown at, and again when that grows */
export async function formBitmap(form: PdfForm, scale = Math.min(4, SCREEN_SIDE / Math.max(form.width, form.height))): Promise<ImageBitmap> {
	// PDF.js takes the bytes over: a copy
	const doc = await openPdf((await form.pdf).slice());
	try {
		const page = await doc.getPage(1);
		const viewport = page.getViewport({ scale });
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(viewport.width));
		canvas.height = Math.max(1, Math.round(viewport.height));
		// A context of our own: PDF.js would take one without see-through pixels
		const canvasContext = canvas.getContext('2d');
		if (!canvasContext) throw new Error('No canvas');
		await page.render({ canvas: null, canvasContext, viewport, background: 'rgba(0,0,0,0)' }).promise;
		const bitmap = await createImageBitmap(canvas);
		canvas.width = canvas.height = 0;
		return bitmap;
	} finally {
		void doc.loadingTask.destroy();
	}
}
