// The fonts of formatted text (`rich-text.ts`), the same in every tool: three families, each regular, bold, italic
// and bold italic. Serif and monospace come with this package (Tinos and Cousine – the metrics of Times and Courier,
// their Western European characters); the sans-serif files are named by the tool (`setSansFonts`: the PDF Editor's
// Liberation Sans, the metrics of Helvetica), so a tool keeps measuring in the font it always had. Loaded together
// on first use; text measured before that is measured again (`fontsEpoch` counts).

import type { FontFamily, FullStyle } from './rich-text.js';

export type FontFace4 = 'regular' | 'bold' | 'italic' | 'boldItalic';
export const FONT_FACES: readonly FontFace4[] = ['regular', 'bold', 'italic', 'boldItalic'];

export const faceOf = (style: { bold?: boolean; italic?: boolean }): FontFace4 => (style.bold ? (style.italic ? 'boldItalic' : 'bold') : style.italic ? 'italic' : 'regular');

const own = import.meta.glob(['/node_modules/@fontsource/tinos/files/tinos-latin-{400,700}-{normal,italic}.woff', '/node_modules/@fontsource/cousine/files/cousine-latin-{400,700}-{normal,italic}.woff'], {
	query: '?url',
	import: 'default',
	eager: true
}) as Record<string, string>;

const fileOf = (family: string, face: FontFace4) => {
	const name = `${family}-latin-${face.startsWith('bold') ? 700 : 400}-${face.toLowerCase().includes('italic') ? 'italic' : 'normal'}.woff`;
	return Object.entries(own).find(([path]) => path.endsWith(`/${name}`))?.[1];
};

const files: Record<FontFamily, Partial<Record<FontFace4, string>>> = {
	sans: {},
	serif: Object.fromEntries(FONT_FACES.map((face) => [face, fileOf('tinos', face)])),
	mono: Object.fromEntries(FONT_FACES.map((face) => [face, fileOf('cousine', face)]))
};

/** The CSS families the fonts are registered as, with what stands in until they are loaded */
const CSS: Record<FontFamily, string> = {
	sans: 'InBrowserSans, Arial, Helvetica, sans-serif',
	serif: 'InBrowserSerif, "Times New Roman", Times, serif',
	mono: 'InBrowserMono, "Courier New", Courier, monospace'
};
const NAME: Record<FontFamily, string> = { sans: 'InBrowserSans', serif: 'InBrowserSerif', mono: 'InBrowserMono' };

/** The sans-serif font's files (URLs), named once by the tool before text is measured */
export function setSansFonts(urls: Partial<Record<FontFace4, string>>) {
	files.sans = { ...urls };
}

/** URL of a font file (to embed it), if the family has that face */
export const fontFile = (font: FontFamily, face: FontFace4): string | undefined => files[font][face];

/** The CSS `font-family` of a family */
export const fontFamilyCss = (font: FontFamily) => CSS[font];

/** A canvas `font` (or CSS `font` shorthand) of a style at `size` pixels */
export const fontCss = (style: Pick<FullStyle, 'font' | 'bold' | 'italic'>, size: number) => `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${CSS[style.font]}`;

let loading: Promise<void> | null = null;
/** Raised when the fonts arrived: what was measured before is measured again */
export const fontsEpoch = { value: 0 };

/** Loads every face once; resolves when text can be measured in them */
export function loadFonts(): Promise<void> {
	loading ??= (async () => {
		const faces = (Object.keys(files) as FontFamily[]).flatMap((font) =>
			FONT_FACES.flatMap((face) => {
				const url = files[font][face];
				return url ? [new FontFace(NAME[font], `url(${url})`, { weight: face.startsWith('bold') ? '700' : '400', style: face.toLowerCase().includes('italic') ? 'italic' : 'normal' })] : [];
			})
		);
		const loaded = await Promise.allSettled(faces.map((face) => face.load()));
		for (const result of loaded) {
			if (result.status === 'fulfilled') document.fonts.add(result.value);
			else console.warn('[graphics] font', result.reason);
		}
		fontsEpoch.value++;
	})();
	return loading;
}

let measurer: CanvasRenderingContext2D | null = null;
let measuring = '';

/** Width of `text` in a style (its size in the unit asked for); starts loading the fonts when they aren't there */
export function measureStyled(text: string, style: FullStyle): number {
	if (!loading) void loadFonts();
	measurer ??= document.createElement('canvas').getContext('2d');
	const ctx = measurer!;
	const font = fontCss(style, style.size);
	if (font !== measuring) ctx.font = measuring = font;
	return ctx.measureText(text).width;
}
