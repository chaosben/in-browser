import type { Locale } from '@in-browser/brand/i18n/index.svelte.js';
import { formatDateTime as formatDate, toolLanguage } from '@in-browser/brand/i18n/tool.js';
import de from './de.js';
import en from './en.js';

// The language follows the browser settings and stays fixed for the session (see `toolLanguage`).

export type { Locale };
export type Messages = typeof en;

export const { locale, intlLocale, m } = toolLanguage<Messages>({ de, en });

export const formatDateTime = (date: Date | number, style: 'short' | 'medium' = 'medium') => formatDate(date, intlLocale, style);

export function formatClock(date: Date | number = new Date()) {
	return new Date(date).toLocaleTimeString(intlLocale);
}
