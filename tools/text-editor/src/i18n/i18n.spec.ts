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
		expect(en.common.untitled(1)).toBe('Untitled');
		expect(de.common.untitled(2)).toBe('Unbenannt 2');
		expect(de.questions.unmappable.message(3, 'Windows-1252')).toContain('3 Zeichen lassen');
	});
});
