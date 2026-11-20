import { describe, expect, it } from 'vitest';
import { boxesOf, findAll, pageText, positionAt, type RawTextItem } from './text';

// A 600 pt high page without rotation: PDF space y up → page points y down
const toPage = ([x0, y0, x1, y1]: [number, number, number, number]) => [x0, 600 - y0, x1, 600 - y1];
const item = (str: string, x: number, y: number, width: number, hasEOL = false): RawTextItem => ({ str, transform: [10, 0, 0, 10, x, y], width, height: 10, hasEOL });

describe('page text', () => {
	const text = pageText([item('Hello', 100, 500, 50), item('world', 160, 500, 50, true), item('Second line', 100, 480, 110)], toPage);

	it('joins items with spaces at line ends, boxes in page points', () => {
		expect(text.str).toBe('Helloworld Second line');
		expect(text.runs[0]).toEqual({ start: 0, end: 5, x0: 100, y0: 90, x1: 150, y1: 100 });
	});

	it('finds hits across items and lines, with context and boxes', () => {
		const hits = findAll([text], 'world second');
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ page: 0, match: 'world Second', before: 'Hello', after: ' line' });
		expect(hits[0].boxes).toHaveLength(2);
		// "Second" is the first 6 of 11 characters of its run
		expect(hits[0].boxes[1].x1).toBeCloseTo(100 + (110 * 6) / 11);
	});

	it('cuts hits along the reading direction of a turned page', () => {
		// Turned a quarter clockwise (page 800 × 600 pt as shown): PDF x runs down the page, PDF y to the left
		const turned = ([x0, y0, x1, y1]: [number, number, number, number]) => [y0, x0, y1, x1];
		const page = pageText([item('Second line', 100, 480, 110)], turned, 90);
		const [hit] = findAll([page], 'line');
		expect(hit.boxes[0].y0).toBeCloseTo(100 + (110 * 7) / 11);
		expect(hit.boxes[0].y1).toBeCloseTo(210);
		expect(hit.boxes[0].x0).toBe(480);
	});

	it('finds the position between characters nearest to a point, preferring the line under it', () => {
		// "Hello" from x 100 to 150 (10 pt per character), y 90…100; "Second line" below at y 110…120
		expect(positionAt(text, 101, 95)).toBe(0);
		expect(positionAt(text, 124, 95)).toBe(2);
		expect(positionAt(text, 300, 96)).toBe(10);
		expect(positionAt(text, 50, 115)).toBe(11);
		expect(positionAt({ str: '', runs: [] }, 0, 0)).toBeNull();
		// The boxes between two positions: "llo" and "wo"
		const boxes = boxesOf(text.runs, positionAt(text, 124, 95)!, positionAt(text, 181, 95)!);
		expect(boxes.map((b) => [b.x0, b.x1])).toEqual([
			[120, 150],
			[160, 180]
		]);
	});

	it('tells capitals apart only when asked', () => {
		expect(findAll([text], 'hello')).toHaveLength(1);
		expect(findAll([text], 'hello', true)).toHaveLength(0);
		expect(findAll([text], '  ')).toHaveLength(0);
	});

	it('lists hits in reading order over pages', () => {
		const other = pageText([item('hello again', 0, 500, 100)], toPage);
		expect(findAll([text, other], 'hello').map((h) => h.page)).toEqual([0, 1]);
	});

	it('cuts runs between the right letters when it can measure them', () => {
		const text = pageText([{ str: 'iiWW', transform: [1, 0, 0, 1, 0, 0], width: 40, height: 10 }], (r) => r);
		// i is 2 wide, W 18: "ii" ends at 4 of 40
		const measure = (s: string) => [...s].reduce((w, c) => w + (c === 'i' ? 2 : 18), 0);
		expect(boxesOf(text.runs, 0, 2, { str: text.str, measure })[0]).toMatchObject({ x0: 0, x1: 4 });
		expect(boxesOf(text.runs, 0, 2)[0]).toMatchObject({ x0: 0, x1: 20 });
		expect(positionAt(text, 5, 5, measure)).toBe(2);
		expect(positionAt(text, 5, 5)).toBe(1);
	});
});
