// The fonts of formatted text (`rich-text.ts`), the same in every tool, each regular, bold, italic and bold italic.
// Document fonts: serif and monospace come with this package (Tinos and Cousine – the metrics of Times and Courier,
// their Western European characters); the sans-serif files are named by the tool (`setSansFonts`: the PDF Editor's
// Liberation Sans, the metrics of Helvetica), so a tool keeps measuring in the font it always had. Display fonts:
// the system's and four bundled ones (Latin and Latin Extended, a light weight of 600 as their regular – what Screen
// Capture always drew). A family is loaded on first use; text measured before that is measured again
// (`fontsEpoch` counts).

import type { CustomFont, FontFamily, FullStyle } from './rich-text.js';

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

/** A family registered while the suite runs (`registerFamily`): the user's fonts, a document's */
interface CustomFamily extends Family {
	label: string;
	/** Each face's bytes (read when it is first loaded) */
	bytes: Partial<Record<FontFace4, () => Promise<ArrayBuffer>>>;
	/** Has a face a glyph for a character? (unknown: yes) */
	has?: (face: FontFace4, codePoint: number) => boolean;
	/** Said next to its name in menus (e.g. only the characters a document uses are in it) */
	note?: string;
}
const custom = new Map<string, CustomFamily>();
let customNumber = 0;

/** A family by its id: bundled, registered, or (gone, not yet known) the sans-serif one standing in */
const familyOf = (font: FontFamily): Family => (FAMILIES as Record<string, Family>)[font] ?? custom.get(font) ?? FAMILIES.sans;

/**
 * Registers a font family of files (the user's fonts, a document's own): each face's bytes, read when the family is
 * first used. A face it lacks is drawn and written in its regular face – never one the browser makes up, so the screen
 * and a document match. Registering it again (other files) draws it anew.
 */
export function registerFamily(font: CustomFont, family: { label: string; faces: Partial<Record<FontFace4, () => Promise<ArrayBuffer>>>; has?: CustomFamily['has']; note?: string }) {
	const old = custom.get(font);
	custom.set(font, {
		name: old?.name ?? `InBrowserCustom${++customNumber}`,
		fallback: 'Arial, Helvetica, sans-serif',
		weights: [400, 700],
		files: {},
		label: family.label,
		bytes: family.faces,
		has: family.has,
		note: family.note
	});
	// Also the first time: text measured before the family was known kept an empty load and the stand-in's widths
	loading.delete(font);
	fontsChanged();
}

/** Takes a registered family away (its text is drawn in the stand-in until it comes back) */
export function unregisterFamily(font: CustomFont) {
	if (!custom.delete(font)) return;
	loading.delete(font);
	fontsChanged();
}

/** The registered families (whose id starts with `prefix`) */
export const registeredFamilies = (prefix: 'user:' | 'pdf:'): CustomFont[] => [...custom.keys()].filter((k): k is CustomFont => k.startsWith(prefix));

/** A family is there to be used (bundled or registered) */
export const knownFont = (font: FontFamily) => font in FAMILIES || custom.has(font);

/** The name of a registered family, and what menus say beside it */
export const customLabel = (font: CustomFont) => custom.get(font)?.label ?? font.slice(font.indexOf(':') + 1);
export const customNote = (font: CustomFont) => custom.get(font)?.note;

/** The face a style is drawn in: a registered family without that face uses its regular one */
export function shownFace(font: FontFamily, face: FontFace4): FontFace4 {
	const family = custom.get(font);
	return !family || family.bytes[face] ? face : 'regular';
}

/** Can a family show a character (in a face)? Unknown: yes */
export function fontHas(font: FontFamily, face: FontFace4, char: string): boolean {
	const family = custom.get(font);
	return !family?.has || family.has(shownFace(font, face), char.codePointAt(0) ?? 0);
}

/** The bytes of a registered family's face (to embed it in a document); null when it has none */
export async function familyBytes(font: CustomFont, face: FontFace4): Promise<ArrayBuffer | null> {
	const read = custom.get(font)?.bytes[shownFace(font, face)];
	return read ? read() : null;
}

