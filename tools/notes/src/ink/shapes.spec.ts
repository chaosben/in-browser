import { describe, expect, it } from 'vitest';
import { recognize } from './recognize';
import { fitFromDrag, SHAPE_KINDS, shapePoints } from './shapes';

/** Bounds of a point list (x, y, pressure) */
function bounds(pts: Float32Array) {
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (let i = 0; i < pts.length; i += 3) {
		x0 = Math.min(x0, pts[i]);
		x1 = Math.max(x1, pts[i]);
		y0 = Math.min(y0, pts[i + 1]);
		y1 = Math.max(y1, pts[i + 1]);
	}
	return { x0, y0, x1, y1 };
}

/** A hand-drawn polyline through points (x, y), with a little wobble */
function hand(path: [number, number][], per = 12): Float32Array {
	const pts: number[] = [];
	for (let c = 1; c < path.length; c++) {
		const [ax, ay] = path[c - 1];
		const [bx, by] = path[c];
		for (let i = 0; i < per; i++) pts.push(ax + ((bx - ax) * i) / per + Math.sin(i) * 0.5, ay + ((by - ay) * i) / per + Math.cos(i) * 0.5, 0.5);
	}
	pts.push(...path[path.length - 1], 0.5);
	return new Float32Array(pts);
}

describe('shape tool', () => {
	it('fills the dragged box with every box shape, whichever way it is dragged', () => {
		for (const kind of SHAPE_KINDS.filter((k) => k !== 'line' && k !== 'arrow' && k !== 'doubleArrow')) {
			for (const [x0, y0, x1, y1] of [
				[10, 20, 110, 80],
				[110, 80, 10, 20]
			]) {
				const b = bounds(shapePoints(fitFromDrag(kind, x0, y0, x1, y1)));
				expect([b.x0, b.y0, b.x1, b.y1].map((v) => Math.round(v)), kind).toEqual([10, 20, 110, 80]);
			}
		}
	});
	it('closes polygons and gives them their corners', () => {
		const corners = { rect: 4, triangle: 3, diamond: 4, parallelogram: 4, pentagon: 5, hexagon: 6, star: 10 } as const;
		for (const [kind, n] of Object.entries(corners)) {
			const fit = fitFromDrag(kind as keyof typeof corners, 0, 0, 100, 60);
			expect(fit.kind === 'polygon' && fit.points.length / 2, kind).toBe(n);
			const pts = shapePoints(fit);
			expect([pts[pts.length - 3], pts[pts.length - 2]]).toEqual([pts[0], pts[1]]);
		}
	});
	it('makes nearly square boxes square', () => {
		expect(fitFromDrag('ellipse', 0, 0, 100, 95)).toEqual({ kind: 'ellipse', x: 0, y: 0, w: 100, h: 100 });
		expect(fitFromDrag('ellipse', 100, 100, 5, 0)).toEqual({ kind: 'ellipse', x: 0, y: 0, w: 100, h: 100 });
		expect(fitFromDrag('ellipse', 0, 0, 100, 60)).toEqual({ kind: 'ellipse', x: 0, y: 0, w: 100, h: 60 });
	});
	it('snaps lines and arrows to 15° steps', () => {
		const fit = fitFromDrag('line', 0, 0, 100, 3);
		expect(fit).toMatchObject({ x1: expect.closeTo(Math.hypot(100, 3)), y1: expect.closeTo(0) });
		const steep = fitFromDrag('arrow', 0, 0, 50, 50 * Math.tan((47 * Math.PI) / 180));
		expect(steep.kind === 'arrow' && Math.atan2(steep.y1, steep.x1)).toBeCloseTo(Math.PI / 4);
		expect(fitFromDrag('line', 0, 0, 100, 40)).toEqual({ kind: 'line', x0: 0, y0: 0, x1: 100, y1: 40 });
	});
	it('draws arrowheads through the tip, sized by the pen and the length', () => {
		const fit = fitFromDrag('arrow', 0, 0, 200, 0);
		const thin = bounds(shapePoints(fit, 1));
		const thick = bounds(shapePoints(fit, 7));
		expect(thin.x1).toBe(200);
		expect(thick.y1 - thick.y0).toBeGreaterThan(thin.y1 - thin.y0);
		// Short arrows: the head takes at most 60 % of the length
		const short = bounds(shapePoints(fitFromDrag('arrow', 0, 0, 10, 0), 7));
		expect(short.x0).toBe(0);
		const both = bounds(shapePoints(fitFromDrag('doubleArrow', 0, 0, 200, 0), 1));
		expect([both.x0, both.x1]).toEqual([0, 200]);
		expect(both.y1).toBeGreaterThan(2);
	});
});

describe('arrow recognition', () => {
	it('recognizes a shaft with a V through the tip', () => {
		const fit = recognize(hand([[0, 0], [150, 0], [130, -12], [150, 0], [130, 12]]));
		expect(fit).toMatchObject({ kind: 'arrow', double: false, x1: expect.closeTo(150, -1), y1: expect.closeTo(0, -1) });
	});
	it('recognizes a shaft with one hook', () => {
		expect(recognize(hand([[0, 100], [100, 0], [80, 3]]))).toMatchObject({ kind: 'arrow' });
	});
	it('leaves corners, check marks and lines alone', () => {
		// A right angle is no arrowhead
		expect(recognize(hand([[0, 0], [150, 0], [150, 40]]))?.kind).not.toBe('arrow');
		// Check mark: short first stroke
		expect(recognize(hand([[0, 40], [30, 70], [120, 0]]))?.kind).not.toBe('arrow');
		expect(recognize(hand([[0, 0], [150, 0]]))?.kind).toBe('line');
	});
});
