import { describe, expect, it } from 'vitest';
import { completions, LIST_SIZE, parseWords, wordLists, wordSecret, wordsOf } from './words.js';
import de from './words.de.js';
import en from './words.en.js';

// Word codes open shares: a code shown in one language must be read in either, and the lists must never change
// meaning (a code from one version is read by the next).

describe('share word codes', () => {
	it('has two lists of 1024 distinct plain words, none in both', () => {
		for (const list of [en, de]) {
			expect(list).toHaveLength(LIST_SIZE);
			expect(new Set(list).size).toBe(LIST_SIZE);
			expect(list.every((w) => /^[a-z]{3,8}$/.test(w))).toBe(true);
		}
		expect(en.filter((w) => de.includes(w))).toEqual([]);
		// The numbers are fixed: changing a list breaks codes shown by an older version
		expect([en[0], en[1023], de[0], de[1023]]).toMatchSnapshot();
	});

	it('reads a code shown in one language typed in either, with umlauts and any case', async () => {
		const lists = await wordLists();
		const code = [7, 300, 512, 1023];
		const german = wordsOf(code, lists, 'de');
		expect(parseWords(german.join(' '), lists)).toEqual(code);
		expect(parseWords(` ${wordsOf(code, lists, 'en').join(', ').toUpperCase()} `, lists)).toEqual(code);
		expect(parseWords('apfel fluss wolke', lists)).toBeNull();
		expect(parseWords('apfel fluss wolke nichtda', lists)).toBeNull();
		expect(completions('flu', lists)).toContain('fluss');
	});

	it('derives the same secret for the same code, another for another', async () => {
		const a = await wordSecret([1, 2, 3, 4]);
		expect(await wordSecret([1, 2, 3, 4])).toBe(a);
		expect(await wordSecret([1, 2, 3, 5])).not.toBe(a);
	});
});
