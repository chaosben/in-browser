// PDF.js, loaded only when a notebook has PDF pages or a PDF is imported. Parsing runs in its worker, drawing pages
// in its renderer worker (pages arrive as bitmaps; the main thread stays free for the pen). Its data files (standard
// fonts, CMaps, WebAssembly decoders) are build assets with hashed names; `AssetData` hands them out by file name.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import rendererUrl from 'pdfjs-dist/build/pdf.renderer.min.mjs?url';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const byName = (urls: Record<string, string>) => Object.fromEntries(Object.entries(urls).map(([path, url]) => [fileName(path), url]));

const DATA: Record<string, Record<string, string>> = {
	cMapUrl: byName(import.meta.glob('/node_modules/pdfjs-dist/cmaps/*.bcmap', { query: '?url', import: 'default', eager: true })),
	standardFontDataUrl: byName(
		import.meta.glob(['/node_modules/pdfjs-dist/standard_fonts/*.pfb', '/node_modules/pdfjs-dist/standard_fonts/*.ttf'], {
			query: '?url',
			import: 'default',
			eager: true
		})
	),
	wasmUrl: byName(import.meta.glob('/node_modules/pdfjs-dist/wasm/*.wasm', { query: '?url', import: 'default', eager: true }))
};

/** Data files for PDF.js from our build assets (instead of a folder URL) */
class AssetData {
	async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
		const url = DATA[kind]?.[filename];
		if (!url) throw new Error(`no PDF data file ${kind}/${filename}`);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`PDF data file ${filename}: ${response.status}`);
		return new Uint8Array(await response.arrayBuffer());
	}
}

type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | null = null;

export function pdfjs(): Promise<PdfJs> {
	lib ??= import('pdfjs-dist').then((pdf) => {
		pdf.GlobalWorkerOptions.workerSrc = workerUrl;
		pdf.GlobalWorkerOptions.rendererSrc = rendererUrl;
		return pdf;
	});
	return lib;
}

/** The file itself is the problem (not loading PDF.js or reading the file) */
export class PdfError extends Error {
	constructor(
		readonly reason: 'password' | 'invalid',
		cause?: unknown
	) {
		super(reason === 'password' ? 'the PDF is protected by a password' : 'not a readable PDF', { cause });
	}
}

/** Opens a PDF (its bytes are handed over to the worker) */
export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
	const pdf = await pdfjs();
	try {
		return await pdf.getDocument({
			data,
			BinaryDataFactory: AssetData,
			useWorkerFetch: false,
			cMapPacked: true,
			// Fonts a PDF doesn't embed (often Times New Roman, Arial): our standard font files (similar shapes, the
			// same on every device, offline) instead of looking for them on the device – Android lacks most of them
			useSystemFonts: false,
			// Our CSP allows no eval; PDF scripts never run
			isEvalSupported: false,
			enableScripting: false
		} as Parameters<PdfJs['getDocument']>[0]).promise;
	} catch (e) {
		const name = (e as { name?: string }).name;
		if (name === 'PasswordException') throw new PdfError('password', e);
		if (name === 'InvalidPDFException') throw new PdfError('invalid', e);
		// Anything else (worker didn't start, …) is no fault of the file
		throw e;
	}
}

/** Sizes of all pages in points, as shown (rotation applied) */
export async function pageSizes(doc: PDFDocumentProxy): Promise<{ w: number; h: number }[]> {
	const sizes: { w: number; h: number }[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const viewport = (await doc.getPage(i)).getViewport({ scale: 1 });
		sizes.push({ w: viewport.width, h: viewport.height });
	}
	return sizes;
}

/** Page sizes of a PDF file; throws `PdfError` if it can't be read */
export async function readPdfPages(file: Blob): Promise<{ w: number; h: number }[]> {
	const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
	try {
		if (!doc.numPages) throw new PdfError('invalid');
		return await pageSizes(doc);
	} finally {
		void doc.loadingTask.destroy();
	}
}
