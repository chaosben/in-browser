import { describe, expect, it } from 'vitest';
import { snapAspect, snapMove, snapPoint, snapTargets } from './snap';

const tol = { x: 0.01, y: 0.01 };

describe('snapTargets', () => {
	it('has the canvas edges and center plus edges and centers of the items', () => {
		const t = snapTargets([{ x: 0.2, y: 0.1, w: 0.2, h: 0.4 }]);
		const round = (vs: number[]) => vs.map((v) => Math.round(v * 1000) / 1000);
		expect(round(t.xs)).toEqual([0, 0.5, 1, 0.2, 0.3, 0.4]);
		expect(round(t.ys)).toEqual([0, 0.5, 1, 0.1, 0.3, 0.5]);
	});
});

describe('snapMove', () => {
	const targets = snapTargets([{ x: 0.6, y: 0.6, w: 0.2, h: 0.2 }]);
	it('centers a box on the canvas center', () => {
		const s = snapMove({ x: 0.371, y: 0.2, w: 0.25, h: 0.1 }, targets, tol);
		expect(s.dx).toBeCloseTo(0.004);
		expect(s.guides).toEqual({ x: 0.5, y: null });
	});
	it('snaps an edge to the edge of another item, the closest line wins', () => {
		const s = snapMove({ x: 0.1, y: 0.795, w: 0.2, h: 0.1 }, targets, tol);
		expect(s.dy).toBeCloseTo(0.005);
		expect(s.guides.y).toBeCloseTo(0.8);
	});
	it('leaves a box alone without lines in reach', () => {
		expect(snapMove({ x: 0.13, y: 0.13, w: 0.1, h: 0.1 }, targets, tol)).toEqual({ dx: 0, dy: 0, guides: { x: null, y: null } });
	});
});

describe('snapPoint', () => {
	it('snaps each axis on its own', () => {
		const s = snapPoint({ x: 0.505, y: 0.3 }, snapTargets([]), tol);
		expect(s.point).toEqual({ x: 0.5, y: 0.3 });
		expect(s.guides).toEqual({ x: 0.5, y: null });
	});
});

describe('snapAspect', () => {
	it('snaps the closer moved edge, the other follows the aspect ratio', () => {
		// Dragged at the bottom-right corner, right edge close to the canvas center
		const s = snapAspect({ x: 0.1, y: 0.1, w: 0.395, h: 0.2 }, 1, 1, snapTargets([]), tol, 0.01);
		expect(s.rect.x).toBe(0.1);
		expect(s.rect.w).toBeCloseTo(0.4);
		expect(s.rect.h / s.rect.w).toBeCloseTo(0.2 / 0.395);
		expect(s.guides).toEqual({ x: 0.5, y: null });
	});
	it('keeps the opposite corner when dragged at the top left', () => {
		const s = snapAspect({ x: 0.003, y: 0.3, w: 0.497, h: 0.4 }, -1, -1, snapTargets([]), tol, 0.01);
		expect(s.rect.x).toBeCloseTo(0);
		expect(s.rect.x + s.rect.w).toBeCloseTo(0.5);
		expect(s.rect.y + s.rect.h).toBeCloseTo(0.7);
	});
});
