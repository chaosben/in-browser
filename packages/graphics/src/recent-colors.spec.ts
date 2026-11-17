import { describe, expect, it } from 'vitest';
import { mergeSwatches, pushRecent } from './recent-colors';

describe('pushRecent', () => {
	it('puts the color in front without duplicates', () => {
		expect(pushRecent(['#111111', '#222222'], '#333333')).toEqual(['#333333', '#111111', '#222222']);
		expect(pushRecent(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111']);
	});
	it('drops the oldest beyond the limit', () => {
		expect(pushRecent(['#111111', '#222222'], '#333333', 2)).toEqual(['#333333', '#111111']);
	});
});

describe('mergeSwatches', () => {
	it('recent colors first, then project colors, without presets', () => {
		expect(mergeSwatches(['#111111', '#ef4444'], ['#222222', '#111111'], ['#ef4444'])).toEqual(['#111111', '#222222']);
	});
	it('respects the limit', () => {
		expect(mergeSwatches(['#111111', '#222222'], ['#333333'], [], 2)).toEqual(['#111111', '#222222']);
	});
});
