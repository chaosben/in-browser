import { describe, expect, it } from 'vitest';
import { frameIndex } from './visuals';

describe('frameIndex', () => {
	it('picks the thumbnail nearest to the time, within the list', () => {
		expect(frameIndex(2, 10, 0)).toBe(0);
		expect(frameIndex(2, 10, 5.2)).toBe(3);
		expect(frameIndex(2, 10, 100)).toBe(9);
		expect(frameIndex(2, 10, -1)).toBe(0);
	});
});
