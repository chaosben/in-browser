import { lang, type Locale } from '@in-browser/brand/i18n/index.svelte.js';
import { FilesError } from '../fs.js';
import { basename } from '../path.js';
import de from './de.js';
import en from './en.js';

// Texts of the file system components in the language the app/tool reports via `setLocale()`.

export type FilesMessages = typeof en;

const MESSAGES: Record<Locale, FilesMessages> = { de, en };

/** Texts in the active language (reactive via `lang.current`) */
export function filesMessages(): FilesMessages {
	return MESSAGES[lang.current];
}

/** Readable message for an error of a file operation */
export function filesErrorText(e: unknown): string {
	if (e instanceof FilesError) return filesMessages().errors[e.code](basename(e.path));
	return e instanceof Error ? e.message : String(e);
}

/** File size like `1.4 MB` in the format of `locale` (BCP-47 tag) */
export function formatSize(bytes: number, locale: string): string {
	const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;
	let i = 0;
	while (bytes >= 1000 && i < units.length - 1) {
		bytes /= 1000;
		i++;
	}
	return new Intl.NumberFormat(locale, {
		style: 'unit',
		unit: units[i],
		unitDisplay: i === 0 ? 'long' : 'short',
		maximumFractionDigits: i === 0 || bytes >= 100 ? 0 : 1
	}).format(bytes);
}
