import { describe, expect, it } from 'vitest';
import { frameDelay, outputSize } from './settings';

describe('outputSize', () => {
	it.each([
		['keeps the original at height 0', { height: 0, scale: 100 }, 2560, 1440, { width: 2560, height: 1440 }],
		['rounds to even values', { height: 480, scale: 100 }, 1366, 768, { width: 854, height: 480 }],
		['never scales up', { height: 2160, scale: 100 }, 1280, 720, { width: 1280, height: 720 }],
		['scales by percent before a fixed height', { height: 1080, scale: 25 }, 1366, 768, { width: 342, height: 192 }]
	])('%s', (_, settings, width, height, expected) => {
		expect(outputSize(settings, width, height)).toEqual(expected);
	});
});

describe('frameDelay', () => {
	it('keeps the overall speed of a GIF where 100 is not divisible by the frame rate', () => {
		const delays = Array.from({ length: 15 }, (_, k) => frameDelay(k, 15));
		expect(delays.reduce((a, b) => a + b)).toBe(100);
		expect(new Set(delays)).toEqual(new Set([6, 7]));
	});
});
