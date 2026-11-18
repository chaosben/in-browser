import { describe, expect, it } from 'vitest';
import { snapMove, snapPoint } from '@in-browser/graphics/snap.js';
import type { Item, ShapeItem } from '#lib/model/types.js';
import { pageTargets, snapBox, toMm, unionBox } from './align';
import { fitFromDrag, moveHandle } from './shapes';

const shape = (id: string, x0: number, y0: number, x1: number, y1: number): ShapeItem => ({ id, type: 'shape', fit: fitFromDrag('rect', x0, y0, x1, y1), color: '#000000', size: 4 });
const stroke: Item = { id: 's', tool: 'pen', color: '#000000', size: 2, points: new Float32Array([10, 10, 0.5, 30, 50, 0.5]) };
const tol = { x: 3, y: 3 };

describe('snapping on a page', () => {
	it('lines up by the geometry, without the pen width', () => {
		expect(snapBox(shape('a', 10, 20, 110, 70))).toEqual({ x: 10, y: 20, w: 100, h: 50 });
		expect(snapBox(stroke)).toEqual({ x: 10, y: 10, w: 20, h: 40 });
		expect(unionBox([{ x: 0, y: 5, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 }])).toEqual({ x: 0, y: 0, w: 25, h: 15 });
	});
	it('snaps to the page and to shapes and pictures, never to handwriting or itself', () => {
		const items = [shape('a', 100, 100, 200, 150), shape('me', 0, 0, 10, 10), stroke];
		const targets = pageTargets(items, new Set(['me']), 600, 800);
		expect(targets.boxes).toEqual([{ x: 100, y: 100, w: 100, h: 50 }]);
		// Page center
		expect(snapPoint({ x: 298, y: 401 }, targets, tol).point).toEqual({ x: 300, y: 400 });
		// Next to the other shape's right edge, its top edge lined up
		const moved = snapMove({ x: 202, y: 98, w: 50, h: 50 }, targets, tol);
		expect([moved.dx, moved.dy]).toEqual([-2, 2]);
		expect(snapPoint({ x: 30, y: 12 }, targets, tol).guides).toMatchObject({ x: null, y: null });
	});
	it('can leave lines at any angle', () => {
		const line = fitFromDrag('line', 0, 0, 100, 3, false);
		expect(line).toMatchObject({ x1: 100, y1: 3 });
		expect(moveHandle(line, 1, 100, 4, false)).toMatchObject({ x1: 100, y1: 4 });
		expect(moveHandle(line, 1, 100, 4)).toMatchObject({ y1: expect.closeTo(0, 5) });
	});
	it('labels gaps in millimeters', () => {
		expect(toMm(72)).toBe(25);
	});
});
