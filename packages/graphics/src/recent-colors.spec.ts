import { describe, expect, it } from 'vitest';
import { mergeSwatches } from './recent-colors';

describe('mergeSwatches', () => {
	it('recent colors first, then project colors, without presets', () => {
		expect(mergeSwatches(['#111111', '#ef4444'], ['#222222', '#111111'], ['#ef4444'])).toEqual(['#111111', '#222222']);
	});
	it('respects the limit', () => {
		expect(mergeSwatches(['#111111', '#222222'], ['#333333'], [], 2)).toEqual(['#111111', '#222222']);
	});
});
