// The fonts of formatted text (`rich-text.ts`), the same in every tool, each regular, bold, italic and bold italic.
// Document fonts: serif and monospace come with this package (Tinos and Cousine – the metrics of Times and Courier,
// their Western European characters); the sans-serif files are named by the tool (`setSansFonts`: the PDF Editor's
// Liberation Sans, the metrics of Helvetica), so a tool keeps measuring in the font it always had. Display fonts:
// the system's and four bundled ones (Latin and Latin Extended, a light weight of 600 as their regular – what Screen
// Capture always drew). A family is loaded on first use; text measured before that is measured again
// (`fontsEpoch` counts).

import type { FontFamily, FullStyle } from './rich-text.js';

export type FontFace4 = 'regular' | 'bold' | 'italic' | 'boldItalic';
export const FONT_FACES: readonly FontFace4[] = ['regular', 'bold', 'italic', 'boldItalic'];

export const faceOf = (style: { bold?: boolean; italic?: boolean }): FontFace4 => (style.bold ? (style.italic ? 'boldItalic' : 'bold') : style.italic ? 'italic' : 'regular');

const isBold = (face: FontFace4) => face.startsWith('bold');
const isItalic = (face: FontFace4) => face.toLowerCase().includes('italic');

const own = import.meta.glob(['/node_modules/@fontsource/tinos/files/tinos-latin-{400,700}-{normal,italic}.woff', '/node_modules/@fontsource/cousine/files/cousine-latin-{400,700}-{normal,italic}.woff'], {
	query: '?url',
	import: 'default',
	eager: true
}) as Record<string, string>;

const display = import.meta.glob(
	[
		'/node_modules/@fontsource/{inter,montserrat,jetbrains-mono}/files/*-{latin,latin-ext}-{600,800}-{normal,italic}.woff2',
		'/node_modules/@fontsource/caveat/files/caveat-{latin,latin-ext}-{600,700}-normal.woff2'
	],
	{ query: '?url', import: 'default', eager: true }
) as Record<string, string>;

// Unicode ranges of the Fontsource subsets (the same for all of them)
const LATIN =
	'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
	'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** One file of a face, for the characters of `range` (all without one) */
interface FontFile {
	url: string;
	range?: string;
}

interface Family {
	/** The name its faces are registered as (our own, so an installed font of that name never interferes) */
	name: string;
	/** What stands in until it is loaded, and for characters it lacks */
	fallback: string;
	/** Weights of its regular and bold faces */
	weights: [number, number];
	files: Partial<Record<FontFace4, FontFile[]>>;
}

const fileOf = (family: string, face: FontFace4): FontFile[] => {
	const name = `${family}-latin-${isBold(face) ? 700 : 400}-${isItalic(face) ? 'italic' : 'normal'}.woff`;
	const url = Object.entries(own).find(([path]) => path.endsWith(`/${name}`))?.[1];
	return url ? [{ url }] : [];
};

/** The bundled files of a display font: Latin and Latin Extended per face; a face it lacks is drawn slanted by the browser */
const displayFiles = (family: string, weights: [number, number]): Family['files'] =>
	Object.fromEntries(
		FONT_FACES.map((face) => {
			const file = (subset: string) => display[`/node_modules/@fontsource/${family}/files/${family}-${subset}-${weights[isBold(face) ? 1 : 0]}-${isItalic(face) ? 'italic' : 'normal'}.woff2`];
			const files: FontFile[] = [];
			for (const [subset, range] of [['latin', LATIN], ['latin-ext', LATIN_EXT]]) {
				const url = file(subset);
				if (url) files.push({ url, range });
			}
			return [face, files];
		})
	);

const SYSTEM = 'system-ui, "Segoe UI", Roboto, sans-serif';

