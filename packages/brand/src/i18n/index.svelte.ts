import de from './de.js';
import en from './en.js';

// Shared language logic of all in-browser apps: the language follows the browser settings
// (`navigator.languages`) – there is no language picker. English leads: text structure (`en.ts`),
// prerendering and fallback for unsupported languages.
// `lang.current` is the active language; apps set it via `setLocale()` and keep their own texts
// in sync with it. The brand components read their texts via `brandMessages()`.

export type Locale = 'de' | 'en';
export type BrandMessages = typeof en;

export const LOCALES: readonly Locale[] = ['en', 'de'];
export const FALLBACK: Locale = 'en';
/** Language of prerendered pages */
export const PRERENDER_LOCALE: Locale = 'en';

/** First supported language from the list of preferred languages, along with the matching BCP-47 tag. */
export function detectLocale(preferred: readonly string[]): { locale: Locale; tag: string } {
	for (const tag of preferred) {
		const base = tag.toLowerCase().split('-')[0];
		if ((LOCALES as readonly string[]).includes(base)) return { locale: base as Locale, tag };
	}
	return { locale: FALLBACK, tag: FALLBACK };
}

/** Browser language (call only in the browser). */
export function browserLocale() {
	return detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export const lang = $state<{ current: Locale }>({ current: PRERENDER_LOCALE });

/** Switches the active language (browser only). */
export function setLocale(locale: Locale) {
	lang.current = locale;
	// Language for screen readers, hyphenation and spell checking
	document.documentElement.lang = locale;
}

const MESSAGES: Record<Locale, BrandMessages> = { de, en };

/** Brand component texts in the active language (reactive via `lang.current`) */
export function brandMessages(): BrandMessages {
	return MESSAGES[lang.current];
}
