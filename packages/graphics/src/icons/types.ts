/** An icon as stored in documents: its SVG travels along, so it shows without the icon set */
export interface IconData {
	/** Iconify name, e.g. `arrow-forward` */
	name: string;
	/** SVG content (paths with `fill="currentColor"`) */
	body: string;
	width: number;
	height: number;
}

/** SVG of an icon in a solid color (opacity is applied when drawing), at 10× its size so it stays sharp */
export function iconSvg(icon: IconData, hex: string): string {
	const body = icon.body.replaceAll('currentColor', hex);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${icon.width * 10}" height="${icon.height * 10}" viewBox="0 0 ${icon.width} ${icon.height}">${body}</svg>`;
}
