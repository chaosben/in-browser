import { describe, expect, it } from 'vitest';
import { clickPhase } from './click';

describe('clickPhase', () => {
	it('runs from 0 to 1 over the duration', () => {
		expect(clickPhase(1, 1, 1.6)).toBe(0);
		expect(clickPhase(1.3, 1, 1.6)).toBeCloseTo(0.5);
		expect(clickPhase(2, 1, 1.6)).toBe(1);
		expect(clickPhase(0, 1, 1.6)).toBe(0);
	});
	it('is finished for an empty duration', () => {
		expect(clickPhase(1, 1, 1)).toBe(1);
	});
});
