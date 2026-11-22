import { FormatError } from '@in-browser/files/formats.js';
import { describe, expect, it } from 'vitest';
import { chosenWord, defaultWords, parseWords, serializeWords, WORDS_FORMAT } from './stamp-words.js';

describe('the stamp words file', () => {
	it('keeps the list and drops entries that say nothing', () => {
		const words = [
			{ id: 'Approved', name: 'Approved' as const, text: 'OK', color: '#15803d' },
			{ id: 'a1', text: 'Paid', color: '#7e22ce' }
		];
		expect(parseWords(JSON.parse(serializeWords(words)))).toEqual(words);
		const raw = { format: WORDS_FORMAT, version: 1, words: [...words, { id: 'a1', text: 'Twice', color: '#000000' }, { id: 'b', color: '#000000' }, { id: 'c', text: 'x', color: 'red' }, null] };
		expect(parseWords(raw)).toEqual(words);
	});

	it('refuses a newer version instead of overwriting it', () => {
		expect(() => parseWords({ format: WORDS_FORMAT, version: 2, words: [] })).toThrow(FormatError);
	});

	it('finds a choice remembered as a standard name', () => {
		expect(chosenWord(defaultWords(), 'Draft')?.name).toBe('Draft');
		expect(chosenWord(defaultWords(), 'gone')?.id).toBe('Approved');
	});
});
