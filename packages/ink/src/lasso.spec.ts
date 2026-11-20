import { describe, expect, it } from 'vitest';
import type { ShapeItem, Stroke } from './items';
import { rotateItem } from './lasso';

describe('rotateItem', () => {
	// A page 100 wide and 200 high
	const stroke: Stroke = { id: 's', tool: 'pen', color: '#000000', size: 1, points: Float32Array.of(10, 20, 0.5, 30, 40, 0.7) };

	it('turns stroke points with the page and keeps their pressure', () => {
		expect([...rotateItem(stroke, 1, 100, 200).points]).toEqual([180, 10, 0.5, 160, 30, 0.7].map(Math.fround));
		expect([...rotateItem(stroke, 2, 100, 200).points]).toEqual([90, 180, 0.5, 70, 160, 0.7].map(Math.fround));
		expect([...rotateItem(stroke, -1, 100, 200).points]).toEqual([20, 90, 0.5, 40, 70, 0.7].map(Math.fround));
		expect(rotateItem(stroke, 4, 100, 200)).toBe(stroke);
	});

	it('four quarter turns give the item back', () => {
		let s = stroke;
		let [w, h] = [100, 200];
		for (let i = 0; i < 4; i++) {
			s = rotateItem(s, 1, w, h);
			[w, h] = [h, w];
		}
		expect([...s.points]).toEqual([...stroke.points]);
	});

	it('keeps boxes of shapes axis-parallel', () => {
		const rect: ShapeItem = { id: 'r', type: 'shape', color: '#000000', size: 1, fit: { kind: 'ellipse', x: 10, y: 20, w: 30, h: 40 } };
		expect(rotateItem(rect, 1, 100, 200).fit).toEqual({ kind: 'ellipse', x: 140, y: 10, w: 40, h: 30 });
		const line: ShapeItem = { ...rect, fit: { kind: 'line', x0: 0, y0: 0, x1: 10, y1: 0, end: true } };
		expect(rotateItem(line, 1, 100, 200).fit).toEqual({ kind: 'line', x0: 200, y0: 0, x1: 200, y1: 10, end: true });
	});
});
