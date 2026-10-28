/** Number typed by the user: decimal comma or point, surrounding spaces ignored; null if it is none */
export function parseNumber(text: string): number | null {
	const value = Number(text.trim().replace(',', '.'));
	return text.trim() !== '' && Number.isFinite(value) ? value : null;
}

/** Rounds to `decimals` places and keeps the value within [min, max] */
export function clampNumber(value: number, min: number, max: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.min(Math.max(Math.round(value * factor) / factor, min), max);
}

/** Number for display with the decimal separator of `locale` */
export function formatNumber(value: number, decimals: number, locale: string): string {
	return value.toLocaleString(locale, { maximumFractionDigits: decimals, useGrouping: false });
}
