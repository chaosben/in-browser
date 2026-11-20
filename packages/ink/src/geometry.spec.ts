import { describe, expect, it } from 'vitest';
import type { Stroke } from './items.js';
import { boundsOf, GridIndex, hitsStroke, segmentDistance2 } from './geometry';

const stroke = (id: string, pts: number[], size = 2): Stroke => ({ id, tool: 'pen', color: '#000000', size, points: new Float32Array(pts) });

describe('geometry', () => {
	it('measures the distance to a segment', () => {
		expect(segmentDistance2(5, 3, 0, 0, 10, 0)).toBe(9);
		expect(segmentDistance2(-4, 3, 0, 0, 10, 0)).toBe(25);
	});
	it('hits a stroke within its half width plus the radius', () => {
		const s = stroke('a', [0, 0, 0.5, 100, 0, 0.5], 4);
		expect(hitsStroke(s, 50, 6, 4)).toBe(true);
		expect(hitsStroke(s, 50, 7, 4)).toBe(false);
		expect(hitsStroke(stroke('dot', [10, 10, 0.5]), 12, 10, 1)).toBe(true);
	});
	it('computes padded bounds', () => {
		expect(boundsOf(new Float32Array([1, 5, 0, 3, 2, 0]), 1)).toEqual({ x0: 0, y0: 1, x1: 4, y1: 6 });
	});
});

describe('GridIndex', () => {
	it('finds items by region and forgets removed ones', () => {
		const grid = new GridIndex<{ id: string }>(64);
		const a = { id: 'a' };
		const b = { id: 'b' };
		grid.add(a, { x0: 10, y0: 10, x1: 20, y1: 20 });
		grid.add(b, { x0: 300, y0: 300, x1: 400, y1: 310 });
		expect([...grid.query({ x0: 0, y0: 0, x1: 30, y1: 30 })]).toEqual([a]);
		expect([...grid.query({ x0: 350, y0: 0, x1: 360, y1: 1000 })]).toEqual([b]);
		// Same cell, but outside the item's own box
		expect(grid.query({ x0: 40, y0: 40, x1: 50, y1: 50 }).size).toBe(0);
		grid.remove(a);
		expect(grid.query({ x0: 0, y0: 0, x1: 30, y1: 30 }).size).toBe(0);
	});
});
