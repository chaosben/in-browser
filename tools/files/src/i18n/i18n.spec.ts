import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';

describe('translations', () => {
	type Tree = { [key: string]: unknown };
	const keys = (tree: Tree, prefix = ''): string[] =>
		Object.entries(tree).flatMap(([k, v]) =>
			v && typeof v === 'object' ? keys(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`]
		);

	it('have the same keys and types in both languages', () => {
		expect(keys(de as unknown as Tree)).toEqual(keys(en as unknown as Tree));
	});
	it('insert values', () => {
		expect(en.list.items(1)).toBe('1 item');
		expect(de.list.items(3)).toBe('3 Elemente');
		expect(de.properties.counts(1, 2)).toBe('1 Datei, 2 Ordner');
		expect(de.menu.openWith('Screen Capture')).toBe('Mit Screen Capture öffnen');
	});
});
