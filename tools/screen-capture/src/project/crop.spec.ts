import { describe, expect, it } from 'vitest';
import { croppedRect, fullRect } from './crop';

const close = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => {
	for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k]).toBeCloseTo(b[k]);
};

describe('fullRect / croppedRect', () => {
	it('round trip', () => {
		const rect = { x: 0.2, y: 0.1, w: 0.3, h: 0.4 };
		const crop = { x: 0.25, y: 0.5, w: 0.5, h: 0.25 };
		close(croppedRect(fullRect(rect, crop), crop), rect);
		close(fullRect(rect, crop), { x: 0.05, y: -0.7, w: 0.6, h: 1.6 });
	});
});
