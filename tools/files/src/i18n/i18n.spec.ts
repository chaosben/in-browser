import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';
import { messageKeys } from '@in-browser/brand/i18n/keys.js';

describe('translations', () => {
	it('have the same keys and types in both languages', () => {
		expect(messageKeys(de)).toEqual(messageKeys(en));
	});
	it('insert values', () => {
		expect(en.list.items(1)).toBe('1 item');
		expect(de.list.items(3)).toBe('3 Elemente');
		expect(de.properties.counts(1, 2)).toBe('1 Datei, 2 Ordner');
		expect(de.menu.openWith('Screen Capture')).toBe('Mit Screen Capture öffnen');
	});
});
