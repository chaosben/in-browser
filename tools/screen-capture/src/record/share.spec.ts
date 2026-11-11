import { describe, expect, it } from 'vitest';
import { cursorNotHidden, describeShare, scalePercent, type ShareInfo } from './share.js';

describe('describeShare', () => {
	it('reads surface and frame rate', () => {
		expect(describeShare({ displaySurface: 'window', width: 3840, height: 2160, frameRate: 29.97, cursor: 'never' })).toEqual({
			surface: 'window',
			frameRate: 30,
			cursor: 'never'
		});
	});
	it('handles missing and unknown values', () => {
		expect(describeShare({ displaySurface: 'application' })).toEqual({ surface: null, frameRate: 0, cursor: null });
	});
});

describe('cursorNotHidden', () => {
	const share = (surface: ShareInfo['surface'], cursor: ShareInfo['cursor']): ShareInfo => ({ surface, frameRate: 30, cursor });
	it('warns only when hiding was asked for and not confirmed', () => {
		expect(cursorNotHidden(share('monitor', 'never'), false)).toBe(false);
		expect(cursorNotHidden(share('monitor', 'always'), false)).toBe(true);
		expect(cursorNotHidden(share('window', null), false)).toBe(true);
		expect(cursorNotHidden(share('monitor', 'always'), true)).toBe(false);
	});
	it('never warns for tabs', () => {
		expect(cursorNotHidden(share('browser', null), false)).toBe(false);
	});
});

describe('scalePercent', () => {
	it('rounds the pixel ratio to percent', () => {
		expect(scalePercent(1)).toBe(100);
		expect(scalePercent(1.25)).toBe(125);
		expect(scalePercent(1.5000001)).toBe(150);
	});
});
