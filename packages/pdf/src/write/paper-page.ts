// New, empty PDFs: pages of a chosen size with a paper – blank, lined, squared or dotted – drawn as real page content
// (thin vector lines), so every viewer and every printer shows it. Also the pages "Blank page" inserts with a paper.

import { pdfLib } from '../pdf-lib.js';
import { pdfProducer } from '../producer.js';

export const PAPERS = ['blank', 'lined', 'grid', 'dotted'] as const;
export type Paper = (typeof PAPERS)[number];

/** Names a page's paper in its dictionary (`/InBrowserPaper /lined`), so "Blank page" can give the next page the same
 * one – the ruling itself is plain content. Other programs ignore it and keep it with the page. */
export const PAPER_KEY = 'InBrowserPaper';

/** Page sizes in points, upright (width × height). Paper sizes may be turned; media sizes have their own shape */
export const PAGE_FORMATS = {
	a4: { w: 595.28, h: 841.89, kind: 'paper' },
	a5: { w: 419.53, h: 595.28, kind: 'paper' },
	a6: { w: 297.64, h: 419.53, kind: 'paper' },
	a3: { w: 841.89, h: 1190.55, kind: 'paper' },
	letter: { w: 612, h: 792, kind: 'paper' },
	legal: { w: 612, h: 1008, kind: 'paper' },
	// Slides as presentation programs make them (13.33 × 7.5 in, 10 × 7.5 in), a square, an upright screen
	wide: { w: 960, h: 540, kind: 'media' },
	standard: { w: 720, h: 540, kind: 'media' },
	square: { w: 600, h: 600, kind: 'media' },
	tall: { w: 540, h: 960, kind: 'media' }
} as const satisfies Record<string, { w: number; h: number; kind: 'paper' | 'media' }>;
export type PageFormat = keyof typeof PAGE_FORMATS;
export const PAGE_FORMAT_IDS = Object.keys(PAGE_FORMATS) as PageFormat[];

/** Smallest and largest side of a page of a size typed by hand (points: 1 cm … 2 m) */
export const PAGE_SIDE = { min: 28.35, max: 5669.29 };

/** Distance of lines (1 cm) and of the squares' and dots' grid (5 mm), in points */
export const LINE_SPACING = 28.35;
export const GRID_SPACING = 14.17;
/** Color of each paper's ruling: light, so writing stands out and prints stay readable */
const INK: Record<Exclude<Paper, 'blank'>, [number, number, number]> = {
	lined: [0.78, 0.824, 0.878],
	grid: [0.867, 0.89, 0.925],
	dotted: [0.604, 0.655, 0.722]
};
/** Width of a line, edge of a dot */
const HAIR = 0.5;
const DOT = 1.2;

const num = (n: number) => String(Math.round(n * 100) / 100);

/** The content stream of a paper on a page of `w` × `h` points (empty for blank paper) */
export function paperContent(paper: Paper, w: number, h: number): string {
	if (paper === 'blank') return '';
	const ops = [`${INK[paper].map(num).join(' ')} rg`];
	const rect = (x: number, y: number, rw: number, rh: number) => ops.push(`${num(x)} ${num(y)} ${num(rw)} ${num(rh)} re`);
	// From the top, as one writes (PDF's y runs up)
	if (paper === 'lined') for (let y = LINE_SPACING; y < h - 1; y += LINE_SPACING) rect(0, h - y - HAIR / 2, w, HAIR);
	else if (paper === 'grid') {
		for (let y = GRID_SPACING; y < h - 1; y += GRID_SPACING) rect(0, h - y - HAIR / 2, w, HAIR);
		for (let x = GRID_SPACING; x < w - 1; x += GRID_SPACING) rect(x - HAIR / 2, 0, HAIR, h);
	} else
		for (let y = GRID_SPACING; y < h - 1; y += GRID_SPACING)
			for (let x = GRID_SPACING; x < w - 1; x += GRID_SPACING) rect(x - DOT / 2, h - y - DOT / 2, DOT, DOT);
	ops.push('f');
	return ops.join('\n');
}

/** A PDF of `pages` empty pages of `width` × `height` points with a paper; made by the suite, by `author` (the user's
 * name from the settings, when given) */
export async function paperPdf({ width, height, paper = 'blank', pages = 1, author }: { width: number; height: number; paper?: Paper; pages?: number; author?: string }): Promise<Uint8Array> {
	const { PDFDocument, PDFName } = await pdfLib();
	const doc = await PDFDocument.create();
	doc.setProducer(pdfProducer());
	doc.setCreator(pdfProducer());
	if (author?.trim()) doc.setAuthor(author.trim());
	const content = paperContent(paper, width, height);
	// One stream for all pages
	const stream = content ? doc.context.register(doc.context.flateStream(content)) : null;
	for (let i = 0; i < Math.max(1, pages); i++) {
		const page = doc.addPage([width, height]);
		if (stream) page.node.set(PDFName.of('Contents'), stream);
		if (paper !== 'blank') page.node.set(PDFName.of(PAPER_KEY), PDFName.of(paper));
	}
	return doc.save();
}
