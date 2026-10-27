import { describe, expect, it } from 'vitest';
import { calloutTail } from './overlays';

const box = { x: 100, y: 100, w: 200, h: 80 };
/** Signed area in canvas coordinates (positive = same winding as `roundRect`) */
const area = ([a, b, c]: { x: number; y: number }[]) =>
	a.x * b.y - b.x * a.y + (b.x * c.y - c.x * b.y) + (c.x * a.y - a.x * c.y);

describe('calloutTail', () => {
	it('has no pointer when the tip lies within the box', () => {
		expect(calloutTail(box, { x: 150, y: 120 })).toBeNull();
	});
	it('points to the tip with the winding of the box, in every direction', () => {
		for (const tip of [
			{ x: 0, y: 0 },
			{ x: 400, y: 0 },
			{ x: 400, y: 300 },
			{ x: 0, y: 300 },
			{ x: 200, y: 400 }
		]) {
			const tail = calloutTail(box, tip)!;
			expect(tail[1]).toEqual(tip);
			expect(area(tail)).toBeGreaterThan(0);
		}
	});
});
