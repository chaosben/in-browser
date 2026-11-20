// The drawing surface of a notebook on the shared ink core: what lies under the notes (the page's paper and, for
// imported pages, the PDF page – an ink `Backdrop`) and the core's classes for the notebook's pages and items.

import type { Selection } from '@in-browser/ink/input/selection.svelte.js';
import type { ShapeSuggestion } from '@in-browser/ink/input/suggestion.svelte.js';
import type { Backdrop } from '@in-browser/ink/render/kit.js';
import type { PictureSource } from '@in-browser/ink/render/pictures.js';
import { PageScene } from '@in-browser/ink/render/scene.js';
import type { Stage } from '@in-browser/ink/render/stage.js';
import { inkKit } from '@in-browser/ink/render/ink-kit.js';
import type { PdfPages } from '@in-browser/pdf/pages.js';
import type { Item, PageContent, PageMeta } from '#lib/model/types.js';
import { drawPaper, PAPER_COLOR } from './paper.js';

/** The drawing surface of a notebook */
export type NotesStage = Stage<PageMeta, Item>;
export type NotesSelection = Selection<PageMeta, Item>;
export type NotesSuggestion = ShapeSuggestion<PageMeta, Item>;

/** Paper, with the PDF page on top where there is one */
export function notesBackdrop(pdf: PdfPages | null): Backdrop<PageMeta> {
	return {
		color: PAPER_COLOR,
		key: (page) => `${page.paper}|${page.background?.asset ?? ''}|${page.background?.page ?? 0}`,
		paint: (ctx, page, box, scale) => drawPaper(ctx, page.paper, page.w, page.h, box, scale),
		piece: (page, scale, tx, ty) => (page.background && pdf ? pdf.tile(page.background.asset, page.background.page, scale, tx, ty) : undefined),
		frame: () => pdf?.frame(),
		budget: (tiles) => {
			if (pdf) pdf.max = tiles;
		}
	};
}

/** The drawable state of a page of a notebook */
export const pageScene = (content?: PageContent, pictures: PictureSource | null = null) => new PageScene(inkKit, content?.items, pictures);
