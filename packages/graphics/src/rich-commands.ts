// The format commands of formatted text, the same in every tool (`graphics.md`): bold, italic, underline, font, font
// size, bullets, numbering and line spacing. **The rule every tool follows:** a command acts on the text selected in
// the field typed into (`richEditing`), else on the selected boxes as a whole (their own style – no part of their
// text says otherwise any more), else on the next new box where the tool has one. The tool says what its boxes are
// (`RichTextTarget`); labels, icons, ids and shortcuts are these.

import type { Command } from '@in-browser/brand/commands.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { customLabel, customNote, knownFont, registeredFamilies } from './fonts.js';
import { graphicsMessages } from './i18n/index.svelte.js';
import { richEditing } from './rich-editing.svelte.js';
import { isCustomFont, LINE_HEIGHTS, withList, type CustomFont, type FontFamily, type FullStyle, type ListKind, type RichText, type TextStyle } from './rich-text.js';

export interface RichTextTarget {
	/** Fonts the tool offers */
	fonts: readonly FontFamily[];
	/** The user's own fonts are offered too (“My fonts”, `user-fonts.svelte.ts`), with the way to the tool “Fonts” */
	userFonts?: { page: string };
	/** Fonts the open document brings (“Fonts of this PDF”); one that can't be used with the reason */
	documentFonts?: () => readonly (CustomFont | { label: string; reason: string })[];
	/** Font sizes to choose from (the tool's unit) and how one reads */
	sizes: () => readonly number[];
	sizeLabel: (size: number) => string;
	/** Any size typed in: as shown (the tool's unit, e.g. pt or canvas px) and its range there; `shown`/`stored`
	 * convert when the tool keeps sizes in another unit (missing: the same) */
	sizeField: { unit: string; min: number; max: number; step: number; decimals: number; shown?: (size: number) => number; stored?: (value: number) => number };
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
	ready: (fonts?: readonly FontFamily[]) => Promise<void>;
}

/** Equal within rounding (sizes may be fractions of a canvas) */
const same = (a: number | null, b: number) => a !== null && Math.abs(a - b) <= Math.abs(b) * 1e-6;

/** A font's name as shown: the bundled ones by our words, the others by their own; one not on this device says so */
export function fontName(font: FontFamily): string {
	const tm = graphicsMessages().text;
	return isCustomFont(font) ? (knownFont(font) ? customLabel(font) : tm.missingFont(customLabel(font))) : tm.fonts[font];
}

export function richTextCommands(t: RichTextTarget) {
	const tm = () => graphicsMessages().text;

	async function format(patch: TextStyle) {
		// A font chosen is there before anything is measured in it
		await t.ready(patch.font ? [patch.font] : undefined);
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
				const entry = (font: FontFamily): MenuEntry => {
					const note = isCustomFont(font) ? customNote(font) : undefined;
					return { label: fontName(font), checked: font === current, run: () => void format({ font }), ...(note && { note }) };
				};
				const entries: MenuEntry[] = t.fonts.map(entry);
				// A font of a text that isn't there (yet): shown checked, so the menu says what the text asks for
				const listed = new Set<FontFamily>(t.fonts);
				if (t.userFonts) {
					const own = registeredFamilies('user:').sort((a, b) => fontName(a).localeCompare(fontName(b)));
					entries.push({ heading: tm().myFonts }, ...own.map(entry));
					own.forEach((f) => listed.add(f));
				}
				const documents = t.documentFonts?.() ?? [];
				if (documents.length) {
					entries.push(
						{ heading: tm().documentFonts },
						...documents.map((f): MenuEntry => (typeof f === 'string' ? entry(f) : { label: f.label, disabled: true, note: f.reason, run: () => {} }))
					);
					documents.forEach((f) => typeof f === 'string' && listed.add(f));
				}
				if (current && !listed.has(current)) entries.push({ separator: true }, entry(current));
				if (t.userFonts) entries.push({ separator: true }, { label: tm().manageFonts, icon: 'icon-[material-symbols-light--font-download-outline]', href: t.userFonts.page, run: () => void open(t.userFonts!.page, '_blank', 'noopener') });
				return entries;
			}
		} satisfies Command,
		/** For the font size's field and list (`FontSizeButton`) */
		fontSizes: {
			enabled: t.formats,
			sizes: t.sizes,
			label: t.sizeLabel,
			field: t.sizeField,
			/** The size of the text it acts on; null when that has several */
			current: () => marks().size,
			/** The box's own size: shown in the field when the text has several */
			base: () => t.style().size,
			set: (size: number) => void format({ size }),
			same
		},
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
