import { browserLocale, FALLBACK, type Locale } from './index.svelte.js';

// Language of a tool: follows the browser settings and stays fixed for the whole session (no language picker of
// our own). The tool's layout reports it to the brand components via `setLocale()`.

export interface ToolLanguage<M> {
	locale: Locale;
	/** For `Intl`/`toLocaleString`: the full browser tag (e.g. de-AT), so date formats match */
	intlLocale: string;
	/** Texts in the current language */
	m: M;
}

export function toolLanguage<M>(messages: Record<Locale, M>): ToolLanguage<M> {
	// Without a browser (Node specs): English
	const { locale, tag } = typeof navigator === 'undefined' ? { locale: FALLBACK, tag: FALLBACK } : browserLocale();
	return { locale, intlLocale: tag, m: messages[locale] };
}

/** Date and time in the browser's format (`tag`: BCP-47, e.g. `intlLocale` of the tool) */
export function formatDateTime(date: Date | number, tag: string, style: 'short' | 'medium' = 'medium') {
	return new Date(date).toLocaleString(tag, { dateStyle: style, timeStyle: 'short' });
}
