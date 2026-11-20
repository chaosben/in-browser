import { lang, type Locale } from '@in-browser/brand/i18n/index.svelte.js';
import de from './de.js';
import en from './en.js';

// Texts of the ink components in the language the app/tool reports via `setLocale()`.

export type InkMessages = typeof en;

const MESSAGES: Record<Locale, InkMessages> = { de, en };

/** Texts in the active language (reactive via `lang.current`) */
export function inkMessages(): InkMessages {
	return MESSAGES[lang.current];
}
