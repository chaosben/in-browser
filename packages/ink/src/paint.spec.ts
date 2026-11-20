import { describe, expect, it } from 'vitest';
import type { ShapeItem, Stroke } from './items';
import { diameter } from './outline';
import { paintOf } from './paint';

describe('paintOf', () => {
	it('starts a line with a dot and starts a new run where the width changes', () => {
		const stroke: Stroke = { id: 's', tool: 'pen', color: '#112233', size: 2, points: new Float32Array([0, 0, 0.5, 10, 0, 0.5, 20, 0, 1, 30, 0, 1]) };
		const [line] = paintOf(stroke);
		expect(line.kind).toBe('line');
		if (line.kind !== 'line') return;
		expect(line.highlighter).toBe(false);
		expect(line.runs.map((r) => r.points)).toEqual([
			[0, 0, 0, 0, 10, 0],
			[10, 0, 20, 0, 30, 0]
		]);
		expect(line.runs[0].width).toBe(Math.round(diameter('pen', 2, 0.5) * 100) / 100);
		expect(line.runs[1].width).toBe(Math.round(diameter('pen', 2, 1) * 100) / 100);
	});

	it('puts the fill of a shape under its lines, with its opacity', () => {
		const shape: ShapeItem = { id: 'r', type: 'shape', fit: { kind: 'polygon', points: [0, 0, 40, 0, 40, 20, 0, 20] }, color: '#000000', size: 1, fill: '#ff000080' };
		const paint = paintOf(shape);
		expect(paint[0]).toMatchObject({ kind: 'fill', color: '#ff0000', alpha: 0.5 });
		expect(paint.slice(1).every((p) => p.kind === 'line')).toBe(true);
	});

	it('marks highlighter lines', () => {
		const stroke: Stroke = { id: 'h', tool: 'highlighter', color: '#ffff00', size: 14, points: new Float32Array([0, 0, 0.5, 10, 0, 0.5]) };
		expect(paintOf(stroke)[0]).toMatchObject({ kind: 'line', highlighter: true });
	});
});
