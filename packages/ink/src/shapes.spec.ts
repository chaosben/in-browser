import { describe, expect, it } from 'vitest';
import { transformItem } from './lasso';
import { recognize, shapeName, suggestShape } from './recognize';
import { dashes, fillOutline, fitFromDrag, handlesOf, inkStrokes, moveHandle, parseFit, SHAPE_KINDS, shapePoints, transformFit, withHeads, withStyle, type ShapeFit } from './shapes';
import type { ShapeItem } from './items.js';

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
		expect(steep.kind === 'line' && Math.atan2(steep.y1, steep.x1)).toBeCloseTo(Math.PI / 4);
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

const isArrow = (fit: ShapeFit | null) => fit?.kind === 'line' && !!fit.end;

describe('arrow recognition', () => {
	it('recognizes a shaft with a V through the tip', () => {
		const fit = recognize(hand([[0, 0], [150, 0], [130, -12], [150, 0], [130, 12]]));
		expect(fit).toMatchObject({ kind: 'line', end: true, x1: expect.closeTo(150, -1), y1: expect.closeTo(0, -1) });
		expect(fit).not.toHaveProperty('start');
	});
	it('recognizes a shaft with one hook', () => {
		expect(recognize(hand([[0, 100], [100, 0], [80, 3]]))).toMatchObject({ kind: 'line', end: true });
	});
	it('leaves corners, check marks and lines alone', () => {
		// A right angle is no arrowhead
		expect(isArrow(recognize(hand([[0, 0], [150, 0], [150, 40]])))).toBe(false);
		// Check mark: short first stroke
		expect(isArrow(recognize(hand([[0, 40], [30, 70], [120, 0]])))).toBe(false);
		expect(recognize(hand([[0, 0], [150, 0]]))?.kind).toBe('line');
	});
});

