import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';
import { messageKeys } from '@in-browser/brand/i18n/keys.js';

describe('translations', () => {
	it('have the same keys and types in both languages', () => {
		expect(messageKeys(de)).toEqual(messageKeys(en));
	});
	it('are not empty', () => {
		for (const tree of [de, en]) {
			for (const key of messageKeys(tree)) expect(key).not.toMatch(/:undefined$/);
		}
		expect(en.home.pages(1)).toBe('1 page');
		expect(de.home.pages(3)).toBe('3 Seiten');
		expect(de.page.deleteQuestion.message(3)).toContain('Seite 3');
	});
});