/** The sans-serif font's files (URLs), named once by the tool before text is measured */
export function setSansFonts(urls: Partial<Record<FontFace4, string>>) {
	FAMILIES.sans.files = Object.fromEntries(Object.entries(urls).flatMap(([face, url]) => (url ? [[face, [{ url }]]] : [])));
}

/** URL of a font file (to embed it), if the family has that face in one file */
export const fontFile = (font: FontFamily, face: FontFace4): string | undefined => {
	const files = familyOf(font).files[face];
	return files?.length === 1 ? files[0].url : undefined;
};

/** The CSS `font-family` of a family */
export const fontFamilyCss = (font: FontFamily) => {
	const family = familyOf(font);
	return family.name ? `${family.name}, ${family.fallback}` : family.fallback;
};

/** The CSS weight a style is drawn in (display fonts are heavier than document fonts) */
export const fontWeight = (style: Pick<FullStyle, 'font' | 'bold'>) => familyOf(style.font).weights[isBold(shownFace(style.font, style.bold ? 'bold' : 'regular')) ? 1 : 0];

/** A canvas `font` (or CSS `font` shorthand) of a style at `size` pixels (a face a registered family lacks: its regular) */
export const fontCss = (style: Pick<FullStyle, 'font' | 'bold' | 'italic'>, size: number) => {
	const face = shownFace(style.font, faceOf(style));
	return `${isItalic(face) ? 'italic ' : ''}${familyOf(style.font).weights[isBold(face) ? 1 : 0]} ${size}px ${fontFamilyCss(style.font)}`;
};

/** Per family: resolves with what kept faces of it from loading (empty: all there) */
const loading = new Map<FontFamily, Promise<string[]>>();
/** Raised when a family arrived: what was measured before is measured again */
export const fontsEpoch = { value: 0 };

const arrivedListeners = new Set<() => void>();
let arrivedQueued = false;
/** What was measured or drawn in the stand-in is out of date (a family registered, loaded or taken away) */
function fontsChanged() {
	fontsEpoch.value++;
	if (arrivedQueued || !arrivedListeners.size) return;
	arrivedQueued = true;
	queueMicrotask(() => {
		arrivedQueued = false;
		for (const listener of arrivedListeners) listener();
	});
}
/**
 * Calls `listener` (once per burst) whenever fonts arrived or went – a tool draws its text again then: a family that
 * comes after the text was drawn (the user's fonts, a document's own) is otherwise only seen when the text is touched.
 */
export function onFontsChanged(listener: () => void): () => void {
	arrivedListeners.add(listener);
	return () => arrivedListeners.delete(listener);
}

function loadFamily(font: FontFamily): Promise<string[]> {
	let promise = loading.get(font);
	if (promise) return promise;
	const registered = custom.get(font);
	if (registered) return loadCustom(font, registered);
	const family = (FAMILIES as Record<string, Family>)[font];
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
				fontsChanged();
				return failed;
			})
		: Promise.resolve([]);
	loading.set(font, promise);
	return promise;
}

/** A registered family's faces from their bytes */
function loadCustom(font: FontFamily, family: CustomFamily): Promise<string[]> {
	const promise = Promise.allSettled(
		(Object.entries(family.bytes) as [FontFace4, () => Promise<ArrayBuffer>][]).map(async ([face, read]) => {
			const loaded = await new FontFace(family.name, await read(), { weight: String(family.weights[isBold(face) ? 1 : 0]), style: isItalic(face) ? 'italic' : 'normal' }).load();
			document.fonts.add(loaded);
		})
	).then((all) => {
		fontsChanged();
		const failed = all.flatMap((r) => (r.status === 'rejected' ? [r.reason instanceof Error ? r.reason.message : String(r.reason)] : []));
		for (const reason of failed) console.error('[graphics] font', font, reason);
		return failed;
	});
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
