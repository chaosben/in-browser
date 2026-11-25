// Fonts of text annotations: the suite's display fonts (`@in-browser/graphics/fonts.js` – the system font and four
// bundled ones, each regular, bold and italic), loaded on first use; canvas text only uses fonts that are already
// loaded. `fontState.version` counts arrivals, for what measures text outside the canvas loop.

import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { loadFonts, onFontsChanged } from '@in-browser/graphics/fonts.js';
import { graphicsMessages } from '@in-browser/graphics/i18n/index.svelte.js';
import { DISPLAY_FONTS, type DisplayFont } from '@in-browser/graphics/rich-text.js';
import { fontName } from '@in-browser/graphics/rich-commands.js';
import type { FontId } from '#lib/project/types.js';
import { m } from '#lib/i18n/index.js';
import type { Item } from '#lib/project/types.js';

export const FONT_IDS = DISPLAY_FONTS;

/** Counts loaded fonts – read it where text sizes are measured outside the canvas loop */
export const fontState = $state({ version: 0 });

if (typeof document !== 'undefined') {
	document.fonts.addEventListener('loadingdone', () => void fontState.version++);
	// The user's own fonts come from their bytes and fire no `loadingdone`
	onFontsChanged(() => void fontState.version++);
}

/** Fonts whose failure was told already */
const told = new Set<string>();

/** Loads fonts once; resolves when they can be drawn (or failed – then the fallback is used, and a toast says so once) */
export function loadFont(...ids: FontId[]): Promise<void> {
	return loadFonts(ids).then((failed) => {
		for (const { font, error } of failed) {
			if (told.has(font)) continue;
			told.add(font);
			toast(m.errors.fontFailed(fontName(font), error), 'error');
		}
	});
}

/** Fonts used by the annotations of a timeline: of the boxes and of parts of their text */
export function fontsOf(items: Item[]): FontId[] {
	const ids = new Set<FontId>();
	for (const item of items) {
		if (item.type !== 'annotation' || !('font' in item)) continue;
		ids.add(item.font);
		for (const p of item.rich ?? []) for (const s of p.spans) if (s.font) ids.add(s.font as FontId);
	}
	return [...ids];
}
