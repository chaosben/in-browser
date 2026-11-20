// What a comment is, in words and as an icon: its kind's name – shown when it has no subject of its own, and written
// as the subject of new ones (as Acrobat and PDF-XChange do).

import { m } from '#lib/i18n/index.js';
import { isMarkup, type PdfItem } from '#lib/render/markup.js';
import { isNote } from '#lib/render/note.js';
import { isText } from '#lib/render/textbox.js';

export function kindOf(item: PdfItem): { label: string; icon: string } {
	if (isNote(item)) return { label: m.commands.note, icon: 'icon-[material-symbols-light--sticky-note-2-outline]' };
	if (isText(item)) return { label: m.commands.textbox, icon: 'icon-[material-symbols-light--text-fields]' };
	if (isMarkup(item)) {
		if (item.kind === 'highlight') return { label: m.commands.highlight, icon: 'icon-[material-symbols-light--ink-highlighter]' };
		if (item.kind === 'underline') return { label: m.commands.underline, icon: 'icon-[material-symbols-light--format-underlined]' };
		return { label: m.commands.strikeout, icon: 'icon-[material-symbols-light--strikethrough-s]' };
	}
	return { label: m.ribbon.tabs.drawing, icon: 'icon-[material-symbols-light--ink-pen-outline]' };
}
