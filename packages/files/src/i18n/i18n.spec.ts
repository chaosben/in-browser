import { describe, expect, it } from 'vitest';
import de from './de';
import en from './en';
import { formatSize } from './index.svelte';

describe('file system texts', () => {
	type Tree = { [key: string]: unknown };
	const keys = (tree: Tree, prefix = ''): string[] =>
		Object.entries(tree).flatMap(([k, v]) =>
			v && typeof v === 'object' ? keys(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}:${typeof v}`]
		);

	it('have the same keys and types in both languages', () => {
		expect(keys(de as unknown as Tree)).toEqual(keys(en as unknown as Tree));
	});
	it('insert names', () => {
		expect(de.kinds.package('Screen Capture')).toBe('Screen Capture-Projekt');
		expect(en.errors.exists('a.txt')).toBe('“a.txt” already exists.');
	});
});

describe('formatSize', () => {
	it('uses decimal units', () => {
		expect(formatSize(0, 'en')).toBe('0 bytes');
		expect(formatSize(1500, 'en')).toBe('1.5 kB');
		expect(formatSize(1_400_000, 'de')).toBe('1,4 MB');
		expect(formatSize(250_000_000_000, 'en')).toBe('250 GB');
	});
});
