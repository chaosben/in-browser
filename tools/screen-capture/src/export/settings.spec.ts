import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	estimateBytes,
	fitToProject,
	frameDelay,
	gifIsLarge,
	gifSize,
	outputSize,
	videoBitrate
} from './settings';

describe('outputSize', () => {
	it('keeps the original at height 0', () => {
		expect(outputSize({ height: 0 }, 2560, 1440)).toEqual({ width: 2560, height: 1440 });
	});
	it('scales down and rounds to even values', () => {
		expect(outputSize({ height: 720 }, 2560, 1440)).toEqual({ width: 1280, height: 720 });
		expect(outputSize({ height: 480 }, 1366, 768)).toEqual({ width: 854, height: 480 });
	});
	it('never scales up', () => {
		expect(outputSize({ height: 2160 }, 1280, 720)).toEqual({ width: 1280, height: 720 });
	});
});

describe('videoBitrate / estimateBytes', () => {
	it('increases with the quality level', () => {
		const rates = (['low', 'medium', 'high', 'very-high'] as const).map((quality) =>
			videoBitrate({ ...DEFAULT_SETTINGS, quality }, 1920, 1080)
		);
		expect([...rates].sort((a, b) => a - b)).toEqual(rates);
		expect(rates[2]).toBeGreaterThan(4_000_000);
		expect(rates[2]).toBeLessThan(10_000_000);
	});
	it('uses the custom bitrate', () => {
		expect(videoBitrate({ ...DEFAULT_SETTINGS, quality: 'custom', customMbps: 5 }, 1, 1)).toBe(5_000_000);
	});
	it('estimates the file size', () => {
		const s = { ...DEFAULT_SETTINGS, quality: 'custom' as const, customMbps: 8, audioKbps: 0 as const };
		expect(estimateBytes(s, 1920, 1080, 10)).toBe(10_000_000);
	});
});

describe('gifSize', () => {
	it('limits the width and keeps the aspect ratio', () => {
		expect(gifSize({ gifWidth: 800 }, 1920, 1080)).toEqual({ width: 800, height: 450 });
	});
	it('keeps the original at width 0 and never scales up', () => {
		expect(gifSize({ gifWidth: 0 }, 1366, 768)).toEqual({ width: 1366, height: 768 });
		expect(gifSize({ gifWidth: 1280 }, 640, 360)).toEqual({ width: 640, height: 360 });
	});
});

describe('gifIsLarge', () => {
	it('warns for long or large GIFs', () => {
		expect(gifIsLarge(800, 450, 10)).toBe(false);
		expect(gifIsLarge(800, 450, 31)).toBe(true);
		expect(gifIsLarge(1920, 1080, 5)).toBe(true);
	});
});

describe('frameDelay', () => {
	it('is exact where 100 is divisible by the frame rate', () => {
		expect([0, 1, 2].map((k) => frameDelay(k, 10))).toEqual([10, 10, 10]);
		expect([0, 1, 2].map((k) => frameDelay(k, 25))).toEqual([4, 4, 4]);
	});
	it('keeps the overall speed at 15 fps', () => {
		const delays = Array.from({ length: 15 }, (_, k) => frameDelay(k, 15));
		expect(delays.reduce((a, b) => a + b)).toBe(100);
		expect(new Set(delays)).toEqual(new Set([6, 7]));
	});
});

describe('fitToProject', () => {
	it('turns sizes not smaller than the project into the original', () => {
		const fitted = fitToProject({ ...DEFAULT_SETTINGS, height: 1080, gifWidth: 800 }, 640, 360);
		expect(fitted).toMatchObject({ height: 0, gifWidth: 0 });
	});
	it('keeps smaller sizes', () => {
		const fitted = fitToProject({ ...DEFAULT_SETTINGS, height: 720, gifWidth: 800 }, 1920, 1080);
		expect(fitted).toMatchObject({ height: 720, gifWidth: 800 });
	});
});
