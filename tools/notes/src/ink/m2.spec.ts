import { describe, expect, it } from 'vitest';
import type { Stroke } from '#lib/model/types.js';
import { pointInPolygon, itemsInLasso, transformItem, transformStroke } from './lasso';
import { recognize, shapePoints } from './recognize';
import { eraseFromStroke } from './split';

const stroke = (id: string, pts: number[], size = 2): Stroke => ({ id, tool: 'pen', color: '#000000', size, points: new Float32Array(pts) });
const line = (x0: number, y0: number, x1: number, y1: number, n = 20) => {
	const pts: number[] = [];
	for (let i = 0; i <= n; i++) pts.push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 0.5);
	return pts;
};
/** A hand-drawn loop through corner points, with a little wobble */
function loop(corners: [number, number][], per = 15): Float32Array {
	const pts: number[] = [];
	const all = [...corners, corners[0]];
	for (let c = 1; c < all.length; c++) {
		const [ax, ay] = all[c - 1];
		const [bx, by] = all[c];
		for (let i = 0; i < per; i++) pts.push(ax + ((bx - ax) * i) / per + Math.sin(i) * 0.6, ay + ((by - ay) * i) / per + Math.cos(i) * 0.6, 0.5);
	}
	pts.push(...all[0], 0.5);
	return new Float32Array(pts);
}

describe('lasso', () => {
	const square = [0, 0, 100, 0, 100, 100, 0, 100];
	it('tests points against the loop', () => {
		expect(pointInPolygon(50, 50, square)).toBe(true);
		expect(pointInPolygon(150, 50, square)).toBe(false);
	});
	it('selects strokes with most of their points inside', () => {
		const inside = stroke('in', line(10, 10, 90, 10));
		const half = stroke('half', line(60, 50, 140, 50));
		const out = stroke('out', line(120, 10, 180, 10));
		expect(itemsInLasso([inside, half, out], square).map((s) => s.id)).toEqual(['in']);
	});
	it('selects pictures by their center and moves/scales their box', () => {
		const img = { id: 'p', type: 'image' as const, asset: 'a.png', x: 40, y: 40, w: 100, h: 20 };
		const far = { ...img, id: 'q', x: 120 };
		expect(itemsInLasso([img, far], square).map((s) => s.id)).toEqual(['p']);
		expect(transformItem(img, { dx: 10, dy: 0, scale: 0.5, ox: 40, oy: 40 })).toMatchObject({ x: 50, y: 40, w: 50, h: 10 });
	});
	it('moves and scales strokes, the width along', () => {
		const s = transformStroke(stroke('a', [10, 10, 0.5, 20, 10, 0.7], 2), { dx: 5, dy: 0, scale: 2, ox: 10, oy: 10 });
		expect([...s.points]).toEqual([15, 10, 0.5, 35, 10, expect.closeTo(0.7)]);
		expect(s.size).toBe(4);
	});
});

describe('pixel eraser', () => {
	it('cuts a gap into a line, leaving two pieces', () => {
		const pieces = eraseFromStroke(stroke('a', line(0, 0, 100, 0, 2)), 50, 0, 5)!;
		expect(pieces).toHaveLength(2);
		const end = pieces[0][pieces[0].length - 3];
		const start = pieces[1][0];
		expect(end).toBeLessThan(45);
		expect(end).toBeGreaterThan(40);
		expect(start).toBeGreaterThan(55);
	});
	it('leaves untouched strokes alone and erases fully covered ones', () => {
		expect(eraseFromStroke(stroke('a', line(0, 0, 100, 0)), 50, 30, 5)).toBeNull();
		expect(eraseFromStroke(stroke('b', line(0, 0, 4, 0)), 2, 0, 10)).toEqual([]);
	});
});

describe('shape recognition', () => {
	it('straightens a slightly wobbly line', () => {
		const pts: number[] = [];
		for (let i = 0; i <= 30; i++) pts.push(i * 5, Math.sin(i) * 1.5, 0.5);
		expect(recognize(new Float32Array(pts))).toEqual({ kind: 'line', x0: 0, y0: 0, x1: 150, y1: expect.closeTo(Math.sin(30) * 1.5) });
	});
	it('rejects a curve that is no line', () => {
		const pts: number[] = [];
		for (let i = 0; i <= 30; i++) pts.push(i * 5, Math.sin(i / 5) * 40, 0.5);
		expect(recognize(new Float32Array(pts))).toBeNull();
	});
	it('finds triangles, rectangles and ellipses', () => {
		expect(recognize(loop([[0, 100], [50, 0], [100, 100]]))).toMatchObject({ kind: 'polygon', points: expect.any(Array) });
		expect((recognize(loop([[0, 100], [50, 0], [100, 100]])) as { points: number[] }).points).toHaveLength(6);
		expect(recognize(loop([[0, 0], [120, 0], [120, 80], [0, 80]]))).toMatchObject({ kind: 'polygon', points: [expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number)] });
		const circle: number[] = [];
		for (let a = 0; a <= 64; a++) circle.push(50 + Math.cos((a / 64) * Math.PI * 2) * 40, 50 + Math.sin((a / 64) * Math.PI * 2) * 40, 0.5);
		expect(recognize(new Float32Array(circle))).toMatchObject({ kind: 'ellipse', w: expect.closeTo(80, 0), h: expect.closeTo(80, 0) });
	});
	it('samples shapes densely', () => {
		const pts = shapePoints({ kind: 'line', x0: 0, y0: 0, x1: 100, y1: 0 });
		expect(pts.length / 3).toBeGreaterThan(20);
		expect(pts[pts.length - 3]).toBe(100);
	});
});
