// Search and sections of the launcher (pure logic). The search covers both languages, so a German word finds
// a tool on the English page and vice versa.

import de from './i18n/de.js';
import en from './i18n/en.js';
import { CATEGORIES, type Category, type Tool } from './tools.js';

/** Lower case without diacritics: “Notizbücher” → “notizbucher” */
export function normalize(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Words of the tool's texts in both languages */
function searchWords(tool: Tool): string[] {
	const categories = [tool.category, ...(tool.also ?? [])];
	return words(
		[en, de]
			.flatMap((m) => {
				const text = m.tools[tool.id];
				return [text.name, text.summary, text.keywords, ...categories.map((category) => m.categories[category])];
			})
			.join(' ')
	);
}

function words(text: string): string[] {
	return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Every word of the query starts a word of the tool's name, summary, keywords or categories (either language):
 * “rec” finds “recorder”, “zeichnen” doesn't find “aufzeichnen”.
 */
export function matches(tool: Tool, query: string): boolean {
	const own = searchWords(tool);
	return words(query).every((word) => own.some((candidate) => candidate.startsWith(word)));
}

export interface Section {
	category: Category;
	tools: Tool[];
}

/** Tools by main category in the order of `CATEGORIES`, without empty sections; with a query only the matching ones */
export function sections(tools: readonly Tool[], query: string): Section[] {
	const shown = query.trim() ? tools.filter((tool) => matches(tool, query)) : tools;
	return CATEGORIES.map((category) => ({ category, tools: shown.filter((tool) => tool.category === category) })).filter(
		(section) => section.tools.length > 0
	);
}
