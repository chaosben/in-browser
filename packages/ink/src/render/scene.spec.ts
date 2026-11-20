import { describe, expect, it } from 'vitest';
import type { Stroke } from '../items';
import { inkKit } from './ink-kit';
import { PageScene } from './scene';

const stroke = (id: string, x: number): Stroke => ({ id, tool: 'pen', color: '#000000', size: 2, points: new Float32Array([x, 10, 0.5, x + 5, 12, 0.5]) });
const all = { x0: 0, y0: 0, x1: 1000, y1: 1000 };

describe('PageScene', () => {
	it('keeps the draw order when undo puts a stroke back in its place', () => {
		const [a, b, c] = [stroke('a', 10), stroke('b', 12), stroke('c', 14)];
		const scene = new PageScene(inkKit, [a, b, c]);
		const at = scene.remove(b);
		expect(scene.itemsIn(all).map((s) => s.id)).toEqual(['a', 'c']);
		scene.add(b, at);
		expect(scene.items.map((s) => s.id)).toEqual(['a', 'b', 'c']);
		expect(scene.itemsIn(all).map((s) => s.id)).toEqual(['a', 'b', 'c']);
		scene.add(stroke('d', 16));
		expect(scene.itemsIn(all).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
	});
	it('finds strokes only near a region', () => {
		const scene = new PageScene(inkKit, [stroke('near', 10), stroke('far', 500)]);
		expect(scene.itemsIn({ x0: 0, y0: 0, x1: 30, y1: 30 }).map((s) => s.id)).toEqual(['near']);
	});
});
