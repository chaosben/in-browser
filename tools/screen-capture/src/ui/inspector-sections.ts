// Collapsed sections of the properties panel (inspector); its search is `matchesQuery` of @in-browser/brand
import { loadJson, storeJson } from '@in-browser/brand/storage.js';

const STORAGE_KEY = 'screen-capture:inspector-sections';

/** IDs of the sections the user collapsed (all others are open) */
export function loadCollapsed(): string[] {
	const value = loadJson<unknown>(STORAGE_KEY, []);
	return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export function storeCollapsed(ids: Iterable<string>) {
	storeJson(STORAGE_KEY, [...ids]);
}
