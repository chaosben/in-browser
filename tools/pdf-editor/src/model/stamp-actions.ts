// Making stamps of what is in the open PDF: of the selected comments, or of everything in a box of a page (the
// page's own content with the comments on it) – kept as vectors in "My stamps" and chosen for the stamp tool.

import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { showError } from '@in-browser/files/errors.js';
import type { Box } from '@in-browser/ink/geometry.js';
import type { PdfForm } from '@in-browser/pdf/write/form.js';
import { m } from '#lib/i18n/index.js';
import type { EditorState } from './editor.svelte.js';
import { saveStamp } from './stamps.svelte.js';
import { choose, setStamp } from './tools.svelte.js';

async function keep(ed: EditorState, piece: Promise<PdfForm | null>) {
	try {
		const form = await piece;
		if (!form) return void toast(m.stamps.nothing, 'info');
		const path = await saveStamp(form, m.stamps.newName);
		setStamp({ custom: path });
		choose(ed.doc?.editable === 'yes' ? 'stamp' : 'hand');
		toast(m.stamps.saved, 'success');
	} catch (e) {
		showError(e, { context: '[pdf-editor] stamp' });
	}
}

/** A stamp of the selected comments */
export function stampFromSelection(ed: EditorState) {
	const selection = ed.selection;
	if (!ed.doc || !selection?.count) return;
	void keep(ed, ed.doc.piece(selection.pageIndex, { ids: new Set(selection.items.map((item) => item.id)) }));
}

/** A stamp of what `box` (as shown) holds of a page */
export function stampFromArea(ed: EditorState, page: number, box: Box) {
	if (ed.doc) void keep(ed, ed.doc.piece(page, { box }));
}
