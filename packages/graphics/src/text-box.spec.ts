import { describe, expect, it } from 'vitest';
import { handlePoint, resizeTextBox, sizingAfter, textBoxSize, widestLine, wrapText } from './text-box.js';

// One unit per character
const measure = (s: string) => s.length;
const texts = (text: string, max?: number) => wrapText(text, measure, max).map((l) => l.text);

describe('wrapText', () => {
	it('breaks only at Enter without a width', () => {
		expect(wrapText('ab cd\nef', measure)).toEqual([
			{ text: 'ab cd', last: true },
			{ text: 'ef', last: true }
		]);
	});

	it('wraps between words, trailing spaces not counting, and marks paragraph ends', () => {
		expect(texts('aa bb cc', 5)).toEqual(['aa bb', 'cc']);
		expect(wrapText('aa bb cc', measure, 5).map((l) => l.last)).toEqual([false, true]);
		// Spaces inside a line stay (as in a text field)
		expect(texts('a  b', 10)).toEqual(['a  b']);
	});

	it('splits a word too long for a line between characters', () => {
		expect(texts('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
		expect(texts('x abcdefg', 3)).toEqual(['x', 'abc', 'def', 'g']);
	});

	it('keeps empty paragraphs', () => {
		expect(texts('a\n\nb', 5)).toEqual(['a', '', 'b']);
	});

	it('measures the widest line', () => {
		expect(widestLine(wrapText('ab\nabcd', measure), measure)).toBe(4);
	});
});

describe('textBoxSize', () => {
	const box = { w: 100, h: 50 };
	const content = { w: 30, h: 80 };
	it('takes the content, its height, or the box by sizing', () => {
		expect(textBoxSize('auto-width', box, content)).toEqual(content);
		expect(textBoxSize('auto-height', box, content)).toEqual({ w: 100, h: 80 });
		expect(textBoxSize('fixed', box, content)).toEqual(box);
	});
});

describe('resizeTextBox', () => {
	const start = { x: 10, y: 20, w: 100, h: 40 };

	it('left/right set the width; auto width becomes auto height, fixed stays fixed', () => {
		expect(resizeTextBox(start, 'auto-width', 'e', 30, 99)).toEqual({ rect: { x: 10, y: 20, w: 130, h: 40 }, sizing: 'auto-height', scale: 1 });
		expect(resizeTextBox(start, 'fixed', 'w', 30, 0)).toEqual({ rect: { x: 40, y: 20, w: 70, h: 40 }, sizing: 'fixed', scale: 1 });
		expect(sizingAfter('auto-height', 'e')).toBe('auto-height');
	});

	it('top/bottom and corners fix the size, never scaling the font', () => {
		expect(resizeTextBox(start, 'auto-height', 's', 0, 25)).toEqual({ rect: { x: 10, y: 20, w: 100, h: 65 }, sizing: 'fixed', scale: 1 });
		expect(resizeTextBox(start, 'auto-width', 'nw', -10, -10)).toEqual({ rect: { x: 0, y: 10, w: 110, h: 50 }, sizing: 'fixed', scale: 1 });
	});

	it('keeps the proportions with Shift and a minimum size', () => {
		expect(resizeTextBox(start, 'fixed', 'se', 100, 0, { keepAspect: true }).rect).toEqual({ x: 10, y: 20, w: 200, h: 80 });
		expect(resizeTextBox(start, 'fixed', 'e', -500, 0, { minW: 12 }).rect.w).toBe(12);
		expect(resizeTextBox(start, 'fixed', 'n', 0, 500, { minH: 8 }).rect).toEqual({ x: 10, y: 52, w: 100, h: 8 });
	});

	it('scales the box with its font on request, keeping the sizing', () => {
		const r = resizeTextBox(start, 'auto-width', 'se', 100, 0, { scaleText: true });
		expect(r).toEqual({ rect: { x: 10, y: 20, w: 200, h: 80 }, sizing: 'auto-width', scale: 2 });
		const left = resizeTextBox(start, 'auto-height', 'w', 50, 0, { scaleText: true });
		expect(left).toEqual({ rect: { x: 60, y: 30, w: 50, h: 20 }, sizing: 'auto-height', scale: 0.5 });
	});

	it('places handles on corners and side middles', () => {
		expect(handlePoint(start, 'ne')).toEqual([110, 20]);
		expect(handlePoint(start, 's')).toEqual([60, 60]);
	});
});
