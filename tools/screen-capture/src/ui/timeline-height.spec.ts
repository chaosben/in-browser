import { describe, expect, it } from 'vitest';
import { clampTimelineHeight } from './timeline-height';

describe('clampTimelineHeight', () => {
	it('keeps heights within the window', () => {
		expect(clampTimelineHeight(260, 1000)).toBe(260);
		expect(clampTimelineHeight(900, 1000)).toBe(700);
		expect(clampTimelineHeight(50, 1000)).toBe(140);
	});
	it('never goes below the minimum, even in a tiny window', () => {
		expect(clampTimelineHeight(260, 150)).toBe(140);
	});
});
