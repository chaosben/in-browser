// Word codes: four words that open a share instead of its long key – easier to read off a phone and type on
// another computer. They are only a messenger: valid for 10 minutes and for one sign-in, after which the sharing
// device hands the share's real key (100 bits) over the connection the words opened. Each word is one of 1024 (10
// bits; 40 bits for four); the room and the proofs come from a deliberately slow derivation (PBKDF2), so trying codes
// offline from what the relays see takes years – against minutes of validity. Words are typed in either language:
// a German word and an English one may stand for different numbers, never for the same code twice (no word is in
// both lists).

import { encodeBase32 } from './base32.js';
import { utf8 } from './bytes.js';

/** Words in a code */
export const WORD_COUNT = 4;
/** Words in each list (10 bits each) */
export const LIST_SIZE = 1024;
/** How long a code opens its share */
export const WORDS_TTL = 10 * 60 * 1000;
/** Rounds of the derivation (each guess costs as much) */
const ROUNDS = 200_000;

/** A code: the words' numbers */
export type WordCode = readonly number[];

export interface WordLists {
	en: readonly string[];
	de: readonly string[];
}

let lists: Promise<WordLists> | null = null;

/** Both lists (loaded when first needed) */
export function wordLists(): Promise<WordLists> {
	lists ??= Promise.all([import('./words.en.js'), import('./words.de.js')]).then(([en, de]) => ({ en: en.default, de: de.default }));
	return lists;
}

/** A new code (random numbers) */
export function newWordCode(): number[] {
	const values = crypto.getRandomValues(new Uint16Array(WORD_COUNT));
	return [...values].map((v) => v % LIST_SIZE);
}

/** The words of a code in a language (German for `de`, else English) */
export function wordsOf(code: WordCode, all: WordLists, language: string): string[] {
	const list = language.startsWith('de') ? all.de : all.en;
	return code.map((n) => list[n]);
}

/** A typed word as the lists write it: lower case, umlauts and ß as two letters */
export const plainWord = (word: string) =>
	word
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z]/g, '');

/** The number of a word in either list; -1 for none */
export function numberOf(word: string, all: WordLists): number {
	const plain = plainWord(word);
	const en = all.en.indexOf(plain);
	return en >= 0 ? en : all.de.indexOf(plain);
}

/** Words of either list that start like `typed` (for completing it), at most `max` */
export function completions(typed: string, all: WordLists, max = 6): string[] {
	const plain = plainWord(typed);
	if (!plain) return [];
	const out: string[] = [];
	for (const list of [all.de, all.en]) for (const w of list) if (w.startsWith(plain) && out.length < max) out.push(w);
	return out;
}

/** A code from typed text (words separated by anything but letters); null unless it is exactly four known words */
export function parseWords(text: string, all: WordLists): number[] | null {
	const words = text.split(/[^\p{L}]+/u).filter(Boolean);
	if (words.length !== WORD_COUNT) return null;
	const code = words.map((w) => numberOf(w, all));
	return code.every((n) => n >= 0) ? code : null;
}

/**
 * The secret of a code: its room and the key of its proofs (base32, like a share's key). Deliberately slow
 * (`ROUNDS` of PBKDF2-SHA-256) – a guess costs as much offline as here.
 */
export async function wordSecret(code: WordCode): Promise<string> {
	const key = await crypto.subtle.importKey('raw', utf8(`in-browser-words\n${code.join('.')}`), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: utf8('in-browser-words-v1'), iterations: ROUNDS }, key, 160);
	return encodeBase32(new Uint8Array(bits));
}
