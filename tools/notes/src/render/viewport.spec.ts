import { describe, expect, it } from 'vitest';
import { layoutPages, MAX_ZOOM, PAGE_GAP, Viewport } from './viewport';

const pages = layoutPages([
	{ w: 600, h: 800 },
	{ w: 400, h: 800 },
	{ w: 600, h: 800 }
]);

function view(width = 800, height = 600) {
	const v = new Viewport();
	v.width = width;
	v.height = height;
	return v;
}

describe('layoutPages', () => {
	it('stacks pages with gaps, centered on the widest', () => {
		expect(pages.width).toBe(600);
		expect(pages.rects[0]).toEqual({ x: 0, y: PAGE_GAP, w: 600, h: 800 });
		expect(pages.rects[1]).toEqual({ x: 100, y: 2 * PAGE_GAP + 800, w: 400, h: 800 });
		expect(pages.height).toBe(4 * PAGE_GAP + 2400);
	});
});

describe('Viewport', () => {
	it('converts between screen and document', () => {
		const v = view();
		v.zoom = 2;
		v.x = 10;
		v.y = 20;
		expect(v.toScreenX(15)).toBe(10);
		expect(v.toDocY(v.toScreenY(123))).toBe(123);
	});
	it('zooms around the given point', () => {
		const v = view();
		const before = [v.toDocX(200), v.toDocY(100)];
		v.zoomAt(2, 200, 100);
		expect([v.toDocX(200), v.toDocY(100)]).toEqual(before);
		v.zoomAt(1000, 0, 0);
		expect(v.zoom).toBe(MAX_ZOOM);
	});
	it('fits the width with a margin', () => {
		const v = view(616, 600);
		v.fitWidth(600);
		expect(v.zoom).toBe(1);
	});
	it('centers a narrow document and limits scrolling', () => {
		const v = view(1000, 600);
		v.clamp(600, pages.height);
		expect(v.x).toBe(-200);
		v.y = 1e6;
		v.clamp(600, pages.height);
		expect(v.y).toBe(pages.height - 600 + 48);
	});
	it('finds visible pages, the page under a point and the current page', () => {
		const v = view(800, 600);
		v.y = 700;
		expect(v.visiblePages(pages.rects)).toEqual([0, 1]);
		expect(v.visiblePages(pages.rects, 1)).toEqual([0, 1, 2]);
		const hit = v.pageAt(pages.rects, 150, 200);
		expect(hit).toEqual({ index: 1, x: 50, y: 900 - (2 * PAGE_GAP + 800) });
		expect(v.pageAt(pages.rects, 50, 200)).toBeNull();
		expect(v.centerPage(pages.rects)).toBe(1);
	});
});
