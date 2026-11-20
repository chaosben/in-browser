import { describe, expect, it } from 'vitest';
import { matches, shortcutLabel } from './commands';
import de from './i18n/de';
import en from './i18n/en';

const key = (key: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>> = {}) =>
	({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods }) as KeyboardEvent;

describe('shortcuts', () => {
	it('match letters without case and with exactly their modifiers', () => {
		expect(matches(key('z', { ctrlKey: true }), { key: 'z', ctrl: true })).toBe(true);
		expect(matches(key('Z', { ctrlKey: true, shiftKey: true }), { key: 'z', ctrl: true })).toBe(false);
		expect(matches(key('Z', { ctrlKey: true, shiftKey: true }), { key: 'z', ctrl: true, shift: true })).toBe(true);
		expect(matches(key('z'), { key: 'z', ctrl: true })).toBe(false);
	});
	it('match characters that need Shift on some layouts', () => {
		expect(matches(key('+', { ctrlKey: true, shiftKey: true }), { key: '+', ctrl: true })).toBe(true);
	});
	it('are shown in the language of the user', () => {
		expect(shortcutLabel({ key: 'z', ctrl: true, shift: true }, en.keys)).toBe('Ctrl+Shift+Z');
		expect(shortcutLabel({ key: 'z', ctrl: true, shift: true }, de.keys)).toBe('Strg+Umschalt+Z');
		expect(shortcutLabel({ key: 'Delete' }, de.keys)).toBe('Entf');
	});
});
