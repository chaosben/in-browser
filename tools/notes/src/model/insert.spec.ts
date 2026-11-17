import { describe, expect, it } from 'vitest';
import { iconItem, placeBox } from './insert';

const A4 = { w: 595, h: 842 };

describe('placing pictures', () => {
	it('keeps small pictures at their size, centered at the point', () => {
		expect(placeBox(A4, 100, 50, 300, 400)).toEqual({ x: 250, y: 375, w: 100, h: 50 });
	});
	it('shrinks large pictures to fit the page, keeping the proportions', () => {
		const box = placeBox(A4, 2000, 1000, 300, 400);
		expect(box.w).toBeCloseTo(595 * 0.7);
		expect(box.w / box.h).toBeCloseTo(2);
	});
	it('stays on the page near its edges', () => {
		expect(placeBox(A4, 100, 100, 5, 840)).toMatchObject({ x: 0, y: 742 });
	});
	it('gives icons a fixed size in their proportions', () => {
		const item = iconItem({ name: 'x', body: '', width: 24, height: 12 }, '#ff0000', A4, 100, 100);
		expect(item).toMatchObject({ type: 'icon', color: '#ff0000', w: 48, h: 24 });
	});
});
