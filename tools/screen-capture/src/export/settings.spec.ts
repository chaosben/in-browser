import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, estimateBytes, outputSize, videoBitrate } from './settings';

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
