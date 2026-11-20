import { describe, expect, it } from 'vitest';
import { highlightBoxes } from './highlight.js';

describe('highlightBoxes', () => {
	it('reaches from the font’s descent to its ascent, a little past the first and last letter', () => {
		// A line at size 10, baseline at y = 110
		const [box] = highlightBoxes([{ x0: 20, y0: 100, x1: 80, y1: 110, ascent: 0.75, descent: -0.25 }], 0);
		expect(box.y0).toBeCloseTo(102.5);
		expect(box.y1).toBeCloseTo(112.5);
		expect(box.x0).toBeCloseTo(19.4);
		expect(box.x1).toBeCloseTo(80.6);
	});

	it('lets close lines meet halfway instead of overlapping', () => {
		// Baselines 11 apart: 9 up and 3 down would overlap by 1
		const [a, b] = highlightBoxes(
			[
				{ x0: 20, y0: 100, x1: 80, y1: 110, ascent: 0.9, descent: -0.3 },
				{ x0: 20, y0: 111, x1: 60, y1: 121, ascent: 0.9, descent: -0.3 }
			],
			0
		);
		expect(a.y1).toBeCloseTo(b.y0);
		expect(a.y1).toBeCloseTo(112.5);
	});

	it('turns with the text', () => {
		// Text running down (page turned 90°): letters stand on x = 10, their tops toward larger x
		const [box] = highlightBoxes([{ x0: 10, y0: 20, x1: 20, y1: 80 }], 90);
		expect(box.x0).toBeCloseTo(8);
		expect(box.x1).toBeCloseTo(19);
	});
});
