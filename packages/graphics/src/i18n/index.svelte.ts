import { lang, type Locale } from '@in-browser/brand/i18n/index.svelte.js';
import de from './de.js';
import en from './en.js';

// Texts of the graphics components in the language the app/tool reports via `setLocale()`.

export type GraphicsMessages = typeof en;

const MESSAGES: Record<Locale, GraphicsMessages> = { de, en };

/** Texts in the active language (reactive via `lang.current`) */
export function graphicsMessages(): GraphicsMessages {
	return MESSAGES[lang.current];
}
