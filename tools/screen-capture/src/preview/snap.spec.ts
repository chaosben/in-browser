import { describe, expect, it } from 'vitest';
import { snapAspect, snapMove, snapPoint, snapSpacing, snapTargets, type SnapLine } from './snap';

const tol = { x: 0.01, y: 0.01 };

describe('snapTargets', () => {
	it('has the canvas edges and center plus edges and centers of the items', () => {
		const t = snapTargets([{ x: 0.2, y: 0.1, w: 0.2, h: 0.4 }]);
		const round = (ls: SnapLine[]) => ls.map((l) => Math.round(l.at * 1000) / 1000);
		expect(round(t.xs)).toEqual([0, 0.5, 1, 0.2, 0.3, 0.4]);
		expect(round(t.ys)).toEqual([0, 0.5, 1, 0.1, 0.3, 0.5]);
		expect(t.xs.map((l) => l.box)).toEqual([null, null, null, 0, 0, 0]);
	});
});

describe('snapMove', () => {
	const targets = snapTargets([{ x: 0.6, y: 0.6, w: 0.2, h: 0.2 }]);
	it('centers a box on the canvas center', () => {
		const s = snapMove({ x: 0.371, y: 0.2, w: 0.25, h: 0.1 }, targets, tol);
		expect(s.dx).toBeCloseTo(0.004);
		expect(s.guides).toMatchObject({ x: { at: 0.5, box: null }, y: null });
	});
	it('snaps an edge to the edge of another item, the closest line wins', () => {
		const s = snapMove({ x: 0.1, y: 0.795, w: 0.2, h: 0.1 }, targets, tol);
		expect(s.dy).toBeCloseTo(0.005);
		expect(s.guides.y?.at).toBeCloseTo(0.8);
		expect(s.guides.y?.box).toBe(0);
	});
	it('tells an item center close to the canvas center from it; on a tie the canvas wins', () => {
		// Only the centers are in reach: the item's at 0.51, the canvas center 0.015 away
		const near = snapTargets([{ x: 0.3, y: 0, w: 0.42, h: 0.1 }]);
		const s = snapMove({ x: 0.415, y: 0.3, w: 0.2, h: 0.1 }, near, tol);
		expect(s.guides.x?.box).toBe(0);
		expect(s.guides.x?.at).toBeCloseTo(0.51);
		const same = snapTargets([{ x: 0.3, y: 0, w: 0.4, h: 0.1 }]);
		expect(snapMove({ x: 0.405, y: 0.3, w: 0.2, h: 0.1 }, same, tol).guides.x).toEqual({ at: 0.5, box: null });
	});
	it('leaves a box alone without lines in reach', () => {
		expect(snapMove({ x: 0.13, y: 0.13, w: 0.1, h: 0.1 }, targets, tol)).toEqual({ dx: 0, dy: 0, guides: { x: null, y: null, gaps: [] } });
	});
});

describe('snapPoint', () => {
	it('snaps each axis on its own', () => {
		const s = snapPoint({ x: 0.505, y: 0.3 }, snapTargets([]), tol);
		expect(s.point).toEqual({ x: 0.5, y: 0.3 });
		expect(s.guides).toEqual({ x: { at: 0.5, box: null }, y: null, gaps: [] });
	});
});

describe('snapAspect', () => {
	it('snaps the closer moved edge, the other follows the aspect ratio', () => {
		// Dragged at the bottom-right corner, right edge close to the canvas center
		const s = snapAspect({ x: 0.1, y: 0.1, w: 0.395, h: 0.2 }, 1, 1, snapTargets([]), tol, 0.01);
		expect(s.rect.x).toBe(0.1);
		expect(s.rect.w).toBeCloseTo(0.4);
		expect(s.rect.h / s.rect.w).toBeCloseTo(0.2 / 0.395);
		expect(s.guides).toMatchObject({ x: { at: 0.5, box: null }, y: null });
	});
	it('keeps the opposite corner when dragged at the top left', () => {
		const s = snapAspect({ x: 0.003, y: 0.3, w: 0.497, h: 0.4 }, -1, -1, snapTargets([]), tol, 0.01);
		expect(s.rect.x).toBeCloseTo(0);
		expect(s.rect.x + s.rect.w).toBeCloseTo(0.5);
		expect(s.rect.y + s.rect.h).toBeCloseTo(0.7);
	});
});

describe('snapSpacing', () => {
	// Two boxes in a row, 0.1 apart
	const row = [
		{ x: 0.1, y: 0.4, w: 0.1, h: 0.1 },
		{ x: 0.3, y: 0.4, w: 0.1, h: 0.1 }
	];
	it('repeats the gap of the row after the last item', () => {
		const s = snapSpacing({ x: 0.505, y: 0.42, w: 0.1, h: 0.1 }, row, 'x', 0.01);
		expect(s?.offset).toBeCloseTo(-0.005);
		expect(s?.gaps.map((g) => [g.from, g.to].map((v) => Math.round(v * 1000) / 1000))).toEqual([
			[0.2, 0.3],
			[0.4, 0.5]
		]);
	});
	it('centers between the neighbors before and after', () => {
		// Room from 0.2 to 0.85: centered at 0.425 with gaps of 0.225 on both sides
		const s = snapSpacing({ x: 0.43, y: 0.4, w: 0.2, h: 0.1 }, [row[0], { x: 0.85, y: 0.4, w: 0.1, h: 0.1 }], 'x', 0.02);
		expect(s?.offset).toBeCloseTo(-0.005);
		expect(s?.gaps).toHaveLength(2);
	});
	it('ignores items in another row and boxes out of reach', () => {
		expect(snapSpacing({ x: 0.505, y: 0.8, w: 0.1, h: 0.1 }, row, 'x', 0.01)).toBeNull();
		expect(snapSpacing({ x: 0.55, y: 0.4, w: 0.1, h: 0.1 }, row, 'x', 0.01)).toBeNull();
	});
	it('wins over a farther line in snapMove', () => {
		// Row 0.05–0.15 and 0.25–0.35: equal spacing at x = 0.45 is 0.003 away, the canvas center (box center
		// 0.513) 0.013
		const targets = snapTargets(row.map((b) => ({ ...b, x: b.x - 0.05 })));
		const s = snapMove({ x: 0.453, y: 0.42, w: 0.12, h: 0.1 }, targets, { x: 0.02, y: 0.001 });
		expect(s.dx).toBeCloseTo(-0.003);
		expect(s.guides.x).toBeNull();
		expect(s.guides.gaps).toHaveLength(2);
	});
});
