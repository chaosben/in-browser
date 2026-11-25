// A piece of a page as a vector picture (`PdfForm`): what a box holds of the page's own content, with annotations
// drawn on top as page content (their appearances) – how a stamp is made of comments or of a part of a page.

import { loadPdf } from '../load.js';
import { pdfLib } from '../pdf-lib.js';
import { PdfError } from '../pdfjs.js';
import type { NewAnnotation } from './annotations.js';
import { pdfForm, type PdfForm } from './form.js';
import { IncrementalPdf } from './incremental.js';

export interface Piece {
	/** The page whose content lies below: its PDF and index (none: only the annotations) */
	page?: { pdf: Uint8Array; index: number; password?: string };
	/** Drawn on top, in the page's user space */
	annotations?: readonly NewAnnotation[];
	/** What to take, in user space: x0, y0, x1, y1 */
	box: readonly [number, number, number, number];
	/** How the page is shown (degrees): the piece is upright as seen */
	rotate?: number;
}

export async function pieceForm({ page, annotations = [], box, rotate = 0 }: Piece): Promise<PdfForm> {
	const { PDFDocument, PDFArray, PDFDict, PDFName, PDFRef, degrees } = await pdfLib();
	const [x0, y0, x1, y1] = box;
	let doc = await PDFDocument.create();
	if (page) {
		const loaded = await loadPdf(page.pdf, false, page.password);
		if (loaded.locked) throw new PdfError('password');
		const source = loaded.doc.getPage(page.index);
		// The same user space as the page's: its content where it was
		const { x, y, width, height } = source.getMediaBox();
		const embedded = await doc.embedPage(source, { left: x, bottom: y, right: x + width, top: y + height }, [1, 0, 0, 1, 0, 0]);
		const made = doc.addPage([width, height]);
		made.drawPage(embedded);
		made.setMediaBox(x, y, width, height);
	} else {
		doc.addPage([x1 - x0, y1 - y0]).setMediaBox(x0, y0, x1 - x0, y1 - y0);
	}
	if (annotations.length) {
		// Written as annotations by the one writer, then drawn by the page: each appearance is a form in user space
		const written = await (await IncrementalPdf.open(await doc.save())).update({ annotations: new Map([[0, [...annotations]]]) });
		doc = (await loadPdf(written)).doc;
		const made = doc.getPage(0);
		const annots = made.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
		const ops: string[] = [];
		for (let i = 0; i < (annots?.size() ?? 0); i++) {
			const normal = annots!.lookupMaybe(i, PDFDict)?.lookupMaybe(PDFName.of('AP'), PDFDict)?.get(PDFName.of('N'));
			if (normal instanceof PDFRef) ops.push(`q /${made.node.newXObject('Ap', normal).decodeText()} Do Q`);
		}
		made.node.delete(PDFName.of('Annots'));
		if (ops.length) made.node.addContentStream(doc.context.register(doc.context.flateStream(ops.join('\n'))));
	}
	doc.getPage(0).setRotation(degrees(rotate));
	return pdfForm(await doc.save(), 0, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
}
