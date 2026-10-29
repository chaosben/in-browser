import { detectLocale, type Locale } from '@in-browser/brand/i18n/index.svelte.js';
import de from './de.js';
import en from './en.js';

// The language follows the browser settings (`navigator.languages`, logic from @in-browser/brand)
// and stays fixed for the whole session – there is no language picker of our own. The root layout reports it
// to the brand components via `setLocale()`.

export type { Locale };
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { de, en };

const detected = detectLocale(
	typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
);

export const locale: Locale = detected.locale;
/** For `Intl`/`toLocaleString`: the full browser tag (e.g. de-AT), so date formats match. */
export const intlLocale = detected.tag;
/** Texts in the current language */
export const m: Messages = MESSAGES[locale];

export function formatDateTime(date: Date | number, style: 'short' | 'medium' = 'medium') {
	return new Date(date).toLocaleString(intlLocale, { dateStyle: style, timeStyle: 'short' });
}

export function formatClock(date: Date | number = new Date()) {
	return new Date(date).toLocaleTimeString(intlLocale);
}
