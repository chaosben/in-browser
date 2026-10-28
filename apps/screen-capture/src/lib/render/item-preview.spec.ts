import { describe, expect, it } from 'vitest';
import type { Item } from '#lib/project/types.js';
import { previewBounds } from './item-preview';

describe('previewBounds', () => {
	it('spans all items with a margin, in canvas pixels', () => {
		const clip = (id: string, x: number, y: number): Item => ({
			id,
			type: 'video',
			sourceId: 's',
			start: 0,
			track: 0,
			in: 0,
			out: 1,
			rect: { x, y, w: 0.1, h: 0.1 }
		});
		const r = previewBounds([clip('a', 0.1, 0.1), clip('b', 0.5, 0.3)], 1000, 500)!;
		expect(r.x).toBeCloseTo(90);
		expect(r.y).toBeCloseTo(40);
		expect(r.w).toBeCloseTo(520);
		expect(r.h).toBeCloseTo(170);
	});
	it('nothing without items', () => {
		expect(previewBounds([], 1000, 500)).toBeNull();
	});
	it('leaves out clips without a picture (audio)', () => {
		const audio: Item = { id: 'a', type: 'video', sourceId: 'mic', start: 0, track: 0, in: 0, out: 1, rect: { x: 0, y: 0, w: 1, h: 1 } };
		expect(previewBounds([audio], 1000, 500, (clip) => clip.sourceId !== 'mic')).toBeNull();
	});
});
