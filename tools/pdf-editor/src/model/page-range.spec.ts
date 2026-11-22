import { describe, expect, it } from 'vitest';
import { parsePageRange } from './page-range.js';

describe('parsePageRange', () => {
	it.each([
		['1-3, 7', [0, 1, 2, 6]],
		['7,2 – 3,2', [1, 2, 6]],
		['10', [9]],
		// Not a page of the document, backwards, not a number, nothing
		['0', null],
		['9-11', null],
		['3-1', null],
		['1, x', null],
		[' ', null]
	])('%s', (text, pages) => {
		expect(parsePageRange(text, 10)).toEqual(pages);
	});
});
