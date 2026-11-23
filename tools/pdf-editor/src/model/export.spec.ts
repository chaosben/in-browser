import { describe, expect, it } from 'vitest';
import { expandName, pictureNames } from './export';

const date = new Date(2026, 10, 3, 9, 5);

describe('names of exported pictures', () => {
	it.each([
		['{name}_{page}', 7, 120, 'Talk_007'],
		['{name} {page} of {pages}', 12, 12, 'Talk 12 of 12'],
		['{date} {time} {name}', 1, 1, '2026-11-03 09-05 Talk'],
		['{name}_{seite}', 1, 9, 'Talk_{seite}']
	])('%s on page %i of %i → %s', (template, page, pages, expected) => {
		expect(expandName(template, { name: 'Talk', page, pages, date })).toBe(expected);
	});

	it('never takes the name of a file in the folder, nor one name twice', () => {
		const v = { name: 'Talk', pages: 3, date };
		expect(pictureNames('{name}_{page}', 'png', [1, 2], v, ['Talk_1.png'])).toEqual(['Talk_1 (2).png', 'Talk_2.png']);
		// Without {page} every page would get the same name
		expect(pictureNames('{name}', 'jpg', [1, 2, 3], v, [])).toEqual(['Talk.jpg', 'Talk (2).jpg', 'Talk (3).jpg']);
	});
});
