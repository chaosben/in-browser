// The drawing surface of a PDF on the shared ink core: a white page with the PDF page rendered on it.

import type { Selection } from '@in-browser/ink/input/selection.svelte.js';
import type { ShapeSuggestion } from '@in-browser/ink/input/suggestion.svelte.js';
import type { Backdrop } from '@in-browser/ink/render/kit.js';
import type { Stage } from '@in-browser/ink/render/stage.js';
import { sourceOf, type PdfDocument, type PdfPage } from '#lib/model/document.svelte.js';
import type { PdfItem } from './markup.js';

export type PdfStage = Stage<PdfPage, PdfItem>;
export type PdfSelection = Selection<PdfPage, PdfItem>;
export type PdfSuggestion = ShapeSuggestion<PdfPage, PdfItem>;

/** The page's paper is white (a document color, not the theme's); the PDF page lies on it */
export function pdfBackdrop(doc: PdfDocument): Backdrop<PdfPage> {
	return {
		color: '#ffffff',
		key: (page) => `${sourceOf(page)}|${page.number}|${page.rotate}|${page.rev}`,
		paint(ctx, page, box) {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(Math.max(0, box.x0), Math.max(0, box.y0), Math.min(page.w, box.x1) - Math.max(0, box.x0), Math.min(page.h, box.y1) - Math.max(0, box.y0));
		},
		// A blank page has nothing under its items
		piece: (page, scale, tx, ty) => (page.number ? doc.renders.tile(sourceOf(page), page.number, scale, tx, ty) : undefined),
		frame: () => doc.renders.frame(),
		budget: (tiles) => {
			doc.renders.max = tiles;
		}
	};
}
