import { describe, expect, it } from 'vitest';
import { svgSize } from './images';

describe('svgSize', () => {
	it('uses width and height', () => {
		expect(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80px" viewBox="0 0 12 8">')).toEqual({ width: 120, height: 80 });
	});
	it('falls back to the viewBox, scaled to 512 px', () => {
		expect(svgSize('<svg viewBox="0 0 24 12"></svg>')).toEqual({ width: 512, height: 256 });
	});
	it('null without usable dimensions', () => {
		expect(svgSize('<svg width="100%"></svg>')).toBeNull();
		expect(svgSize('no svg')).toBeNull();
	});
});
