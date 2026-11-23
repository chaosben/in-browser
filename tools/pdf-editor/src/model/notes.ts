// Speaker notes: one text per page, kept in the PDF as a hidden `/Text` annotation of that page (never shown or
// printed; `/InBrowser` says it is the page's notes). It lies on the page, so it moves, is copied and deleted with it;
// other programs list it at most as a hidden comment. Not a comment here: the comments panel never shows it.

import type { ExistingAnnotation, NewAnnotation } from '@in-browser/pdf/write/annotations.js';

/** What `/InBrowser` holds for a page's notes */
const NOTES_DATA = JSON.stringify({ notes: 1 });

/** Is an annotation of the file a page's notes (ours)? */
export function isNotesAnnotation(a: Pick<ExistingAnnotation, 'subtype' | 'data'>): boolean {
	if (a.subtype !== 'Text' || !a.data) return false;
	try {
		return (JSON.parse(a.data) as { notes?: unknown }).notes === 1;
	} catch {
		return false;
	}
}

/** The annotation keeping a page's notes; `view`: the page's box in user space (it sits in its top left corner) */
export function notesAnnotation(text: string, view: readonly number[], modified: Date): NewAnnotation {
	const [x0, , , y1] = view;
	return {
		subtype: 'Text',
		name: `notes-${crypto.randomUUID()}`,
		rect: [x0, y1 - 1, x0 + 1, y1],
		contents: text,
		modified,
		hidden: true,
		icon: 'Note',
		open: false,
		data: NOTES_DATA,
		appearance: { content: '' }
	};
}
