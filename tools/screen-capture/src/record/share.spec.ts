import { describe, expect, it } from 'vitest';
import { describeShare, scalePercent } from './share.js';

describe('describeShare', () => {
	it('reads surface and frame rate', () => {
		expect(describeShare({ displaySurface: 'window', width: 3840, height: 2160, frameRate: 29.97 })).toEqual({
			surface: 'window',
			frameRate: 30
		});
	});
	it('handles missing and unknown values', () => {
		expect(describeShare({ displaySurface: 'application' })).toEqual({ surface: null, frameRate: 0 });
	});
});

describe('scalePercent', () => {
	it('rounds the pixel ratio to percent', () => {
		expect(scalePercent(1)).toBe(100);
		expect(scalePercent(1.25)).toBe(125);
		expect(scalePercent(1.5000001)).toBe(150);
	});
});
