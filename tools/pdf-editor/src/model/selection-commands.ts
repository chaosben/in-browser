// What the ribbon's contextual tabs do. The format tab of a kind
// (text box, note, marked text, drawing, a mix) shows while such items are selected – then it changes them, one undo
// step per choice – or while the tool drawing them is chosen – then it sets how the next one is drawn (remembered
// per tool). “Arrange” (draw order, align, distribute) only for a selection. What every drawing tool offers
// (duplicate, delete, thickness, arrange) comes from the ink core (`@in-browser/ink/ui/selection-commands.ts`). Colors, background, border and shape
// style are popovers the page places (they hold fields); these are the commands and what they work on.

import type { Command } from '@in-browser/brand/commands.js';
import { inkSelectionCommands } from '@in-browser/ink/ui/selection-commands.js';
import { m } from '#lib/i18n/index.js';
import type { EditorState } from '#lib/model/editor.svelte.js';
import type { PdfPage } from '#lib/model/document.svelte.js';
import { isCaretTool, isMarkTool, isTextTool, noteIcon, setNoteIcon, setTextAlign, setTextBoxStyle, setTextFormat, setTextSize, TEXT_SIZES, textStyle, tools } from '#lib/model/tools.svelte.js';
import { loadFonts } from '@in-browser/graphics/fonts.js';
import { richEditing } from '@in-browser/graphics/rich-editing.svelte.js';
import { DEFAULT_LINE_HEIGHT, FONT_FAMILIES, LINE_HEIGHTS, styleAll, withList, type FontFamily, type ListKind, type TextStyle } from '@in-browser/graphics/rich-text.js';
import { isCommented, isMarkup, type PdfItem } from '#lib/render/markup.js';
import { isCaret } from '#lib/render/caret.js';
import { isLink } from '#lib/render/link.js';
import { isStamp } from '#lib/render/stamp.js';
import { isNote, NOTE_ICONS, noteGlyph, noteIconOf, type NoteItem } from '#lib/render/note.js';
import type { TextSizing } from '@in-browser/graphics/text-box.js';
import { alignOf, baseStyle, BORDER_WIDTHS, isText, richTextOf, roomOf, sizingOf, withRich, withText, type TextAlign, type TextItem } from '#lib/render/textbox.js';

/** What a format tab is for: one kind of item, or several kinds */
export type FormatKind = 'text' | 'note' | 'markup' | 'drawing' | 'stamp' | 'link' | 'mixed';

/** The kind of the selected items */
export function kindOf(items: readonly PdfItem[]): FormatKind | null {
	if (!items.length) return null;
	const kinds = new Set(items.map((i): FormatKind => (isText(i) ? 'text' : isNote(i) ? 'note' : isMarkup(i) || isCaret(i) ? 'markup' : isStamp(i) ? 'stamp' : isLink(i) ? 'link' : 'drawing')));
	return kinds.size === 1 ? [...kinds][0] : 'mixed';
}

/** The kind a tool draws (null: it draws nothing, e.g. "Hand", "Select", "Eraser") */
export function toolKind(tool: string): FormatKind | null {
	if (tool === 'pen' || tool === 'highlighter' || tool === 'shape') return 'drawing';
	if (isMarkTool(tool) || isCaretTool(tool) || tool === 'area') return 'markup';
	if (tool === 'note') return 'note';
	if (isTextTool(tool)) return 'text';
	return null;
}

/** Background and border of text boxes (null: none) */
export type BoxStyle = Partial<Pick<TextItem, 'fill' | 'border' | 'borderWidth'>>;

