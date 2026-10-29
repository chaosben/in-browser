// Search and collapsed sections of the properties panel (inspector)

const STORAGE_KEY = 'screen-capture:inspector-sections';

/** Lower case without accents (ö → o), so a query typed without them still matches */
function normalize(text: string) {
	return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

/** Every word of the query occurs in one of the texts; an empty query matches everything */
export function matchesQuery(query: string, ...texts: string[]): boolean {
	const words = normalize(query).split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const haystack = normalize(texts.join(' '));
	return words.every((word) => haystack.includes(word));
}

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
