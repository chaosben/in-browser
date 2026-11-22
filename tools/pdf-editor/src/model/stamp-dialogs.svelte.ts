// The two questions of the stamp tool, asked from the ribbon and from the panel alike: which page of a PDF with
// several pages to take, and what a word stamp says. The dialogs themselves are placed once in the editor.

import { picturePages } from './stamps.svelte.js';
import type { StampWord } from './stamp-words.js';

/** The page being chosen (`PdfPageDialog`) and the word being edited (`StampWordDialog`; `word` null: a new one) */
export const stampDialogs = $state<{
	page: { path: string; pages: number; done: (page: number | null) => void } | null;
	word: { word: StampWord | null } | null;
}>({ page: null, word: null });

/** The page of a picture file to take, and how many it has: asked only for a PDF with several pages (null:
 * cancelled) */
export async function choosePdfPage(path: string): Promise<{ page: number; pages: number } | null> {
	const pages = await picturePages(path);
	if (pages <= 1) return { page: 0, pages };
	const page = await new Promise<number | null>((resolve) => {
		stampDialogs.page?.done(null);
		stampDialogs.page = { path, pages, done: resolve };
	});
	stampDialogs.page = null;
	return page === null ? null : { page, pages };
}

export function editWord(word: StampWord | null) {
	stampDialogs.word = { word };
}