export function selectionCommands(ed: EditorState, onedit: (id: string) => void) {
	const forTool = (kind: FormatKind): boolean => !sel() && toolKind(tools.tool) === kind;
	const ink = inkSelectionCommands<PdfPage, PdfItem>({ selection: () => ed.selection, tools, drawsInk: () => forTool('drawing') });
	/** The selection, when there is one (else the format tab works on the chosen tool) */
	const sel = ink.sel;
	const texts = () => (sel()?.items.filter(isText) ?? []) as TextItem[];

	/** Changes the selected text boxes (one step); their lines are broken anew */
	function changeTexts(change: (t: TextItem) => TextItem) {
		const s = sel();
		const doc = ed.doc;
		if (!s || !doc) return;
		const ids = new Set(texts().map((t) => t.id));
		const page = doc.pages[s.pageIndex];
		doc.items.change(s.pageIndex, ids, (i) => {
			if (!isText(i) || !ids.has(i.id)) return null;
			const next = change(i);
			return withText(next, i.text, page ? roomOf(next, page) : Infinity);
		});
		s.refresh();
	}

	/**
	 * A format of text – bold, a font, a size, a color: on what is selected in the box typed into; else on the selected
	 * boxes as a whole (their own style, and no part of their text says otherwise any more); else on new boxes. The
	 * fonts are there before anything is measured in them.
	 */
	async function formatText(patch: TextStyle) {
		await loadFonts();
		const typing = richEditing.current;
		if (typing) return typing.apply(patch);
		if (!sel()) {
			const { size, color, ...format } = patch;
			if (size) setTextSize(size);
			void color;
			return setTextFormat(Object.fromEntries(Object.entries(format).map(([key, value]) => [key, value ?? (key === 'font' ? 'sans' : false)])));
		}
		const cleared = Object.fromEntries(Object.keys(patch).map((key) => [key, undefined])) as TextStyle;
		changeTexts((t) => {
			const next: TextItem = { ...t, ...(t.rich && { rich: styleAll(t.rich, cleared) }) };
			for (const [key, value] of Object.entries(patch) as [keyof TextStyle, never][]) {
				if (key === 'size' || key === 'color') next[key] = value;
				else if (value && value !== 'sans') next[key] = value;
				else delete next[key];
			}
			return next;
		});
	}

	/** What the text a format command works on has: the selection typed in, the first selected box, or new boxes */
	const formatOf = () => {
		const typing = richEditing.current;
		if (typing) return typing.marks;
		const [t] = texts();
		return t ? baseStyle(t) : { font: textStyle.font, bold: textStyle.bold, italic: textStyle.italic, underline: textStyle.underline, size: textStyle.size, color: textStyle.color };
	};
	const formats = () => texts().length > 0 || forTool('text');

	const toggle = (key: 'bold' | 'italic' | 'underline', label: string, icon: string, letter: string): Command => ({
		id: key,
		label,
		icon,
		shortcut: { key: letter, ctrl: true },
		enabled: formats,
		active: () => formats() && formatOf()[key] === true,
		run: () => void formatText({ [key]: formatOf()[key] !== true })
	});

	/** Makes paragraphs list items (or plain again): those selected in the box typed into, else all of the selected boxes */
	const list = (kind: ListKind, label: string, icon: string): Command => ({
		id: `list:${kind}`,
		label,
		icon,
		enabled: () => texts().length > 0,
		active: () => (richEditing.current ? richEditing.current.list === kind : texts().length > 0 && texts().every((t) => richTextOf(t).every((p) => p.list === kind))),
		run: async () => {
			await loadFonts();
			const typing = richEditing.current;
			if (typing) return typing.setList(kind);
			const all = texts().every((t) => richTextOf(t).every((p) => p.list === kind));
			changeRich((t) => {
				const rich = richTextOf(t);
				// All of them alike, as one choice: every box gets the list, or every box loses it
				const some = rich.some((p) => p.list !== kind);
				return all || some ? withList(all ? rich : rich.map((p) => ({ ...p, list: undefined })), 0, rich.length - 1, all ? null : kind) : rich;
			});
		}
	});

	/** Gives the selected text boxes another formatted text (one step) */
	function changeRich(change: (t: TextItem) => ReturnType<typeof richTextOf>) {
		const s = sel();
		const doc = ed.doc;
		if (!s || !doc) return;
		const ids = new Set(texts().map((t) => t.id));
		const page = doc.pages[s.pageIndex];
		doc.items.change(s.pageIndex, ids, (i) => (isText(i) && ids.has(i.id) ? withRich(i, change(i), page ? roomOf(i, page) : Infinity) : null));
		s.refresh();
	}

	/** Background or border: of the selected text boxes, else of new ones */
	function styleTexts(style: BoxStyle) {
		if (!sel()) return setTextBoxStyle(style);
		changeTexts((t) => {
			const next = { ...t, ...style };
			if (next.border) next.borderWidth ??= 1;
			else delete next.borderWidth;
			return next;
		});
	}

	/** Background and border shown: the first selected text box's, else those of new ones */
	const boxStyle = () => {
		const [t] = texts();
		return t ? { fill: t.fill ?? null, border: t.border ?? null, borderWidth: t.borderWidth ?? 1 } : { fill: textStyle.fill, border: textStyle.border, borderWidth: textStyle.borderWidth };
	};

	/** The one selected item, when it is of a kind (to write its text) */
	const single = (is: (i: PdfItem) => boolean) => () => {
		const items = sel()?.items ?? [];
		return items.length === 1 && is(items[0]) ? items[0] : null;
	};
	const singleText = single(isText);
	/** How the selected text boxes follow their text (one of the three sizings) */
	const sizing = (to: TextSizing, label: string, tip: string, icon: string): Command => ({
		id: `sizing:${to}`,
		label,
		tip,
		icon,
		enabled: () => texts().length > 0,
		active: () => texts().length > 0 && texts().every((t) => sizingOf(t) === to),
		run: () => changeTexts((t) => ({ ...t, sizing: to }))
	});
	/** How the lines of the selected text boxes are aligned, else those of new ones */
	const align = (to: TextAlign, label: string, icon: string): Command => ({
		id: `textAlign:${to}`,
		label,
		icon,
		enabled: () => texts().length > 0 || forTool('text'),
		active: () => (sel() ? texts().length > 0 && texts().every((t) => alignOf(t) === to) : forTool('text') && textStyle.align === to),
		run: () => {
			if (!sel()) return setTextAlign(to);
			changeTexts(({ align: _, ...t }) => (to === 'left' ? t : { ...t, align: to }));
		}
	});
	const singleNote = single(isCommented);
	const notes = () => (sel()?.items ?? []).filter(isNote);
	/** Gives the selected notes another icon (one undo step) */
	function changeNotes(change: (n: NoteItem) => NoteItem) {
		const s = sel();
		const doc = ed.doc;
		if (!s || !doc) return;
		const ids = new Set(notes().map((n) => n.id));
		doc.items.change(s.pageIndex, ids, (i) => (isNote(i) && ids.has(i.id) ? change(i) : null));
		s.refresh();
	}

	return {
		// The ink core's: duplicate, delete, thickness, order, align, distribute
		...ink,
		sel,
		texts,
		boxStyle,
		styleTexts,
		forTool,
		editText: {
			id: 'editText',
			label: m.textbox.edit,
			icon: 'icon-[material-symbols-light--edit-outline]',
			enabled: () => !!singleText(),
			run: () => {
				const t = singleText();
				if (t) onedit(t.id);
			}
		},
		editComment: {
			id: 'editComment',
			label: m.note.edit,
			icon: 'icon-[material-symbols-light--edit-note-outline]',
			enabled: () => !!singleNote(),
			run: () => {
				const n = singleNote();
				if (n) onedit(n.id);
			}
		},
		noteIcon: {
			id: 'noteIcon',
			label: m.note.icon,
			icon: 'icon-[material-symbols-light--category-outline]',
			enabled: () => notes().length > 0 || forTool('note'),
			menu: () => {
				const current = sel() ? (notes()[0] ? noteIconOf(notes()[0]) : null) : noteIcon.value;
				return NOTE_ICONS.map((icon) => ({
					label: m.note.icons[icon],
					glyph: noteGlyph(icon),
					checked: icon === current,
					run: () => {
						if (!sel()) return setNoteIcon(icon);
						changeNotes(({ icon: _, ...n }) => (icon === 'Comment' ? n : { ...n, icon }));
					}
				}));
			}
		},
		autoWidth: sizing('auto-width', m.textbox.autoWidth, m.textbox.autoWidthTip, 'icon-[material-symbols-light--width]'),
		autoHeight: sizing('auto-height', m.textbox.autoHeight, m.textbox.autoHeightTip, 'icon-[material-symbols-light--height]'),
		alignLeft: align('left', m.textbox.alignLeft, 'icon-[material-symbols-light--format-align-left]'),
		alignCenter: align('center', m.textbox.alignCenter, 'icon-[material-symbols-light--format-align-center]'),
		alignRight: align('right', m.textbox.alignRight, 'icon-[material-symbols-light--format-align-right]'),
		justify: align('justify', m.textbox.justify, 'icon-[material-symbols-light--format-align-justify]'),
		fixedSize: sizing('fixed', m.textbox.fixedSize, m.textbox.fixedSizeTip, 'icon-[material-symbols-light--crop-free]'),
		fontSize: {
			id: 'fontSize',
			label: m.textbox.fontSize,
			icon: 'icon-[material-symbols-light--format-size]',
			enabled: () => texts().length > 0 || forTool('text'),
			menu: () => {
				const current = formatOf().size;
				return TEXT_SIZES.map((size) => ({
					label: m.textbox.sizeValue(size),
					checked: size === current,
					run: () => void formatText({ size })
				}));
			}
		},
		formatText,
		formatOf,
		bold: toggle('bold', m.textbox.bold, 'icon-[material-symbols-light--format-bold]', 'b'),
		italic: toggle('italic', m.textbox.italic, 'icon-[material-symbols-light--format-italic]', 'i'),
		underline: toggle('underline', m.textbox.underline, 'icon-[material-symbols-light--format-underlined]', 'u'),
		fontFamily: {
			id: 'fontFamily',
			label: m.textbox.font,
			icon: 'icon-[material-symbols-light--font-download-outline]',
			enabled: formats,
			menu: () => {
				const current = formatOf().font;
				return FONT_FAMILIES.map((font: FontFamily) => ({ label: m.textbox.fonts[font], checked: font === current, run: () => void formatText({ font }) }));
			}
		},
		lineHeight: {
			id: 'lineHeight',
			label: m.textbox.lineHeight,
			icon: 'icon-[material-symbols-light--format-line-spacing]',
			enabled: formats,
			menu: () => {
				const current = sel() ? (texts()[0]?.lineHeight ?? DEFAULT_LINE_HEIGHT) : textStyle.lineHeight;
				return LINE_HEIGHTS.map((height) => ({
					label: m.textbox.lineHeightValue(height),
					checked: height === current,
					run: async () => {
						await loadFonts();
						if (!sel()) return setTextFormat({ lineHeight: height });
						changeTexts(({ lineHeight: _, ...t }) => (height === DEFAULT_LINE_HEIGHT ? t : { ...t, lineHeight: height }));
					}
				}));
			}
		},
		bulleted: list('bullet', m.textbox.bulleted, 'icon-[material-symbols-light--format-list-bulleted]'),
		numbered: list('number', m.textbox.numbered, 'icon-[material-symbols-light--format-list-numbered]'),
		borderWidth: {
			id: 'borderWidth',
			label: m.textbox.borderWidth,
			icon: 'icon-[material-symbols-light--line-weight]',
			enabled: () => (sel() ? texts().some((t) => t.border) : forTool('text') && !!textStyle.border),
			menu: () => {
				const current = boxStyle().borderWidth;
				return BORDER_WIDTHS.map((w) => ({ label: m.textbox.borderWidthValue(w), checked: w === current, run: () => styleTexts({ borderWidth: w }) }));
			}
		}
	};
}
