// Recently used custom colors (`#rrggbb`, without opacity), shared by all color fields, projects and tools.
// Stored in localStorage; the color field shows them next to the colors of the open project.
import { readStored, writeStored } from '@in-browser/brand/storage.js';

const STORAGE_KEY = 'graphics:recent-colors';
/** Where Screen Capture kept them before they became suite-wide */
const LEGACY_KEY = 'screen-capture:recent-colors';
export const MAX_RECENT = 8;
/** Swatches in the second row of the color field */
export const MAX_SWATCHES = 8;

const HEX = /^#[0-9a-f]{6}$/;

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
		const raw: unknown = JSON.parse(readStored(STORAGE_KEY) ?? readStored(LEGACY_KEY) ?? '[]');
		return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string' && HEX.test(c)).slice(0, MAX_RECENT) : [];
	} catch {
		return []; // broken entry
	}
}

export function storeRecent(list: readonly string[]) {
	writeStored(LEGACY_KEY, null);
	writeStored(STORAGE_KEY, JSON.stringify(list));
}
