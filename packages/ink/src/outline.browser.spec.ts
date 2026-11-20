import { describe, expect, it } from 'vitest';
import type { Stroke } from './items.js';
import { diameter, pathOf } from './outline';

// The final shape must be one solid area: no holes where segments meet or overlap (winding), no darker overlaps
// for see-through ink (one fill).

describe('pathOf', () => {
	it('fills a zig-zag with sharp turns and loops as one solid area', () => {
		const pts: number[] = [];
		// Zig-zag, then a tight loop back over itself, pressure going up and down
		for (let i = 0; i <= 20; i++) pts.push(10 + i * 8, i % 2 ? 20 : 60, 0.3 + (i % 5) * 0.15);
		for (let a = 0; a <= 12; a++) pts.push(100 + Math.cos(a) * 15, 40 + Math.sin(a) * 15, 0.5);
		const stroke: Stroke = { id: 's', tool: 'pen', color: '#000000', size: 4, points: new Float32Array(pts) };

		const canvas = new OffscreenCanvas(200, 100);
		const ctx = canvas.getContext('2d')!;
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = '#000000';
		ctx.fill(pathOf(stroke));
		const data = ctx.getImageData(0, 0, 200, 100).data;
		const alphaAt = (x: number, y: number) => data[(Math.round(y) * 200 + Math.round(x)) * 4 + 3];

		// Every point on the line (and the middle of every segment) is covered once: alpha 0.5 (127/128). Where an
		// inner edge of another piece crosses a pixel, anti-aliasing leaves it slightly lighter (~0.9 coverage) –
		// invisible; a hole (winding) would be 0, a double fill ~191.
		for (let i = 0; i < pts.length; i += 3) {
			expect(alphaAt(pts[i], pts[i + 1]), `point ${i / 3} at ${pts[i]},${pts[i + 1]}`).toBeGreaterThanOrEqual(108);
			expect(alphaAt(pts[i], pts[i + 1])).toBeLessThanOrEqual(129);
			if (i >= 3) {
				const mx = (pts[i] + pts[i - 3]) / 2;
				const my = (pts[i + 1] + pts[i - 2]) / 2;
				expect(alphaAt(mx, my), `middle ${i / 3} at ${mx},${my}`).toBeGreaterThanOrEqual(108);
				expect(alphaAt(mx, my)).toBeLessThanOrEqual(129);
			}
		}
	});

	it('is as wide as the pressure says', () => {
		expect(diameter('pen', 2, 0.5)).toBe(2);
		expect(diameter('pen', 2, 1)).toBeCloseTo(3.2);
		expect(diameter('highlighter', 14, 0.1)).toBe(14);
	});
});