const FAMILIES: Record<FontFamily, Family> = {
	sans: { name: 'InBrowserSans', fallback: 'Arial, Helvetica, sans-serif', weights: [400, 700], files: {} },
	serif: { name: 'InBrowserSerif', fallback: '"Times New Roman", Times, serif', weights: [400, 700], files: Object.fromEntries(FONT_FACES.map((face) => [face, fileOf('tinos', face)])) },
	mono: { name: 'InBrowserMono', fallback: '"Courier New", Courier, monospace', weights: [400, 700], files: Object.fromEntries(FONT_FACES.map((face) => [face, fileOf('cousine', face)])) },
	system: { name: '', fallback: SYSTEM, weights: [600, 800], files: {} },
	inter: { name: 'InBrowserInter', fallback: SYSTEM, weights: [600, 800], files: displayFiles('inter', [600, 800]) },
	montserrat: { name: 'InBrowserMontserrat', fallback: SYSTEM, weights: [600, 800], files: displayFiles('montserrat', [600, 800]) },
	caveat: { name: 'InBrowserCaveat', fallback: 'cursive', weights: [600, 700], files: displayFiles('caveat', [600, 700]) },
	'jetbrains-mono': { name: 'InBrowserJetBrainsMono', fallback: 'monospace', weights: [600, 800], files: displayFiles('jetbrains-mono', [600, 800]) }
};

/** The sans-serif font's files (URLs), named once by the tool before text is measured */
export function setSansFonts(urls: Partial<Record<FontFace4, string>>) {
	FAMILIES.sans.files = Object.fromEntries(Object.entries(urls).flatMap(([face, url]) => (url ? [[face, [{ url }]]] : [])));
}

/** URL of a font file (to embed it), if the family has that face in one file */
export const fontFile = (font: FontFamily, face: FontFace4): string | undefined => {
	const files = FAMILIES[font].files[face];
	return files?.length === 1 ? files[0].url : undefined;
};

/** The CSS `font-family` of a family */
export const fontFamilyCss = (font: FontFamily) => {
	const family = FAMILIES[font] ?? FAMILIES.sans;
	return family.name ? `${family.name}, ${family.fallback}` : family.fallback;
};

/** The CSS weight a style is drawn in (display fonts are heavier than document fonts) */
export const fontWeight = (style: Pick<FullStyle, 'font' | 'bold'>) => (FAMILIES[style.font] ?? FAMILIES.sans).weights[style.bold ? 1 : 0];

/** A canvas `font` (or CSS `font` shorthand) of a style at `size` pixels */
export const fontCss = (style: Pick<FullStyle, 'font' | 'bold' | 'italic'>, size: number) => `${style.italic ? 'italic ' : ''}${fontWeight(style)} ${size}px ${fontFamilyCss(style.font)}`;

/** Per family: resolves with what kept faces of it from loading (empty: all there) */
const loading = new Map<FontFamily, Promise<string[]>>();
/** Raised when a family arrived: what was measured before is measured again */
export const fontsEpoch = { value: 0 };

function loadFamily(font: FontFamily): Promise<string[]> {
	let promise = loading.get(font);
	if (promise) return promise;
	const family = FAMILIES[font];
	const faces = FONT_FACES.flatMap((face) =>
		(family?.files[face] ?? []).map(
			(file) =>
				new FontFace(family.name, `url(${file.url})`, {
					weight: String(family.weights[isBold(face) ? 1 : 0]),
					style: isItalic(face) ? 'italic' : 'normal',
					...(file.range && { unicodeRange: file.range })
				})
		)
	);
	promise = faces.length
		? Promise.allSettled(faces.map((face) => face.load())).then((loaded) => {
				const failed: string[] = [];
				for (const result of loaded) {
					if (result.status === 'fulfilled') document.fonts.add(result.value);
					else {
						console.error('[graphics] font', font, result.reason);
						failed.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
					}
				}
				fontsEpoch.value++;
				return failed;
			})
		: Promise.resolve([]);
	loading.set(font, promise);
	return promise;
}

/** Loads every face of the families once; resolves when text can be measured in them, with the families that
 * failed (their text is drawn in the fallback then – the tool says so) */
export function loadFonts(families: readonly FontFamily[]): Promise<{ font: FontFamily; error: string }[]> {
	return Promise.all(families.map(async (font) => ({ font, failed: await loadFamily(font) }))).then((all) =>
		all.filter((f) => f.failed.length).map((f) => ({ font: f.font, error: f.failed[0] }))
	);
}

let measurer: CanvasRenderingContext2D | null = null;
let measuring = '';

/** Width of `text` in a style (its size in the unit asked for); starts loading its family when it isn't there */
export function measureStyled(text: string, style: FullStyle): number {
	if (!loading.has(style.font)) void loadFamily(style.font);
	measurer ??= document.createElement('canvas').getContext('2d');
	const ctx = measurer!;
	const font = fontCss(style, style.size);
	if (font !== measuring) ctx.font = measuring = font;
	return ctx.measureText(text).width;
}
