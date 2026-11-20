import { describe, expect, it } from 'vitest';
import { captureLayout, sameShape } from './content';

describe('captureLayout', () => {
	it('largest frame, centered and even', () => {
		const sizes = [
			{ t: 0, width: 800, height: 600 },
			{ t: 1, width: 1001, height: 701 }
		];
		expect(captureLayout({ width: 1920, height: 1080 }, { width: 1001, height: 701 }, sizes)).toEqual({
			width: 1002,
			height: 702,
			crop: { x: 459, y: 189 },
			sizes
		});
	});
});

describe('sameShape', () => {
	const tab = { width: 2394, height: 1574 };
	it.each([
		['same size', tab, true],
		['half size with rounding (Chrome capture scale 1 instead of 2)', { width: 1196, height: 786 }, true],
		['other scale step', { width: 2094, height: 1376 }, true],
		['only the width changed', { width: 2000, height: 1574 }, false]
	])('%s', (_, size, expected) => {
		expect(sameShape(tab, size)).toBe(expected);
	});
});
