// Collapsed sections of the properties panel (inspector); its search is `matchesQuery` of @in-browser/brand

const STORAGE_KEY = 'screen-capture:inspector-sections';

/** IDs of the sections the user collapsed (all others are open) */
export function loadCollapsed(): string[] {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (Array.isArray(value)) return value.filter((id): id is string => typeof id === 'string');
	} catch {
		// localStorage not available or broken entry
	}
	return [];
}

export function storeCollapsed(ids: Iterable<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
	} catch {
		// ignore
	}
}
