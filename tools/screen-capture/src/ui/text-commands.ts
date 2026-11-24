// The commands of the contextual tab “Text box” (selected text and callouts): the suite's format commands
// (`@in-browser/graphics/rich-commands.js` – bold, italic, underline, font, size, lists, line spacing; the same as the
// PDF Editor's), alignment and the three sizings. A format acts on the text selected in the field typed into (the
// “Text” field of the properties), else on the selected boxes as a whole – one undo step, remembered for the next
// text of that kind. Every change keeps the box within the canvas (`fitTextToCanvas`).

import type { Command } from '@in-browser/brand/commands.js';
import { richTextCommands } from '@in-browser/graphics/rich-commands.js';
import { isPlain, plainOf, styleAll, tidy, type RichText, type TextStyle } from '@in-browser/graphics/rich-text.js';
import type { TextSizing } from '@in-browser/graphics/text-box.js';
import { m } from '#lib/i18n/index.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import { rememberStyle } from '#lib/project/styles.js';
import type { CalloutAnnotation, Item, TextAlign, TextAnnotation } from '#lib/project/types.js';
import { fontsOf, FONT_IDS, loadFont } from '#lib/render/fonts.svelte.js';
import { baseStyle, fitTextToCanvas, lineHeightOf, overlayBounds, richTextOf } from '#lib/render/overlays.js';
import { updateItem } from '#lib/timeline/ops.js';

export type TextLike = TextAnnotation | CalloutAnnotation;

export const isTextLike = (item: Item | null | undefined): item is TextLike => item?.type === 'annotation' && (item.kind === 'text' || item.kind === 'callout');

/** Font sizes offered in canvas pixels */
const SIZES_PX = [16, 20, 24, 32, 40, 48, 64, 80, 96, 128];

/** The formatted text as a box keeps it: plain text drops `rich` */
export const richPatch = (rich: RichText): Partial<TextLike> => {
	const tidied = tidy(rich);
	return { text: plainOf(tidied), rich: isPlain(tidied) ? undefined : tidied };
};

/** How a box follows its text */
export const sizingOf = (a: TextLike): TextSizing => (a.boxWidth === undefined ? 'auto-width' : a.boxHeight === undefined ? 'auto-height' : 'fixed');

export function textCommands(editor: () => Editor | null, edit: () => void) {
	const texts = () => (editor()?.selectedItems.filter(isTextLike) ?? []) as TextLike[];

	/**
	 * Changes the selected text boxes as one undo step (`key` merges a gesture); each stays within the canvas.
	 * `remember`: what of it the next text of that kind starts with.
	 */
	function change(patchOf: (a: TextLike) => Partial<TextLike>, remember?: object, key?: string) {
		const ed = editor();
		const all = texts();
		if (!ed || !all.length) return;
		const { width: W, height: H } = ed.project;
		ed.update(
			(t) =>
				all.reduce((timeline, a) => {
					const patch = patchOf(a);
					const fit: Partial<TextLike> = fitTextToCanvas({ ...a, ...patch } as TextLike, (b) => overlayBounds(b, W, H));
					return updateItem<TextLike>(timeline, a.id, { ...patch, ...fit } as Partial<TextLike>);
				}, t),
			key
		);
		if (remember) for (const kind of new Set(all.map((a) => a.kind))) rememberStyle(kind, remember);
	}

	const rich = richTextCommands({
		fonts: FONT_IDS,
		sizes: () => SIZES_PX.map((px) => px / (editor()?.project.height || 1080)),
		sizeLabel: (size) => m.textbox.sizeValue(Math.round(size * (editor()?.project.height || 1080))),
		formats: () => texts().length > 0,
		style: () => {
			const [a] = texts();
			return a ? baseStyle(a) : { font: 'system', bold: false, italic: false, underline: false, size: 0.05, color: '#ffffff' };
		},
		format(patch: TextStyle) {
			// The boxes' own style; their parts no longer say otherwise
			const cleared = Object.fromEntries(Object.keys(patch).map((key) => [key, undefined])) as TextStyle;
			change((a) => ({ ...patch, ...(a.rich && richPatch(styleAll(a.rich, cleared))) }) as Partial<TextLike>, patch);
		},
		texts: () => texts().map(richTextOf),
		changeTexts: (next) => change((a) => richPatch(next(richTextOf(a)))),
		lineHeight: () => {
			const [a] = texts();
			return a ? lineHeightOf(a) : 1.2;
		},
		setLineHeight: (lineHeight) => change(() => ({ lineHeight }), { lineHeight }),
		ready: () => loadFont(...fontsOf(texts()))
	});

	const align = (to: TextAlign, label: string, icon: string): Command => ({
		id: `textAlign:${to}`,
		label,
		icon,
		enabled: () => texts().length > 0,
		active: () => texts().length > 0 && texts().every((a) => a.align === to),
		run: () => change(() => ({ align: to }), { align: to })
	});

	/** The three sizings: as wide as the longest line, a fixed width with the height following, or a fixed size */
	function setSizing(to: TextSizing) {
		const ed = editor();
		if (!ed) return;
		const { width: W, height: H } = ed.project;
		change((a) => {
			const b = overlayBounds(a, W, H);
			return to === 'auto-width' ? { boxWidth: undefined, boxHeight: undefined } : to === 'auto-height' ? { boxWidth: b.w, boxHeight: undefined } : { boxWidth: b.w, boxHeight: b.h };
		});
	}
	const sizing = (to: TextSizing, label: string, tip: string, icon: string): Command => ({
		id: `sizing:${to}`,
		label,
		tip,
		icon,
		enabled: () => texts().length > 0,
		active: () => texts().length > 0 && texts().every((a) => sizingOf(a) === to),
		run: () => setSizing(to)
	});

	return {
		...rich,
		texts,
		change,
		setSizing,
		editText: {
			id: 'editText',
			label: m.textbox.edit,
			icon: 'icon-[material-symbols-light--edit-outline]',
			enabled: () => !!editor() && isTextLike(editor()!.selectedItem),
			run: edit
		} satisfies Command,
		alignLeft: align('left', m.textbox.alignLeft, 'icon-[material-symbols-light--format-align-left]'),
		alignCenter: align('center', m.textbox.alignCenter, 'icon-[material-symbols-light--format-align-center]'),
		alignRight: align('right', m.textbox.alignRight, 'icon-[material-symbols-light--format-align-right]'),
		justify: align('justify', m.textbox.justify, 'icon-[material-symbols-light--format-align-justify]'),
		autoWidth: sizing('auto-width', m.inspector.autoWidth, m.inspector.autoWidthHint, 'icon-[material-symbols-light--width]'),
		autoHeight: sizing('auto-height', m.inspector.autoHeight, m.inspector.autoHeightHint, 'icon-[material-symbols-light--height]'),
		fixedSize: sizing('fixed', m.inspector.fixedSize, m.inspector.fixedSizeHint, 'icon-[material-symbols-light--crop-free]')
	};
}

export type TextCommands = ReturnType<typeof textCommands>;
