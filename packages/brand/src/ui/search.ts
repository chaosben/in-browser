// Search inside a page (help, panels): every word of the query in one of the texts

/** Lower case without accents (ö → o), so a query typed without them still matches */
export function normalize(text: string): string {
	return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

/** Every word of the query occurs in one of the texts; an empty query matches everything */
export function matchesQuery(query: string, ...texts: string[]): boolean {
	const words = normalize(query).split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const haystack = normalize(texts.join(' '));
	return words.every((word) => haystack.includes(word));
}
