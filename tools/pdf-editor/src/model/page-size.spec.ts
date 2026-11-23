import { describe, expect, it } from 'vitest';
import { resizePlace } from './page-size.js';

// Where a page's content and comments land on a resized page: wrong numbers put them off the page.

describe('resizePlace', () => {
	it.each([
		['keeps the size in the middle of a larger page', { w: 400, h: 600, fit: false, anchor: [0.5, 0.5] }, { scale: 1, dx: 50, dy: 100 }],
		['keeps the size at the bottom right', { w: 400, h: 600, fit: false, anchor: [1, 1] }, { scale: 1, dx: 100, dy: 200 }],
		['fits into a smaller page without distorting, centered where room is left', { w: 150, h: 400, fit: true, anchor: [0.5, 0.5] }, { scale: 0.5, dx: 0, dy: 100 }],
		['a smaller page without fitting cuts evenly around the middle', { w: 200, h: 300, fit: false, anchor: [0.5, 0.5] }, { scale: 1, dx: -50, dy: -50 }]
	] as const)('%s', (_, to, expected) => {
		expect(resizePlace(300, 400, { ...to, anchor: [...to.anchor] as [number, number] })).toEqual(expected);
	});
});
