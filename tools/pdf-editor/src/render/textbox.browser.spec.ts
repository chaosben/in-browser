import { describe, expect, it } from 'vitest';
import { loadTextFont, moveTextHandle, overflowOf, textBounds, textHandles, withText, type TextItem } from './textbox.js';

// Text boxes size like Figma's: auto width, auto height, fixed size; handles change the box, the font only with K.
// Handles: corners nw, ne, se, sw, then sides n, e, s, w (`TEXT_HANDLES`).
const NE = 1;
const SE = 2;
const E = 5;
const S = 6;
const blank = (more: Partial<TextItem> = {}): TextItem => ({ id: 't', type: 'text', x: 50, y: 50, w: 0, h: 0, rot: 0, size: 20, color: '#000000', text: '', lines: [], ...more });
const keys = { keepAspect: false, scaleText: false };

describe('text box sizing', () => {
	it('auto width follows the longest line and breaks only at Enter, wrapping at the page edge', async () => {
		await loadTextFont();
		const one = withText(blank({ sizing: 'auto-width' }), 'Hallo Welt');
		expect(one.lines).toEqual(['Hallo Welt']);
		const two = withText(blank({ sizing: 'auto-width' }), 'Hallo Welt\nund mehr Text');
		expect(two.lines).toEqual(['Hallo Welt', 'und mehr Text']);
		expect(two.w).toBeGreaterThan(one.w);
		// 100 pt to the page's edge: wraps there
		const capped = withText(blank({ sizing: 'auto-width' }), 'Hallo Welt und mehr Text', 100);
		expect(capped.w).toBeLessThanOrEqual(100);
		expect(capped.lines.length).toBeGreaterThan(1);
	});

	it('a side sets the width without touching the font: auto width becomes auto height', async () => {
		await loadTextFont();
		const box = withText(blank({ sizing: 'auto-width' }), 'Hallo Welt und mehr');
		const [hx, hy] = textHandles(box)[E];
		const narrow = moveTextHandle(box, E, hx - box.w / 2, hy, keys);
		expect(narrow).toMatchObject({ sizing: 'auto-height', size: 20, x: box.x });
		expect(narrow.w).toBeCloseTo(box.w / 2);
		expect(narrow.lines.length).toBeGreaterThan(1);
		expect(narrow.h).toBeGreaterThan(box.h);
	});

	it('bottom and corners fix the size; text that doesn’t fit runs out below', async () => {
		await loadTextFont();
		const box = withText(blank({ sizing: 'auto-height', w: 200 }), 'Hallo');
		const [, sy] = textHandles(box)[S];
		const tall = moveTextHandle(box, S, box.x + 100, sy + 60, keys);
		expect(tall).toMatchObject({ sizing: 'fixed', size: 20, w: 200 });
		expect(tall.h).toBeCloseTo(box.h + 60);
		const full = withText(tall, 'Eins\nZwei\nDrei\nVier\nFünf');
		expect(full.h).toBeCloseTo(tall.h);
		expect(overflowOf(full)).toBeGreaterThan(0);
		expect(textBounds(full).y1).toBeCloseTo(full.y + full.h + overflowOf(full));
		const [cx, cy] = textHandles(box)[NE];
		expect(moveTextHandle(box, NE, cx + 40, cy - 40, keys)).toMatchObject({ sizing: 'fixed', size: 20, w: 240, y: box.y - 40 });
	});

	it('scales with its font only with K', async () => {
		await loadTextFont();
		const box = withText(blank({ sizing: 'auto-height', w: 200, border: '#ff0000', borderWidth: 2 }), 'Hallo');
		const [cx, cy] = textHandles(box)[SE];
		const big = moveTextHandle(box, SE, cx + 200, cy, { keepAspect: false, scaleText: true });
		expect(big).toMatchObject({ sizing: 'auto-height', size: 40, borderWidth: 4, x: box.x, y: box.y });
		expect(big.w).toBeCloseTo(400);
	});

	it('works along the text on a turned page', async () => {
		await loadTextFont();
		// Turned by 90°: the text runs down, its end is the box's bottom side
		const box = withText(blank({ sizing: 'auto-height', rot: 90, w: 0, h: 200 }), 'Hallo');
		const [sx, sy] = textHandles(box)[S];
		const longer = moveTextHandle(box, S, sx, sy + 50, keys);
		expect(longer).toMatchObject({ sizing: 'auto-height', size: 20, y: box.y });
		expect(longer.h).toBeCloseTo(250);
		expect(longer.w).toBeCloseTo(box.w);
	});
});
