import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';
import { detectLocale } from './index.svelte';

describe('detectLocale', () => {
	it('picks the first supported language and keeps the region tag', () => {
		expect(detectLocale(['de-AT', 'en-US'])).toEqual({ locale: 'de', tag: 'de-AT' });
		expect(detectLocale(['fr-FR', 'en-GB', 'de'])).toEqual({ locale: 'en', tag: 'en-GB' });
		expect(detectLocale(['DE'])).toEqual({ locale: 'de', tag: 'DE' });
	});
	it('falls back to English', () => {
		expect(detectLocale(['fr', 'es'])).toEqual({ locale: 'en', tag: 'en' });
		expect(detectLocale([])).toEqual({ locale: 'en', tag: 'en' });
	});
});

describe('brand component texts', () => {
	type Tree = { [key: string]: unknown };
	const keys = (tree: Tree, prefix = ''): string[] =>
		Object.entries(tree).flatMap(([k, v]) =>
			v && typeof v === 'object' ? keys(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`]
		);

	it('have the same keys and types in both languages', () => {
		expect(keys(de as unknown as Tree)).toEqual(keys(en as unknown as Tree));
	});
	it('insert names', () => {
		expect(de.brand.toolHome('Screen Capture')).toBe('Zur Startseite von Screen Capture');
		expect(en.brand.toolHome('Screen Capture')).toBe('Screen Capture home');
		expect(de.brand.allTools).toBe('Alle Tools von in-browser');
	});
});
