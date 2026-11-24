// The format commands of formatted text, the same in every tool (`graphics.md`): bold, italic, underline, font, font
// size, bullets, numbering and line spacing. **The rule every tool follows:** a command acts on the text selected in
// the field typed into (`richEditing`), else on the selected boxes as a whole (their own style – no part of their
// text says otherwise any more), else on the next new box where the tool has one. The tool says what its boxes are
// (`RichTextTarget`); labels, icons, ids and shortcuts are these.

import type { Command } from '@in-browser/brand/commands.js';
import { graphicsMessages } from './i18n/index.svelte.js';
import { richEditing } from './rich-editing.svelte.js';
import { LINE_HEIGHTS, withList, type FontFamily, type FullStyle, type ListKind, type RichText, type TextStyle } from './rich-text.js';

export interface RichTextTarget {
	/** Fonts the tool offers */
	fonts: readonly FontFamily[];
	/** Font sizes to choose from (the tool's unit) and how one reads */
	sizes: () => readonly number[];
	sizeLabel: (size: number) => string;
	/** Something to format: boxes selected, or the next new one */
	formats: () => boolean;
	/** The style shown: of the first selected box, else of the next new one */
	style: () => FullStyle;
	/** Sets formats on the selected boxes as a whole, else on the next new box */
	format: (patch: TextStyle) => void;
	/** The formatted texts of the selected boxes (none selected: empty) */
	texts: () => readonly RichText[];
	/** Gives each selected box another formatted text (one undo step) */
	changeTexts: (change: (rich: RichText) => RichText) => void;
	/** Line height of the first selected box, else of the next new one; and setting it */
	lineHeight: () => number;
	setLineHeight: (height: number) => void;
	/** Resolves when the fonts are there (nothing is measured before) */
	ready: () => Promise<void>;
}

/** Equal within rounding (sizes may be fractions of a canvas) */
const same = (a: number | null, b: number) => a !== null && Math.abs(a - b) <= Math.abs(b) * 1e-6;

export function richTextCommands(t: RichTextTarget) {
	const tm = () => graphicsMessages().text;

	async function format(patch: TextStyle) {
		await t.ready();
		const typing = richEditing.current;
		if (typing) return typing.apply(patch);
		t.format(patch);
	}

	/** What the text a command works on has: the selection typed in, else the box's own style */
	const marks = () => richEditing.current?.marks ?? t.style();

	const toggle = (key: 'bold' | 'italic' | 'underline', icon: string, letter: string): Command => ({
		id: key,
		label: tm()[key],
		icon,
		shortcut: { key: letter, ctrl: true },
		enabled: t.formats,
		active: () => t.formats() && marks()[key] === true,
		run: () => void format({ [key]: marks()[key] !== true })
	});

	const allOf = (kind: ListKind) => t.texts().length > 0 && t.texts().every((rich) => rich.every((p) => p.list === kind));

	/** Paragraphs as list items (or plain again): those selected in the field typed into, else all of the selected boxes */
	const list = (kind: ListKind, label: string, icon: string): Command => ({
		id: `list:${kind}`,
		label,
		icon,
		enabled: () => t.texts().length > 0,
		active: () => (richEditing.current ? richEditing.current.list === kind : allOf(kind)),
		run: async () => {
			await t.ready();
			const typing = richEditing.current;
			if (typing) return typing.setList(kind);
			// All boxes alike, as one choice: every one gets the list, or every one loses it
			const all = allOf(kind);
			t.changeTexts((rich) => withList(all ? rich : rich.map((p) => ({ ...p, list: undefined })), 0, rich.length - 1, all ? null : kind));
		}
	});

	return {
		format,
		marks,
		bold: toggle('bold', 'icon-[material-symbols-light--format-bold]', 'b'),
		italic: toggle('italic', 'icon-[material-symbols-light--format-italic]', 'i'),
		underline: toggle('underline', 'icon-[material-symbols-light--format-underlined]', 'u'),
		fontFamily: {
			id: 'fontFamily',
			label: tm().font,
			icon: 'icon-[material-symbols-light--font-download-outline]',
			enabled: t.formats,
			menu: () => {
				const current = marks().font;
				return t.fonts.map((font) => ({ label: tm().fonts[font], checked: font === current, run: () => void format({ font }) }));
			}
		} satisfies Command,
		fontSize: {
			id: 'fontSize',
			label: tm().fontSize,
			icon: 'icon-[material-symbols-light--format-size]',
			enabled: t.formats,
			menu: () => {
				const current = marks().size;
				return t.sizes().map((size) => ({ label: t.sizeLabel(size), checked: same(current, size), run: () => void format({ size }) }));
			}
		} satisfies Command,
		bulleted: list('bullet', tm().bulleted, 'icon-[material-symbols-light--format-list-bulleted]'),
		numbered: list('number', tm().numbered, 'icon-[material-symbols-light--format-list-numbered]'),
		lineHeight: {
			id: 'lineHeight',
			label: tm().lineHeight,
			icon: 'icon-[material-symbols-light--format-line-spacing]',
			enabled: t.formats,
			menu: () => {
				const current = t.lineHeight();
				// A box may have one of its own (made before the choices were these): it stays in the list
				const heights = LINE_HEIGHTS.some((h) => same(current, h)) ? LINE_HEIGHTS : [...LINE_HEIGHTS, current].sort((a, b) => a - b);
				return heights.map((height) => ({
					label: tm().lineHeightValue(height),
					checked: same(current, height),
					run: async () => {
						await t.ready();
						t.setLineHeight(height);
					}
				}));
			}
		} satisfies Command
	};
}
