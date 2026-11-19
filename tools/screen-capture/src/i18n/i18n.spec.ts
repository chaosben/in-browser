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
		expect(en.common.importing('a.mp4')).toBe('Importing a.mp4 …');
		expect(de.home.storage('1 GB', '20 GB')).toBe('1 GB von 20 GB belegt');
	});
});
