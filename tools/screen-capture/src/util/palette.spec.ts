import { describe, expect, it } from 'vitest';
import { COLORS } from '#lib/project/defaults.js';
import { isDefaultPalette, placeColor, validPalette } from './palette';

describe('placeColor', () => {
	it('replaces the color at the place', () => {
		expect(placeColor(['#111111', '#222222', '#333333'], 1, '#999999')).toEqual(['#111111', '#999999', '#333333']);
	});
	it('swaps with the same color elsewhere', () => {
		expect(placeColor(['#111111', '#222222', '#333333'], 0, '#333333')).toEqual(['#333333', '#222222', '#111111']);
	});
	it('keeps the palette on its own place', () => {
		expect(placeColor(['#111111', '#222222'], 1, '#222222')).toEqual(['#111111', '#222222']);
	});
});

describe('validPalette', () => {
	it('accepts a complete palette', () => {
		const custom = placeColor(COLORS, 0, '#123456');
		expect(validPalette(custom)).toEqual(custom);
		expect(isDefaultPalette(custom)).toBe(false);
	});
	it('falls back to the defaults', () => {
		for (const raw of [null, 'x', ['#123456'], [...COLORS.slice(1), 'red'], [...COLORS.slice(1), COLORS[1]]]) {
			expect(isDefaultPalette(validPalette(raw))).toBe(true);
		}
	});
});
