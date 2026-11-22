import { describe, expect, it } from 'vitest';
import { COLLAPSED, defaultMode, fitGroups, keyTips, MEDIUM, ribbonSettings, shrinkOrder, SMALL } from './ribbon';

// widths per group: medium, small, collapsed
const g = (medium: number) => [medium, medium * 0.5, 30];

describe('fitGroups', () => {
	const widths = [g(300), g(200), g(100)];
	const order = shrinkOrder(3);

	it('keeps every label when there is room', () => {
		expect(fitGroups(widths, 1000, order, 10)).toEqual([MEDIUM, MEDIUM, MEDIUM]);
	});

	it('shrinks from the right, one size per round', () => {
		// 600 + 20 gap = 620 > 600: the last group gets small first (50 → 570)
		expect(fitGroups(widths, 600, order, 10)).toEqual([MEDIUM, MEDIUM, SMALL]);
		// Not enough: the middle one too (300 + 100 + 50 + 20 = 470 ≤ 480)
		expect(fitGroups(widths, 480, order, 10)).toEqual([MEDIUM, SMALL, SMALL]);
		// All three small (300 + 20 = 320 ≤ 330)
		expect(fitGroups(widths, 330, order, 10)).toEqual([SMALL, SMALL, SMALL]);
	});

	it('only takes a size that saves room', () => {
		// The middle group is narrower small than collapsed: it stays small
		const mixed = [g(300), [200, 30, 60], g(100)];
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

describe('the kept display', () => {
	// The display was each tool's once, and “tabs only” one of its kinds: taken over as the collapsed ribbon
	it.each([
		[null, null, { collapsed: false }],
		[null, { mode: 'simplified', tab: 'home' }, { mode: 'simplified', collapsed: false }],
		[null, { mode: 'tabs', tab: 'home' }, { collapsed: true }],
		[{ mode: 'minimal', collapsed: true }, { mode: 'classic' }, { mode: 'minimal', collapsed: true }],
		[{ collapsed: false }, { mode: 'tabs' }, { collapsed: false }],
		[{ mode: 'unknown' }, null, { collapsed: false }]
	])('of %j (suite) and %j (tool) is %j', (suite, tool, expected) => {
		expect(ribbonSettings(suite, tool)).toEqual(expected);
	});

	it('follows the device until a display is chosen', () => {
		expect([defaultMode(false), defaultMode(true)]).toEqual(['classic', 'minimal']);
	});
});
