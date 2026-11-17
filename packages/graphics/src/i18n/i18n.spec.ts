import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';

describe('graphics texts', () => {
	type Tree = { [key: string]: unknown };
	const keys = (tree: Tree, prefix = ''): string[] =>
		Object.entries(tree).flatMap(([k, v]) =>
			v && typeof v === 'object' ? keys(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`]
		);

	it('have the same keys and types in both languages', () => {
		expect(keys(de as unknown as Tree)).toEqual(keys(en as unknown as Tree));
	});
	it('insert values', () => {
		expect(de.icons.load('1.3 MB')).toBe('Alle Icons laden (ca. 1,3 MB)');
		expect(en.color.value('#ff0000')).toBe('Color #ff0000');
	});
});
