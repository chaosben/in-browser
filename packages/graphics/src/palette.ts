// The preset colors of the color field: editable by dragging a color onto a place, shared by all color fields,
// projects and tools (localStorage). New elements keep their own default colors.
import { readStored } from './storage.js';

/** Default preset colors */
export const COLORS: readonly string[] = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

const STORAGE_KEY = 'graphics:palette';
/** Where Screen Capture kept it before the palette became suite-wide */
const LEGACY_KEY = 'screen-capture:palette';
const HEX = /^#[0-9a-f]{6}$/;

/** `hex` at `index`; if it is already elsewhere in the palette, the two swap places (no duplicates) */
export function placeColor(palette: readonly string[], index: number, hex: string): string[] {
	const result = [...palette];
	const from = result.indexOf(hex);
	if (from >= 0) result[from] = result[index];
	result[index] = hex;
	return result;
}

export function isDefaultPalette(palette: readonly string[]): boolean {
	return palette.every((c, i) => c === COLORS[i]);
}

/** Only a complete palette of distinct colors, otherwise the defaults */
export function validPalette(raw: unknown): string[] {
	const ok =
		Array.isArray(raw) &&
		raw.length === COLORS.length &&
		raw.every((c) => typeof c === 'string' && HEX.test(c)) &&
		new Set(raw).size === raw.length;
	return ok ? [...raw] : [...COLORS];
}

export function loadPalette(): string[] {
	try {
		return validPalette(JSON.parse(readStored(STORAGE_KEY, LEGACY_KEY) ?? 'null'));
	} catch {
		// localStorage not available or invalid JSON
		return [...COLORS];
	}
}

export function storePalette(palette: readonly string[]) {
	try {
		localStorage.removeItem(LEGACY_KEY);
		if (isDefaultPalette(palette)) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
	} catch {
		// ignore
	}
}
