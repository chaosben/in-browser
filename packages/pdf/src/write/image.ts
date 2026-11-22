// Pictures as PDF image objects: a JPEG as it is, everything else as 8-bit RGB with its opacity as a soft mask (both
// deflated by the browser). The same record is read back from an annotation of the file, so a picture is embedded
// once and never encoded again.

export interface PdfImage {
	/** Pixels */
	width: number;
	height: number;
	/** A JPEG file (`/DCTDecode`), or … */
	jpeg?: Uint8Array;
	/** … deflated RGB (3 bytes per pixel, `/FlateDecode`) with, when it is see-through somewhere, the deflated opacity */
	rgb?: Uint8Array;
	alpha?: Uint8Array;
}

/** Longer side of an embedded picture (larger ones are scaled down: stamps and pictures on a page need no more) */
const MAX_SIDE = 2000;

async function pipe(bytes: Uint8Array, through: CompressionStream | DecompressionStream): Promise<Uint8Array> {
	const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(through);
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A picture file decoded: by the browser's decoder, an SVG – which `createImageBitmap` refuses in Chromium –
 * through an image element (at the size it names) */
async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
	try {
		const bitmap = await createImageBitmap(blob);
		return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
	} catch (e) {
		const url = URL.createObjectURL(new Blob([blob], { type: 'image/svg+xml' }));
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
			if (!img.naturalWidth || !img.naturalHeight) throw e;
			return { source: img, width: img.naturalWidth, height: img.naturalHeight, close() {} };
		} catch {
			throw e;
		} finally {
			URL.revokeObjectURL(url);
		}
	}
}

/** A picture file (JPEG, PNG, WebP, GIF, AVIF, SVG with a size …) ready to be written into a PDF */
export async function encodeImage(blob: Blob): Promise<PdfImage> {
	const { source, close, ...bitmap } = await decode(blob);
	try {
		const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
		if (blob.type === 'image/jpeg' && scale === 1) return { width: bitmap.width, height: bitmap.height, jpeg: new Uint8Array(await blob.arrayBuffer()) };
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) throw new Error('No canvas');
		ctx.drawImage(source, 0, 0, width, height);
		const rgba = ctx.getImageData(0, 0, width, height).data;
		canvas.width = canvas.height = 0;
		const rgb = new Uint8Array(width * height * 3);
		const alpha = new Uint8Array(width * height);
		let opaque = true;
		for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
			rgb[i * 3] = rgba[p];
			rgb[i * 3 + 1] = rgba[p + 1];
			rgb[i * 3 + 2] = rgba[p + 2];
			alpha[i] = rgba[p + 3];
			if (rgba[p + 3] !== 255) opaque = false;
		}
		return { width, height, rgb: await pipe(rgb, new CompressionStream('deflate')), ...(!opaque && { alpha: await pipe(alpha, new CompressionStream('deflate')) }) };
	} finally {
		close();
	}
}

/** The picture decoded for drawing on screen */
export async function imageBitmap(image: PdfImage): Promise<ImageBitmap> {
	if (image.jpeg) return createImageBitmap(new Blob([image.jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
	if (!image.rgb) throw new Error('No picture');
	const rgb = await pipe(image.rgb, new DecompressionStream('deflate'));
	const alpha = image.alpha ? await pipe(image.alpha, new DecompressionStream('deflate')) : null;
	const n = image.width * image.height;
	if (rgb.length < n * 3 || (alpha && alpha.length < n)) throw new Error('Picture cut short');
	const data = new ImageData(image.width, image.height);
	for (let i = 0, p = 0; i < n; i++, p += 4) {
		data.data[p] = rgb[i * 3];
		data.data[p + 1] = rgb[i * 3 + 1];
		data.data[p + 2] = rgb[i * 3 + 2];
		data.data[p + 3] = alpha ? alpha[i] : 255;
	}
	return createImageBitmap(data);
}

/** Bytes as PDF source (one character per byte, as section objects are written) */
export function binary(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return out;
}

/** The objects of a picture: the image, then – when it has one – its soft mask, which is object `first + 1` */
export function imageObjects(image: PdfImage, first: number): string[] {
	const head = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /BitsPerComponent 8`;
	const stream = (dict: string, bytes: Uint8Array) => `<< ${dict} /Length ${bytes.length} >>\nstream\n${binary(bytes)}\nendstream`;
	if (image.jpeg) return [stream(`${head} /ColorSpace /DeviceRGB /Filter /DCTDecode`, image.jpeg)];
	if (!image.rgb) return [];
	const main = stream(`${head} /ColorSpace /DeviceRGB /Filter /FlateDecode${image.alpha ? ` /SMask ${first + 1} 0 R` : ''}`, image.rgb);
	return image.alpha ? [main, stream(`${head} /ColorSpace /DeviceGray /Filter /FlateDecode`, image.alpha)] : [main];
}