describe('editing shapes', () => {
	it('offers the ends of lines, the corners of polygons and boxes as handles', () => {
		expect(handlesOf({ kind: 'line', x0: 0, y0: 0, x1: 100, y1: 50, end: true })).toEqual([
			[0, 0],
			[100, 50]
		]);
		expect(handlesOf(fitFromDrag('triangle', 0, 0, 100, 60))).toHaveLength(3);
		expect(handlesOf(fitFromDrag('ellipse', 0, 0, 100, 60))).toEqual([
			[0, 0],
			[100, 0],
			[100, 60],
			[0, 60]
		]);
	});
	it('re-aims an arrow by its tip, snapping to 15° steps', () => {
		const arrow: ShapeFit = { kind: 'line', x0: 0, y0: 0, x1: 100, y1: 0, end: true };
		expect(moveHandle(arrow, 1, 0, 80)).toMatchObject({ x0: 0, y0: 0, x1: expect.closeTo(0, 5), y1: 80 });
		expect(moveHandle(arrow, 1, 70, 30)).toEqual({ ...arrow, x1: 70, y1: 30 });
		expect(moveHandle(arrow, 0, -20, 1)).toMatchObject({ x0: expect.closeTo(-20, 1), y0: expect.closeTo(0, 5), x1: 100, y1: 0 });
	});
	it('moves one corner of a polygon', () => {
		const fit = moveHandle({ kind: 'polygon', points: [0, 0, 10, 0, 10, 10] }, 2, 30, 40);
		expect(fit).toEqual({ kind: 'polygon', points: [0, 0, 10, 0, 30, 40] });
	});
	it('resizes boxes from a corner, the opposite one staying, also past it', () => {
		const box: ShapeFit = { kind: 'roundedRect', x: 10, y: 10, w: 100, h: 50 };
		expect(moveHandle(box, 2, 150, 100)).toEqual({ kind: 'roundedRect', x: 10, y: 10, w: 140, h: 90 });
		expect(moveHandle(box, 0, 200, 0)).toEqual({ kind: 'roundedRect', x: 110, y: 0, w: 90, h: 60 });
	});
	it('moves and scales shapes with the selection, the pen width along', () => {
		const t = { dx: 5, dy: 10, scale: 2, ox: 0, oy: 0 };
		expect(transformFit({ kind: 'line', x0: 1, y0: 2, x1: 3, y1: 4 }, t)).toEqual({ kind: 'line', x0: 7, y0: 14, x1: 11, y1: 18 });
		expect(transformFit({ kind: 'ellipse', x: 1, y: 1, w: 10, h: 5 }, t)).toEqual({ kind: 'ellipse', x: 7, y: 12, w: 20, h: 10 });
		const shape: ShapeItem = { id: 's', type: 'shape', fit: { kind: 'polygon', points: [0, 0, 1, 0, 1, 1] }, color: '#000000', size: 2 };
		expect(transformItem(shape, t)).toEqual({ ...shape, fit: { kind: 'polygon', points: [5, 10, 7, 10, 7, 12] }, size: 4 });
	});
	it('draws a shape as a pen stroke along its outline, computed once', () => {
		const shape: ShapeItem = { id: 's', type: 'shape', fit: fitFromDrag('roundedRect', 0, 0, 100, 60), color: '#ff0000', size: 3 };
		const ink = inkStrokes(shape);
		expect(ink).toHaveLength(1);
		expect(ink[0]).toMatchObject({ id: 's', tool: 'pen', color: '#ff0000', size: 3 });
		expect(ink[0].points).toEqual(shapePoints(shape.fit, 3));
		expect(inkStrokes(shape)).toBe(ink);
	});
	it('draws arrowheads as strokes of their own, at the chosen ends', () => {
		const line = (fit: ShapeFit): ShapeItem => ({ id: 'a', type: 'shape', fit, color: '#000000', size: 2 });
		const plain = fitFromDrag('line', 0, 0, 200, 0);
		expect(inkStrokes(line(plain))).toHaveLength(1);
		expect(plain.kind === 'line' && inkStrokes(line(withHeads(plain, true, true)))).toHaveLength(3);
		const [, head] = inkStrokes(line(fitFromDrag('arrow', 0, 0, 200, 0)));
		const b = bounds(head.points);
		expect(b.x1).toBe(200);
		expect(b.x0).toBeGreaterThan(150);
	});
	it('cuts lines into dashes and dots along their length', () => {
		const pieces = dashes([0, 0, 50, 0, 50, 50], 10, 5);
		expect(pieces[0]).toEqual([0, 0, 10, 0]);
		expect(pieces[1]).toEqual([15, 0, 25, 0]);
		// Around the corner: a dash goes on in the next segment
		expect(pieces[3]).toEqual([45, 0, 50, 0, 50, 5]);
		const dots = dashes([0, 0, 20, 0], 0, 5);
		expect(dots).toEqual([0, 5, 10, 15, 20].map((x) => [x, 0, x, 0]));
		const dashed: ShapeItem = { id: 'd', type: 'shape', fit: fitFromDrag('rect', 0, 0, 100, 100), color: '#000000', size: 2, dash: 'dashed' };
		expect(inkStrokes(dashed).length).toBeGreaterThan(20);
	});
	it('draws hand-drawn shapes the same way every time, one stroke per edge', () => {
		const shape: ShapeItem = { id: 'h', type: 'shape', fit: fitFromDrag('triangle', 0, 0, 100, 80), color: '#000000', size: 2, sketch: true };
		const edges = inkStrokes(shape);
		expect(edges).toHaveLength(3);
		expect(inkStrokes({ ...shape }).map((s) => [...s.points])).toEqual(edges.map((s) => [...s.points]));
	});
	it('fills closed shapes only, and keeps only styles that differ from plain', () => {
		const rect: ShapeItem = { id: 'r', type: 'shape', fit: fitFromDrag('rect', 0, 0, 10, 20), color: '#000000', size: 2 };
		expect(fillOutline(rect)).toBeNull();
		const filled = withStyle(rect, { fill: '#ff000080', dash: 'dotted' });
		expect(filled).toEqual({ ...rect, fill: '#ff000080', dash: 'dotted' });
		expect(fillOutline(filled)).toEqual([0, 0, 10, 0, 10, 20, 0, 20, 0, 0]);
		expect(withStyle(filled, { fill: null, dash: 'solid' })).toEqual(rect);
		const line: ShapeItem = { ...rect, fit: fitFromDrag('line', 0, 0, 10, 0) };
		expect(withStyle(line, { fill: '#ff000080' })).toEqual(line);
	});
	it('reads only valid shapes', () => {
		expect(parseFit({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: '2' })).toBeNull();
		expect(parseFit({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: 2, start: true, end: 'yes' })).toEqual({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: 2, start: true });
		// The first arrows (kind `arrow`) become lines with arrowheads
		expect(parseFit({ kind: 'arrow', x0: 0, y0: 0, x1: 1, y1: 2, double: true })).toEqual({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: 2, start: true, end: true });
		expect(parseFit({ kind: 'polygon', points: [0, 0, 1, 1, 2] })).toBeNull();
		expect(parseFit(null)).toBeNull();
	});
});

describe('shape suggestion', () => {
	const arrow = () => hand([[0, 100], [150, 0], [120, 0], [150, 0], [140, 28]]);
	it('suggests shapes for large strokes only, not for handwriting', () => {
		expect(suggestShape(arrow(), 1)).toMatchObject({ kind: 'line', end: true });
		// The same stroke written small …
		const small = arrow().map((v, i) => (i % 3 === 2 ? v : v / 8));
		expect(suggestShape(small, 1)).toBeNull();
		// … or large on the page, but zoomed far out
		expect(suggestShape(arrow(), 0.3)).toBeNull();
	});
	it('names what it suggests', () => {
		expect(shapeName({ kind: 'polygon', points: [0, 0, 10, 0, 10, 5, 0, 5] })).toBe('rectangle');
		expect(shapeName({ kind: 'polygon', points: [0, 0, 10, 2, 10, 5, 0, 5] })).toBe('quadrilateral');
		expect(shapeName({ kind: 'polygon', points: [0, 0, 10, 0, 5, 5] })).toBe('triangle');
		expect(shapeName({ kind: 'ellipse', x: 0, y: 0, w: 10, h: 10 })).toBe('circle');
		expect(shapeName({ kind: 'ellipse', x: 0, y: 0, w: 10, h: 6 })).toBe('ellipse');
		expect(shapeName({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: 1, end: true })).toBe('arrow');
		expect(shapeName({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: 1 })).toBe('line');
	});
});
