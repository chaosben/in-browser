// What goes on paper: the pages as pictures – the PDF page as the screen shows it (form values, layers, rotation),
// with or without the comments – and optionally the comments as a list. Printed by `printParts` of the brand package.

import type { PrintPart } from '@in-browser/brand/ui/print.js';
import { formatDateTime, m } from '#lib/i18n/index.js';
import { stampsSharp } from '#lib/render/stamp.js';
import { linkView } from '#lib/render/link.js';
import { stepView } from '#lib/render/steps.js';
import { commentList } from './comments.js';
import { sourceOf, type PdfDocument, type PdfPage } from './document.svelte.js';

/** Pixels per point: 200 dpi – sharp text on paper, and an A4 page stays below 4 megapixels */
const PRINT_SCALE = 200 / 72;
/** Most pixels of one page (phones refuse larger canvases; larger pages are rendered less fine) */
const MAX_PIXELS = 12_000_000;

/** A page as a picture (PNG) for printing; `comments` false leaves out everything commented on it */
export async function printedPage(doc: PdfDocument, page: PdfPage, comments: boolean): Promise<Blob> {
	const canvas = await pageCanvas(doc, page, { comments, scale: Math.min(PRINT_SCALE, Math.sqrt(MAX_PIXELS / (page.w * page.h))) });
	try {
		return await canvasBlob(canvas, 'image/png');
	} finally {
		freeCanvas(canvas);
	}
}

/**
 * A page drawn at `scale` (pixels per point) as the screen shows it – form values, layers, rotation – with the
 * comments on it, or without anything commented (`comments` false). `background` lies under the page's content
 * (a CSS color, `rgba(0,0,0,0)` for none; white without it) unless the page has a color of its own. Free it with `freeCanvas` when done.
 */
export async function pageCanvas(
	doc: PdfDocument,
	page: PdfPage,
	{ comments, scale, background }: { comments: boolean; scale: number; background?: string }
): Promise<HTMLCanvasElement> {
	background = page.background ?? background;
	let canvas: HTMLCanvasElement;
	if (page.number) canvas = await doc.renders.render(sourceOf(page), page.number, scale, { annotations: comments, background });
	else {
		// A blank page: just the background
		canvas = document.createElement('canvas');
		canvas.width = Math.ceil(page.w * scale);
		canvas.height = Math.ceil(page.h * scale);
	}
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No canvas');
	if (!page.number) {
		ctx.fillStyle = background ?? '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	const scene = comments ? doc.scene(page.id) : null;
	if (scene?.items.length) {
		// Vector stamps are drawn for the picture's resolution, not the screen's
		await stampsSharp(scene.items, canvas.width / page.w);
		ctx.setTransform(canvas.width / page.w, 0, 0, canvas.height / page.h, 0, 0);
		// The boxes of links and the steps are the editor's marks: never in a picture
		const shown = linkView.shown;
		const steps = stepView.shown;
		linkView.shown = false;
		stepView.shown = false;
		try {
			scene.draw(ctx, scene.items);
		} finally {
			linkView.shown = shown;
			stepView.shown = steps;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		}
	}
	return canvas;
}

/** The canvas encoded (`type` as `toBlob` takes it, `quality` 0–1 for JPEG and WebP) */
export async function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
	if (!blob) throw new Error('The page is too large for a picture');
	return blob;
}

/** Frees a canvas's memory now instead of with the garbage collector */
export function freeCanvas(canvas: HTMLCanvasElement) {
	canvas.width = canvas.height = 0;
}

/** A page's picture as a sheet of the print job (decoded, so the print dialog shows it at once) */
export async function pageSheet(page: PdfPage, url: string): Promise<PrintPart> {
	const img = new Image();
	img.alt = '';
	img.src = url;
	await img.decode();
	return { node: img, size: { width: page.w, height: page.h } };
}

function el(tag: string, style: string, text?: string): HTMLElement {
	const node = document.createElement(tag);
	node.style.cssText = style;
	if (text !== undefined) node.textContent = text;
	return node;
}

/** The comments of the pages at `places` as flowing text: by page – subject, author, date, status, text, replies */
export function commentSheet(doc: PdfDocument, places: readonly number[]): PrintPart {
	const when = (d: Date | null) => (d ? formatDateTime(d) : '');
	const by = (author: string, modified: Date | null, state: { state: keyof typeof m.comments.states } | null) =>
		[author || m.comments.unknownAuthor, when(modified), state && state.state !== 'None' ? m.comments.states[state.state] : ''].filter(Boolean).join(' · ');
	const root = el('div', 'font: 10pt/1.4 sans-serif; color: #000;');
	root.append(el('h1', 'font-size: 14pt; font-weight: 600; margin: 0 0 8pt;', m.print.listTitle(doc.name)));
	const pages = commentList(doc).filter((p) => places.includes(p.index));
	if (!pages.length) root.append(el('p', 'margin: 0;', m.print.listEmpty));
	for (const page of pages) {
		root.append(el('h2', 'font-size: 11pt; font-weight: 600; margin: 10pt 0 4pt; border-bottom: 0.5pt solid #999; break-after: avoid;', m.comments.page(page.index + 1)));
		for (const e of page.entries) {
			const entry = el('div', 'margin: 0 0 6pt; break-inside: avoid;');
			entry.append(el('div', 'font-weight: 600;', e.title), el('div', 'color: #555; font-size: 9pt;', by(e.info.author, e.info.modified, e.state)));
			if (e.text) entry.append(el('div', 'white-space: pre-wrap; overflow-wrap: anywhere;', e.text));
			for (const r of e.replies) {
				const reply = el('div', 'margin: 3pt 0 0 12pt; padding-left: 6pt; border-left: 0.5pt solid #999;');
				reply.append(el('div', 'color: #555; font-size: 9pt;', by(r.author, r.modified, r.state)), el('div', 'white-space: pre-wrap; overflow-wrap: anywhere;', r.text));
				entry.append(reply);
			}
			root.append(entry);
		}
	}
	return { node: root };
}
