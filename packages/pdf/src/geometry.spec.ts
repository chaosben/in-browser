import { describe, expect, it } from 'vitest';
import { pageTransform, toUserSpace } from './geometry';

describe('page geometry', () => {
	// A4 with its box moved away from the origin (a crop box)
	const view = [10, 20, 605, 862];
	const apply = ([a, b, c, d, e, f]: number[], x: number, y: number) => [a * x + c * y + e, b * x + d * y + f];

	it('puts the top left corner of the page at the origin, for every rotation', () => {
		expect(apply(pageTransform(view, 0), 10, 862)).toEqual([0, 0]);
		expect(apply(pageTransform(view, 90), 10, 20)).toEqual([0, 0]);
		expect(apply(pageTransform(view, 180), 605, 20)).toEqual([0, 0]);
		expect(apply(pageTransform(view, 270), 605, 862)).toEqual([0, 0]);
		// Turned a quarter: the page is 842 wide
		expect(apply(pageTransform(view, 90), 605, 862)).toEqual([842, 595]);
	});

	it('turns shown points back into user space', () => {
		for (const r of [0, 90, 180, 270]) {
			const m = pageTransform(view, r);
			const [x, y] = apply(m, 100, 200);
			const back = toUserSpace(m)(x, y);
			expect(back[0]).toBeCloseTo(100);
			expect(back[1]).toBeCloseTo(200);
		}
	});
});
