// Recently used custom colors (`#rrggbb`, without opacity), shared by all color fields, projects and tools.
// Stored in localStorage; the color field shows them next to the colors of the open project.
import { readStored } from './storage.js';

const STORAGE_KEY = 'graphics:recent-colors';
/** Where Screen Capture kept them before they became suite-wide */
const LEGACY_KEY = 'screen-capture:recent-colors';
const MAX_RECENT = 8;
/** Swatches in the second row of the color field */
export const MAX_SWATCHES = 8;

const HEX = /^#[0-9a-f]{6}$/;

/** `hex` to the front, without duplicates */
export function pushRecent(list: readonly string[], hex: string, max = MAX_RECENT): string[] {
	return [hex, ...list.filter((c) => c !== hex)].slice(0, max);
}

/** Recent colors first, then the remaining project colors; presets (`exclude`) are left out */
export function mergeSwatches(
	recent: readonly string[],
	project: readonly string[],
	exclude: readonly string[],
	max = MAX_SWATCHES
): string[] {
	const skip = new Set(exclude);
	return [...new Set([...recent, ...project])].filter((c) => !skip.has(c)).slice(0, max);
}

export function loadRecent(): string[] {
	try {
		const raw = JSON.parse(readStored(STORAGE_KEY, LEGACY_KEY) ?? '[]');
		return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string' && HEX.test(c)).slice(0, MAX_RECENT) : [];
	} catch {
		// localStorage not available or invalid JSON
		return [];
	}
}

export function storeRecent(list: readonly string[]) {
	try {
		localStorage.removeItem(LEGACY_KEY);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch {
		// ignore
	}
}
