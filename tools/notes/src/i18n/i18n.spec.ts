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
	it('are not empty', () => {
		for (const tree of [de, en]) {
			for (const key of keys(tree as unknown as Tree)) expect(key).not.toMatch(/:undefined$/);
		}
		expect(en.home.pages(1)).toBe('1 page');
		expect(de.home.pages(3)).toBe('3 Seiten');
		expect(de.page.deleteQuestion.message(3)).toContain('Seite 3');
	});
});
