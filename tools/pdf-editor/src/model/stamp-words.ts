// The words of the stamp tool: the ten of the PDF standard to begin with, changed, removed and added to by the
// user. Kept as one small file with "My stamps" (`words.json`), so the list is the same on every device.

import { migrateFormat, type RawDocument } from '@in-browser/files/formats.js';
import { STAMP_NAMES, STAMPS, type StampName } from '#lib/render/stamp-names.js';

export const WORDS_FORMAT = 'pdf-editor-stamp-words';
export const WORDS_VERSION = 1;
const MIGRATIONS: Record<number, (p: RawDocument) => RawDocument> = {};

export interface StampWord {
	id: string;
	/** One of the standard's words: written as the stamp's `/Name`, and shown in the device's language as long as
	 * `text` is not set */
	name?: StampName;
	/** What the stamp says (the user's own wording) */
	text?: string;
	/** `#rrggbb` of frame and text */
	color: string;
}

/** The list before the user changed it */
export const defaultWords = (): StampWord[] => STAMP_NAMES.map((name) => ({ id: name, name, color: STAMPS[name] }));

const isName = (v: unknown): v is StampName => STAMP_NAMES.includes(v as StampName);

/** The list of a saved file; entries that say nothing or have no color are left out. Throws `FormatError` for a
 * file of a newer version or another format */
export function parseWords(raw: unknown): StampWord[] {
	const doc = migrateFormat(raw, WORDS_FORMAT, WORDS_VERSION, MIGRATIONS);
	const seen = new Set<string>();
	const words: StampWord[] = [];
	for (const entry of Array.isArray(doc.words) ? (doc.words as Record<string, unknown>[]) : []) {
		if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id || seen.has(entry.id)) continue;
		if (typeof entry.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.color)) continue;
		const text = typeof entry.text === 'string' && entry.text.trim() ? entry.text.trim() : undefined;
		const name = isName(entry.name) ? entry.name : undefined;
		if (!text && !name) continue;
		seen.add(entry.id);
		words.push({ id: entry.id, ...(name && { name }), ...(text && { text }), color: entry.color.toLowerCase() });
	}
	return words;
}

export const serializeWords = (words: readonly StampWord[]): string => JSON.stringify({ format: WORDS_FORMAT, version: WORDS_VERSION, words }, null, '\t');

/** What a word says: the user's wording, else the standard's word in the device's language */
export const wordText = (word: StampWord, names: Record<StampName, string>): string => word.text ?? (word.name ? names[word.name] : '');

/** The word chosen by `id` (a choice remembered before the list existed names a standard word, which is its id);
 * the first one when it is gone */
export const chosenWord = (words: readonly StampWord[], id: string): StampWord | undefined => words.find((w) => w.id === id) ?? words[0];
