// pdf-lib, loaded on demand (export, writing PDFs). Its types are re-exported so tools don't depend on it themselves.

export type * from 'pdf-lib';

type PdfLib = typeof import('pdf-lib');
let lib: Promise<PdfLib> | null = null;

export function pdfLib(): Promise<PdfLib> {
	lib ??= import('pdf-lib');
	return lib;
}
