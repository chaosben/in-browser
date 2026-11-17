import { describe, expect, it } from 'vitest';
import { clampNumber, formatNumber, parseNumber } from './number';

describe('parseNumber', () => {
	it('accepts a decimal comma or point', () => {
		expect(parseNumber('12,5')).toBe(12.5);
		expect(parseNumber(' 0.25 ')).toBe(0.25);
	});
	it('returns null for anything else', () => {
		expect(parseNumber('')).toBeNull();
		expect(parseNumber('abc')).toBeNull();
	});
});

describe('clampNumber', () => {
	it('rounds and keeps the range', () => {
		expect(clampNumber(12.345, 0, 100, 1)).toBe(12.3);
		expect(clampNumber(150, 0, 100, 0)).toBe(100);
		expect(clampNumber(-1, 0, 100, 0)).toBe(0);
	});
});

describe('formatNumber', () => {
	it('uses the separator of the language', () => {
		expect(formatNumber(1.25, 2, 'de')).toBe('1,25');
		expect(formatNumber(1.25, 2, 'en')).toBe('1.25');
		expect(formatNumber(1200, 0, 'de')).toBe('1200');
	});
});
