import { describe, expect, it } from 'vitest';
import { calloutTail, moveAnnotation, textBox } from './overlays';
import type { Ctx2D } from './compositor';
import { createOverlay } from '#lib/project/defaults.js';
import type { TextAnnotation } from '#lib/project/types.js';

const box = { x: 100, y: 100, w: 200, h: 80 };
/** Signed area in canvas coordinates (positive = same winding as `roundRect`) */
const area = ([a, b, c]: { x: number; y: number }[]) =>
	a.x * b.y - b.x * a.y + (b.x * c.y - c.x * b.y) + (c.x * a.y - a.x * c.y);

describe('calloutTail', () => {
	it('points to the tip with the winding of the box, in every direction', () => {
		for (const tip of [
			{ x: 0, y: 0 },
			{ x: 400, y: 0 },
			{ x: 400, y: 300 },
			{ x: 0, y: 300 },
			{ x: 200, y: 400 }
		]) {
			const tail = calloutTail(box, tip)!;
			expect(tail[1]).toEqual(tip);
			expect(area(tail)).toBeGreaterThan(0);
		}
	});
});

describe('moveAnnotation', () => {
	const by = (p: { x: number; y: number }, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy });
	it('moves points, positions and areas, the speech bubble with its pointer', () => {
		const arrow = createOverlay('arrow', 0, 1);
		if (arrow.kind !== 'arrow') throw new Error();
		expect(moveAnnotation(arrow, 0.1, 0.2)).toEqual({ from: by(arrow.from, 0.1, 0.2), to: by(arrow.to, 0.1, 0.2) });
		const callout = createOverlay('callout', 0, 1);
		if (callout.kind !== 'callout') throw new Error();
		expect(moveAnnotation(callout, 0.1, 0)).toEqual({ x: callout.x + 0.1, y: callout.y, tip: by(callout.tip, 0.1, 0) });
		const rect = createOverlay('rect', 0, 1);
		if (rect.kind !== 'rect') throw new Error();
		expect(moveAnnotation(rect, -0.05, 0)).toEqual({ rect: { ...rect.rect, x: rect.rect.x - 0.05 } });
	});
});

describe('textBox', () => {
	const text = (fields: Partial<TextAnnotation>) => ({
		...(createOverlay('text', 0, 3) as TextAnnotation),
		x: 0,
		y: 0,
		size: 0.01,
		padding: 0.005,
		background: '#000000',
		...fields
	});
	/** Fake layout on a 1000 × 1000 canvas: each character is 10 wide; an "f" reaches 3 left at the start, 4 right at the end */
	const ctx = {
		measureText: (s: string) => ({
			width: s.length * 10,
			actualBoundingBoxLeft: s.startsWith('f') ? 3 : 0,
			actualBoundingBoxRight: s.length * 10 + (s.endsWith('f') ? 4 : 0)
		})
	} as unknown as Ctx2D;
	it('widens the box by glyphs reaching past the line', () => {
		const b = textBox(ctx, text({ text: 'fab\nabf' }), 1000, 1000);
		expect(b).toMatchObject({ w: 30 + 3 + 4 + 10, textX: 8 });
	});
	it('keeps the overhang inside a fixed width', () => {
		const b = textBox(ctx, text({ text: 'fa fa fa', boxWidth: 0.07 }), 1000, 1000);
		expect(b.w).toBe(70);
		// Every line with its overhang inside the box less its padding
		for (const line of b.lines) expect(b.textX + line.width + 4).toBeLessThanOrEqual(b.w - 5);
	});
});
