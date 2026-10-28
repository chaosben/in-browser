import { describe, expect, it } from 'vitest';
import { calloutTail, fitTextToCanvas, moveAnnotation, wrapText } from './overlays';
import { createOverlay } from '#lib/project/defaults.js';
import type { TextAnnotation } from '#lib/project/types.js';

const box = { x: 100, y: 100, w: 200, h: 80 };
/** Signed area in canvas coordinates (positive = same winding as `roundRect`) */
const area = ([a, b, c]: { x: number; y: number }[]) =>
	a.x * b.y - b.x * a.y + (b.x * c.y - c.x * b.y) + (c.x * a.y - a.x * c.y);

describe('calloutTail', () => {
	it('has no pointer when the tip lies within the box', () => {
		expect(calloutTail(box, { x: 150, y: 120 })).toBeNull();
	});
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

describe('wrapText', () => {
	// Every character is 1 wide
	const measure = (s: string) => s.length;
	const texts = (lines: { text: string }[]) => lines.map((l) => l.text);

	it('only splits paragraphs without a width', () => {
		expect(wrapText('a b\nc', measure)).toEqual([
			{ text: 'a b', last: true },
			{ text: 'c', last: true }
		]);
	});
	it('wraps between words and marks paragraph ends', () => {
		expect(wrapText('aa bb cc\n\ndd', measure, 5)).toEqual([
			{ text: 'aa bb', last: false },
			{ text: 'cc', last: true },
			{ text: '', last: true },
			{ text: 'dd', last: true }
		]);
	});
	it('splits words that are too long on their own', () => {
		expect(texts(wrapText('abcdefg hi', measure, 3))).toEqual(['abc', 'def', 'g', 'hi']);
		expect(texts(wrapText('abc', measure, 0.5))).toEqual(['a', 'b', 'c']);
	});
});

describe('fitTextToCanvas', () => {
	const text = (fields: Partial<TextAnnotation>) => ({ ...(createOverlay('text', 0, 3) as TextAnnotation), ...fields });
	/** Fake layout: each character is `size` wide, lines wrap at the fixed width, each line is `size` high */
	const bounds = (a: TextAnnotation) => {
		const perLine = a.boxWidth === undefined ? Infinity : Math.max(Math.floor(a.boxWidth / a.size), 1);
		const lines = a.text.split('\n').reduce((n, p) => n + Math.max(Math.ceil(p.length / perLine), 1), 0);
		const longest = Math.max(...a.text.split('\n').map((p) => p.length));
		return { x: a.x, y: a.y, w: a.boxWidth ?? longest * a.size, h: lines * a.size };
	};
	it('leaves a fitting text alone', () => {
		expect(fitTextToCanvas(text({ text: 'Hello', size: 0.05, x: 0.1, y: 0.1 }), bounds)).toEqual({});
	});
	it('wraps a text wider than the canvas', () => {
		const patch = fitTextToCanvas(text({ text: 'x'.repeat(40), size: 0.05, x: 0, y: 0 }), bounds);
		expect(patch).toEqual({ boxWidth: 1 });
	});
	it('shrinks the font until the text is no taller than the canvas', () => {
		const a = text({ text: Array(40).fill('line').join('\n'), size: 0.05, x: 0, y: 0 });
		const patch = fitTextToCanvas(a, bounds);
		expect(patch.size).toBeLessThan(0.05);
		expect(bounds({ ...a, ...patch }).h).toBeLessThanOrEqual(1);
		expect(bounds({ ...a, ...patch, size: patch.size! * 1.01 }).h).toBeGreaterThan(1);
	});
	it('moves the box inside the canvas', () => {
		expect(fitTextToCanvas(text({ text: 'Hello', size: 0.1, x: 0.8, y: 0.95 }), bounds)).toEqual({ x: 0.5, y: 0.9 });
	});
});
