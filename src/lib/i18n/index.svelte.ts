import { browserLocale, lang, PRERENDER_LOCALE, setLocale, type Locale } from '@in-browser/brand/i18n/index.svelte.js';
import de from './de.js';
import en from './en.js';

// Language logic from @in-browser/brand (browser language, no language picker of our own).
// The page is prerendered in English; `applyBrowserLocale()` switches to the browser language after
// hydration. For that, `m` and `locale` are mutable (live-bound) exports; `lang.current` triggers the
// re-render in the root layout via `{#key}`.

export { lang, type Locale };
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { de, en };

export let locale: Locale = PRERENDER_LOCALE;
/** Texts in the current language */
export let m: Messages = MESSAGES[locale];

/** Switches to the browser language (browser only, after hydration). */
export function applyBrowserLocale() {
	locale = browserLocale().locale;
	m = MESSAGES[locale];
	setLocale(locale);
}
