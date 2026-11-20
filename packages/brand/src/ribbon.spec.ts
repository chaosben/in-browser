import { describe, expect, it } from 'vitest';
import { COLLAPSED, fitGroups, keyTips, LARGE, MEDIUM, shrinkOrder, SMALL } from './ribbon';

// widths per group: large, medium, small, collapsed
const g = (large: number) => [large, large * 0.7, large * 0.4, 30];

describe('fitGroups', () => {
	const widths = [g(300), g(200), g(100)];
	const order = shrinkOrder(3);

	it('keeps everything large when there is room', () => {
		expect(fitGroups(widths, 1000, order, 10)).toEqual([LARGE, LARGE, LARGE]);
	});

	it('shrinks from the right, one size per round', () => {
		// 600 + 20 gap = 620 > 600: the last group gets medium first (70 → 590)
		expect(fitGroups(widths, 600, order, 10)).toEqual([LARGE, LARGE, MEDIUM]);
		// Not enough: all three medium (420 + 20 = 440 ≤ 450)
		expect(fitGroups(widths, 450, order, 10)).toEqual([MEDIUM, MEDIUM, MEDIUM]);
		// Small from the right
		expect(fitGroups(widths, 400, order, 10)).toEqual([MEDIUM, SMALL, SMALL]);
	});

	it('only takes a size that saves room', () => {
		// The middle group is narrower small than collapsed: it stays small
		const mixed = [g(300), [200, 140, 30, 60], g(100)];
		expect(fitGroups(mixed, 100, shrinkOrder(3), 0)).toEqual([COLLAPSED, SMALL, COLLAPSED]);
	});

	it('collapses groups last and stops there', () => {
		expect(fitGroups(widths, 150, order, 10)).toEqual([COLLAPSED, COLLAPSED, COLLAPSED]);
		expect(fitGroups(widths, 10, order, 10)).toEqual([COLLAPSED, COLLAPSED, COLLAPSED]);
	});
});

describe('keyTips', () => {
	it('takes the first free letter, then another letter, then two', () => {
		expect(keyTips(['Home', 'Comment', 'Pages', 'Form', 'View'])).toEqual(['H', 'C', 'P', 'F', 'V']);
		expect(keyTips(['Copy', 'Cut', 'Clear'])).toEqual(['C', 'U', 'L']);
		expect(keyTips(['A', 'A', 'A'])).toEqual(['A', 'A1', 'A2']);
	});
	it('leaves keys that are taken', () => {
		expect(keyTips(['File'], ['F'])).toEqual(['I']);
	});
});
