// Bundled fonts for text annotations (Fontsource, weight 600, Latin + Latin Extended only). They are registered
// via the FontFace API and loaded on first use; canvas text only uses fonts that are already loaded.

import interLatin from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import interLatinExt from '@fontsource/inter/files/inter-latin-ext-600-normal.woff2?url';
import caveatLatin from '@fontsource/caveat/files/caveat-latin-600-normal.woff2?url';
import caveatLatinExt from '@fontsource/caveat/files/caveat-latin-ext-600-normal.woff2?url';
import monoLatin from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2?url';
import monoLatinExt from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-600-normal.woff2?url';
import montserratLatin from '@fontsource/montserrat/files/montserrat-latin-600-normal.woff2?url';
import montserratLatinExt from '@fontsource/montserrat/files/montserrat-latin-ext-600-normal.woff2?url';
import type { FontId, Item } from '#lib/project/types.js';
import { m } from '#lib/i18n/index.js';
import { toast } from '#lib/ui/toast.svelte.js';
import { errorMessage } from '#lib/util/format.js';

// Unicode ranges of the Fontsource subsets (identical for all four fonts)
const LATIN =
	'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
	'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const SYSTEM = 'system-ui, "Segoe UI", Roboto, sans-serif';

interface FontInfo {
	label: string;
	/** CSS font family list */
	family: string;
	/** Own family name and files (Latin, Latin Extended) of bundled fonts */
	bundled?: { name: string; files: [string, string] };
}

const bundled = (name: string, label: string, fallback: string, files: [string, string]): FontInfo => ({
	label,
	// Own name, so a locally installed font of the same name does not interfere
	family: `"${name}", ${fallback}`,
	bundled: { name, files }
});

export const FONTS: Record<FontId, FontInfo> = {
	system: { label: m.fonts.system, family: SYSTEM },
	inter: bundled('sc-inter', 'Inter', SYSTEM, [interLatin, interLatinExt]),
	montserrat: bundled('sc-montserrat', 'Montserrat', SYSTEM, [montserratLatin, montserratLatinExt]),
	caveat: bundled('sc-caveat', 'Caveat', 'cursive', [caveatLatin, caveatLatinExt]),
	'jetbrains-mono': bundled('sc-jetbrains-mono', 'JetBrains Mono', 'monospace', [monoLatin, monoLatinExt])
};

export const FONT_IDS = Object.keys(FONTS) as FontId[];

/** Counts loaded fonts – read it where text sizes are measured outside the canvas loop */
export const fontState = $state({ version: 0 });

const loading = new Map<FontId, Promise<void>>();

/** Loads a bundled font once; resolves when it can be drawn (or failed – then the fallback is used). */
export function loadFont(id: FontId): Promise<void> {
	let promise = loading.get(id);
	if (promise) return promise;
	const info = FONTS[id] ?? FONTS.system;
	if (!info.bundled || typeof document === 'undefined') promise = Promise.resolve();
	else {
		const { name, files } = info.bundled;
		const faces = files.map(
			(url, i) => new FontFace(name, `url(${url}) format('woff2')`, { weight: '600', unicodeRange: i ? LATIN_EXT : LATIN })
		);
		faces.forEach((face) => document.fonts.add(face));
		promise = Promise.all(faces.map((face) => face.load())).then(
			() => void fontState.version++,
			(e) => {
				console.error('[fonts]', e);
				toast(m.errors.fontFailed(info.label, errorMessage(e)), 'error');
			}
		);
	}
	loading.set(id, promise);
	return promise;
}

/** Canvas font string; starts loading the font if needed (the preview redraws once it is there). */
export function fontCss(id: FontId, px: number): string {
	void loadFont(id);
	return `600 ${px}px ${(FONTS[id] ?? FONTS.system).family}`;
}

/** Fonts used by the annotations of a timeline */
export function fontsOf(items: Item[]): FontId[] {
	const ids = new Set<FontId>();
	for (const item of items) if (item.type === 'annotation' && 'font' in item) ids.add(item.font);
	return [...ids];
}
