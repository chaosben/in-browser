// Colors in the project are CSS strings. Written as `#rrggbb` or `#rrggbbaa` (with opacity) –
// canvas understands that directly. Reading additionally accepts `#rgb` and `rgb()/rgba()` (older projects).

export interface ParsedColor {
	/** `#rrggbb`, lowercase */
	hex: string;
	/** Opacity 0…1 */
	alpha: number;
}

const BLACK: ParsedColor = { hex: '#000000', alpha: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const byte = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

export function parseColor(value: string | null | undefined): ParsedColor {
	const v = (value ?? '').trim().toLowerCase();

	let m = /^#([0-9a-f]{3})$/.exec(v);
	if (m) return { hex: `#${[...m[1]].map((c) => c + c).join('')}`, alpha: 1 };

	m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
	if (m) return { hex: `#${m[1]}`, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };

	m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%)?)?\s*\)$/.exec(v);
	if (m) {
		const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
		return { hex: `#${byte(+m[1])}${byte(+m[2])}${byte(+m[3])}`, alpha: clamp(alpha, 0, 1) };
	}
	return BLACK;
}

/** `#rrggbb` at full opacity, otherwise `#rrggbbaa`. */
export function formatColor(hex: string, alpha: number): string {
	const base = parseColor(hex).hex;
	const a = Math.round(clamp(alpha, 0, 1) * 255);
	return a === 255 ? base : base + byte(a);
}

export function withAlpha(value: string, alpha: number): string {
	return formatColor(parseColor(value).hex, alpha);
}
