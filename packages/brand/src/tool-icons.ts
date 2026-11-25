// The icons of the suite and its tools: one Material Symbols glyph and one color per tool. In the UI the glyph is
// the Light icon class (like every other icon); `static/<tool>/favicon.svg` and `icon-maskable.svg` (tab, launcher,
// installed app) show the Regular glyph in white on a tile of the tool's color. They are file snapshots of
// `tool-icons.spec.ts`: it fails when they differ, `npm run icons` rewrites them.
import type { ToolSlug } from './i18n/index.svelte.js';

export interface ToolIcon {
	/** Name in Material Symbols (`material-symbols-light` in the UI, `material-symbols` on the tile) */
	glyph: string;
	/** Tile and glyph color (hex: the OS renders app icons, not always with CSS color support) */
	color: string;
	/** The glyph as icon class, written out so Tailwind generates it */
	class: string;
}

export const TOOL_ICONS: Record<ToolSlug, ToolIcon> = {
	files: { glyph: 'folder-outline', color: '#d97706', class: 'icon-[material-symbols-light--folder-outline]' },
	'text-editor': { glyph: 'edit-document-outline', color: '#0d9488', class: 'icon-[material-symbols-light--edit-document-outline]' },
	'screen-capture': { glyph: 'screen-record-outline', color: '#dc2626', class: 'icon-[material-symbols-light--screen-record-outline]' },
	'pdf-editor': { glyph: 'picture-as-pdf-outline', color: '#16a34a', class: 'icon-[material-symbols-light--picture-as-pdf-outline]' },
	fonts: { glyph: 'font-download-outline', color: '#7c3aed', class: 'icon-[material-symbols-light--font-download-outline]' },
	jwl: { glyph: 'menu-book-outline', color: '#5b3c88', class: 'icon-[material-symbols-light--menu-book-outline]' }
};

/** Tile color of the suite's own mark */
export const SUITE_COLOR = '#0284c7';

/** The suite's mark (browser window with cursor brackets, as in the BrandBar) as 24×24 strokes */
export const SUITE_MARK =
	'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
	'<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M2.5 8.5h19"/>' +
	'<path d="M9.5 11.5l-2.5 2.5 2.5 2.5M14.5 11.5l2.5 2.5-2.5 2.5"/></g>';

const white = (body: string) => body.replaceAll('currentColor', '#fff');

/** Tab and launcher icon (`purpose: any`): rounded tile, glyph (24×24 body) in white */
export function faviconSvg(title: string, color: string, body: string): string {
	return [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
		`\t<title>${title}</title>`,
		'\t<!-- Generated from packages/brand/src/tool-icons.ts by `npm run icons` -->',
		`\t<rect width="24" height="24" rx="5.5" fill="${color}"/>`,
		`\t<g transform="translate(3 3) scale(.75)">${white(body)}</g>`,
		'</svg>',
		''
	].join('\n');
}

/** App icon for round or cropped masks (`purpose: maskable`): full-bleed color, glyph inside the safe zone */
export function maskableSvg(title: string, color: string, body: string): string {
	return [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
		`\t<title>${title}</title>`,
		'\t<!-- Generated from packages/brand/src/tool-icons.ts by `npm run icons` -->',
		`\t<rect width="24" height="24" fill="${color}"/>`,
		`\t<g transform="translate(5.4 5.4) scale(.55)">${white(body)}</g>`,
		'</svg>',
		''
	].join('\n');
}

/** Glyph body from an Iconify set (`icons.json`), following aliases */
export function glyphBody(set: { icons: Record<string, { body: string }>; aliases?: Record<string, { parent: string }> }, name: string): string {
	const icon = set.icons[name] ?? set.icons[set.aliases?.[name]?.parent ?? ''];
	if (!icon) throw new Error(`Unknown icon ${name}`);
	return icon.body;
}

/** Every generated file (path below `static/`) with its content; `icons` is `@iconify-json/material-symbols` */
export function iconFiles(icons: Parameters<typeof glyphBody>[0], names: Record<ToolSlug, string>, suite: string): Record<string, string> {
	const files: Record<string, string> = {
		'favicon.svg': faviconSvg(suite, SUITE_COLOR, SUITE_MARK),
		'icon-maskable.svg': maskableSvg(suite, SUITE_COLOR, SUITE_MARK)
	};
	for (const [slug, icon] of Object.entries(TOOL_ICONS) as [ToolSlug, ToolIcon][]) {
		const body = glyphBody(icons, icon.glyph);
		files[`${slug}/favicon.svg`] = faviconSvg(names[slug], icon.color, body);
		files[`${slug}/icon-maskable.svg`] = maskableSvg(names[slug], icon.color, body);
	}
	return files;
}
