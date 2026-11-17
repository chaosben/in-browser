import { describe, expect, it } from 'vitest';
import { assetsOf, backgroundAssets, decodePoints, pageSize, pageSizeOf, encodePoints, FormatError, newNotebook, parseNotebook, parsePage, serializePage, VERSION } from './types';

describe('point codec', () => {
	it('round-trips within the quantization (0.1 pt, 1/255 pressure)', () => {
		const points = new Float32Array([10.04, 20.06, 0.5, 10.5, 21.33, 0.73, 300.27, 800.91, 1]);
		const back = decodePoints(encodePoints(points));
		expect(back).toHaveLength(points.length);
		for (let i = 0; i < points.length; i++) expect(back[i]).toBeCloseTo(points[i], i % 3 === 2 ? 2 : 1);
	});
	it('stores deltas, so slow strokes give small numbers', () => {
		const encoded = encodePoints(new Float32Array([100, 100, 0.5, 100.2, 100.1, 0.5]));
		expect(encoded.slice(3)).toEqual([2, 1, 0]);
	});
});

describe('page files', () => {
	it('round-trip strokes', () => {
		const stroke = { id: 's1', tool: 'highlighter' as const, color: '#facc15', size: 14, points: new Float32Array([1, 2, 0.5, 3, 4, 0.6]) };
		const page = parsePage(JSON.parse(serializePage({ items: [stroke] })));
		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({ id: 's1', tool: 'highlighter', color: '#facc15', size: 14 });
	});
	it('drops broken strokes and repairs fields', () => {
		const page = parsePage({ version: 1, items: [{ id: 'a', pts: [1] }, { id: 'b', color: 'red', size: -1, pts: [1, 2, 3] }, null] });
		expect(page.items.map((s) => s.id)).toEqual(['b']);
		expect(page.items[0]).toMatchObject({ tool: 'pen', color: '#000000', size: 2 });
	});
	it('round-trip pictures in draw order and list the assets', () => {
		const stroke = { id: 's', tool: 'pen' as const, color: '#000000', size: 2, points: new Float32Array([1, 2, 0.5]) };
		const image = { id: 'i', type: 'image' as const, asset: 'abc.png', x: 10, y: 20, w: 100.123, h: 50 };
		const icon = { id: 'c', type: 'icon' as const, icon: { name: 'star', body: '<path d="M0 0h1"/>', width: 24, height: 24 }, color: '#ff0000', x: 0, y: 0, w: 48, h: 48 };
		const page = parsePage(JSON.parse(serializePage({ items: [image, stroke, icon] })));
		expect(page.items.map((i) => i.id)).toEqual(['i', 's', 'c']);
		expect(page.items[0]).toEqual({ ...image, w: 100.12 });
		expect(page.items[2]).toEqual(icon);
		expect(assetsOf(page)).toEqual(['abc.png']);
	});
	it('drops broken pictures', () => {
		const page = parsePage({
			version: 1,
			items: [
				{ id: 'a', type: 'image', asset: '../escape.png', x: 0, y: 0, w: 1, h: 1 },
				{ id: 'b', type: 'image', asset: 'ok.png', x: 0, y: 0, w: 0, h: 1 },
				{ id: 'c', type: 'icon', icon: { body: 1 }, x: 0, y: 0, w: 1, h: 1 }
			]
		});
		expect(page.items).toEqual([]);
	});
	it('rejects newer page versions', () => {
		expect(() => parsePage({ version: 99, items: [] })).toThrow(FormatError);
	});
});

describe('notebooks', () => {
	it('parse a new notebook with one lined A4 page', () => {
		const notebook = parseNotebook(JSON.parse(JSON.stringify(newNotebook(5))));
		expect(notebook.version).toBe(VERSION);
		expect(notebook.pages).toHaveLength(1);
		expect(notebook.pages[0]).toMatchObject({ w: 595, h: 842, paper: 'lined' });
	});
	it('reject other formats and newer versions with a reason', () => {
		expect(() => parseNotebook({ format: 'screen-capture', version: 1, pages: [] })).toThrow(FormatError);
		try {
			parseNotebook({ format: 'notes', version: VERSION + 1, pages: [] });
		} catch (e) {
			expect((e as FormatError).reason).toBe('newer');
		}
	});
	it('keep valid PDF pages under pages and count their assets as used', () => {
		const notebook = parseNotebook({
			format: 'notes',
			version: 1,
			pages: [
				{ id: 'a', w: 300, h: 200, paper: 'blank', background: { asset: 'x.pdf', page: 2 } },
				{ id: 'b', background: { asset: '../x.pdf', page: 1 } },
				{ id: 'c', background: { asset: 'x.pdf', page: 0 } }
			]
		});
		expect(notebook.pages.map((p) => p.background)).toEqual([{ asset: 'x.pdf', page: 2 }, undefined, undefined]);
		expect(backgroundAssets(notebook)).toEqual(['x.pdf']);
	});
	it('fill in missing page fields', () => {
		const notebook = parseNotebook({ format: 'notes', version: 1, pages: [{ id: 'p', paper: 'weird' }, { nope: 1 }] });
		expect(notebook.pages).toEqual([{ id: 'p', w: 595, h: 842, paper: 'blank' }]);
	});
});

describe('page sizes', () => {
	it('recognize a size in both orientations', () => {
		expect(pageSizeOf({ w: 595, h: 842 })).toEqual({ size: 'a4', landscape: false });
		expect(pageSizeOf({ w: 842, h: 595 })).toEqual({ size: 'a4', landscape: true });
		expect(pageSizeOf({ w: 612, h: 792 })).toEqual({ size: 'letter', landscape: false });
		// e.g. an imported PDF page
		expect(pageSizeOf({ w: 500, h: 500 })).toBeNull();
	});
	it('give the points of a size in an orientation', () => {
		expect(pageSize('a5', false)).toEqual({ w: 420, h: 595 });
		expect(pageSize('a5', true)).toEqual({ w: 595, h: 420 });
	});
});
