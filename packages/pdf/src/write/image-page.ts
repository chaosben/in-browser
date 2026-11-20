// An image as a PDF of one page (to insert it like the pages of another PDF): JPEG and PNG as they are, other formats
// the browser can decode (WebP, GIF, AVIF …) as PNG. The page is the image at 96 dpi, made smaller to fit A4 when it is
// larger (its side ratio kept).

import { pdfLib } from '../pdf-lib.js';

/** A4 in points: the most an image page measures (either way round) */
const A4 = [595.28, 841.89];

export async function imagePdf(image: Blob): Promise<Uint8Array> {
	const { PDFDocument } = await pdfLib();
	const doc = await PDFDocument.create();
	const bytes = new Uint8Array(await image.arrayBuffer());
	const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
	const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	const embedded = jpeg ? await doc.embedJpg(bytes) : await doc.embedPng(png ? bytes : await asPng(image));
	// 96 dpi → points, then into A4 (upright or across, as the image is)
	let w = (embedded.width * 72) / 96;
	let h = (embedded.height * 72) / 96;
	const [mw, mh] = w > h ? [A4[1], A4[0]] : A4;
	const k = Math.min(1, mw / w, mh / h);
	w *= k;
	h *= k;
	const page = doc.addPage([w, h]);
	page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
	return doc.save();
}

/** Any image the browser decodes, as PNG */
async function asPng(image: Blob): Promise<Uint8Array> {
	const bitmap = await createImageBitmap(image);
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
	bitmap.close();
	return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}
