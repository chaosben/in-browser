import { describe, expect, it } from 'vitest';
import { partialStrokes, seeded, strokesLength, strokesOf, type Shape } from './shapes';

describe('seeded', () => {
	it('repeats the same sequence for the same text', () => {
		const a = seeded('abc');
		const b = seeded('abc');
		const c = seeded('abd');
		const first = [a(), a(), a()];
		expect([b(), b(), b()]).toEqual(first);
		expect([c(), c(), c()]).not.toEqual(first);
		expect(first.every((v) => v >= 0 && v < 1)).toBe(true);
	});
});

describe('strokesOf', () => {
	const rect = (sketch: boolean): Shape => ({ kind: 'rect', seed: 'r', sketch, x: 10, y: 20, w: 100, h: 50, radius: 0 });
	it('draws an exact rectangle as one closed stroke through its corners', () => {
		const [stroke] = strokesOf(rect(false));
		expect(stroke[0]).toEqual(stroke.at(-1));
		expect(strokesLength([stroke])).toBeCloseTo(300);
	});
	it('draws a hand-drawn rectangle as four strokes', () => {
		expect(strokesOf(rect(true))).toHaveLength(4);
	});
	it('keeps an exact arrow shaft short of the tip, so the filled head covers it', () => {
		const arrow: Shape = { kind: 'arrow', seed: 'a', sketch: false, from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, width: 4, minHead: 10 };
		const [[, end]] = strokesOf(arrow);
		expect(end.x).toBeCloseTo(100 - 14 * 0.8);
	});
});

describe('partialStrokes', () => {
	const strokes = [
		[
			{ x: 0, y: 0 },
			{ x: 10, y: 0 }
		],
		[
			{ x: 0, y: 10 },
			{ x: 10, y: 10 }
		]
	];
	it('nothing at 0, everything at 1', () => {
		expect(strokesLength(partialStrokes(strokes, 0))).toBe(0);
		expect(partialStrokes(strokes, 1)).toEqual(strokes);
	});
	it('cuts at the share of the total length, in order', () => {
		const half = partialStrokes(strokes, 0.5);
		expect(half).toHaveLength(1);
		expect(strokesLength(half)).toBeCloseTo(10);
		const most = partialStrokes(strokes, 0.75);
		expect(most).toHaveLength(2);
		expect(most[1].at(-1)).toEqual({ x: 5, y: 10 });
	});
});
