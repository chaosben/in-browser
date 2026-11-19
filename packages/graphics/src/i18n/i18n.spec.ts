import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';
import { messageKeys } from '@in-browser/brand/i18n/keys.js';

describe('graphics texts', () => {
	it('have the same keys and types in both languages', () => {
		expect(messageKeys(de)).toEqual(messageKeys(en));
	});
	it('insert values', () => {
		expect(de.icons.load('1.3 MB')).toBe('Alle Icons laden (ca. 1,3 MB)');
		expect(en.color.value('#ff0000')).toBe('Color #ff0000');
	});
});
