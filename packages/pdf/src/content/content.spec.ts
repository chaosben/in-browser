import { describe, expect, it } from 'vitest';
import { contentObjects, type ContentResources } from './objects.js';
import { rewriteContent } from './rewrite.js';
import { tokenize } from './tokens.js';

// A page's content is taken apart into objects and written again with some of them changed: what isn't changed
// must come back byte for byte, and what later operators build on must survive a deleted or moved piece.

const latin1 = new TextDecoder('latin1');
const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

const STREAM = [
	'q 1 0 0 1 10 20 cm',
	'BT /F1 12 Tf 14 TL 100 700 Td (Hel\\)lo) Tj /F2 10 Tf <20576f726c64> Tj (Second) \' ET',
	'Q',
	'0 0 1 rg 50 50 100 30 re f % a box',
	'q 200 0 0 100 300 400 cm /Im1 Do Q',
	'BI /W 1 /H 1 /BPC 8 /CS /G ID \x00 EI',
	'q 0 0 10 10 re W n 1 1 m 5 5 l S Q',
	'/Fm1 Do',
	// Built inside a saved state, painted after it (as pdf-lib draws ellipses)
	'q 400 300 m 410 300 l 410 310 l h Q f'
].join('\n');

const resources: ContentResources = {
	xobject: (name) => (name === 'Im1' ? { kind: 'image' } : name === 'Fm1' ? { kind: 'form', bbox: [0, 0, 20, 10], matrix: [1, 0, 0, 1, 5, 5] } : null),
	font: () => ({ bytes: 1, width: () => 500 })
};

describe('page content', () => {
	const data = bytes(STREAM);
	const ops = tokenize(data);
	const objects = contentObjects(ops, resources);

	it('finds the objects with their boxes', () => {
		expect(objects.map((o) => o.kind)).toEqual(['text', 'text', 'path', 'image', 'image', 'path', 'form', 'path']);
		// "Hel)lo" in 12 pt and " World" in 10 pt: one piece, starting at 100 + 10, 700 + 20
		expect(objects[0].box.x0).toBeCloseTo(110);
		expect(objects[0].box.x1).toBeCloseTo(110 + 6 * 6 + 6 * 5);
		expect(objects[1].box.y0).toBeLessThan(objects[0].box.y0);
		expect(objects[2].box).toEqual({ x0: 50, y0: 50, x1: 150, y1: 80 });
		expect(objects[3].box).toEqual({ x0: 300, y0: 400, x1: 500, y1: 500 });
		expect(objects[6].box).toEqual({ x0: 5, y0: 5, x1: 25, y1: 15 });
	});

	it('gives the same bytes back when nothing changes', () => {
		expect(rewriteContent(data, ops, objects, new Map())).toBe(data);
		expect(rewriteContent(data, ops, objects, new Map([[3, { matrix: [1, 0, 0, 1, 0, 0] }]]))).toBe(data);
	});

	it('takes a piece of text out and keeps what later text builds on', () => {
		const out = latin1.decode(rewriteContent(data, ops, objects, new Map([[0, { remove: true }]])));
		expect(out).not.toContain('Hel');
		expect(out).not.toContain('576f726c64');
		expect(out).toContain('/F2 10 Tf');
		expect(out).toContain("(Second) '");
		// Everything after the text object is untouched
		expect(out.slice(out.indexOf('ET\nQ'))).toBe(STREAM.slice(STREAM.indexOf('ET\nQ')));
		// And it reads as the same objects without the one
		expect(contentObjects(tokenize(bytes(out)), resources).map((o) => o.kind)).toEqual(['text', 'path', 'image', 'image', 'path', 'form', 'path']);
	});

	it('moves an object in page space whatever transformation it is drawn with', () => {
		const moved = new Map([[3, { matrix: [1, 0, 0, 1, 10, 0] as [number, number, number, number, number, number] }], [1, { matrix: [2, 0, 0, 2, 0, 0] as [number, number, number, number, number, number] }]]);
		const out = rewriteContent(data, ops, objects, moved);
		expect(latin1.decode(out)).toContain('q 1 0 0 1 0.05 0 cm\n/Im1 Do\nQ');
		const again = contentObjects(tokenize(out), resources);
		expect(again.map((o) => o.kind)).toEqual(objects.map((o) => o.kind));
		expect(again[3].box).toEqual({ x0: 310, y0: 400, x1: 510, y1: 500 });
		// The second line, twice as large about the origin; the first one where it was
		expect(again[1].box.x0).toBeCloseTo(objects[1].box.x0 * 2);
		expect(again[1].box.y1).toBeCloseTo(objects[1].box.y1 * 2);
		expect(again[0].box).toEqual(objects[0].box);
		expect(again[2].box).toEqual(objects[2].box);
	});

	it('moves and removes a path that is painted after the state it was built in', () => {
		expect(objects[7].box).toEqual({ x0: 400, y0: 300, x1: 410, y1: 310 });
		const moved = rewriteContent(data, ops, objects, new Map([[7, { matrix: [1, 0, 0, 1, 0, -30] as [number, number, number, number, number, number] }]]));
		expect(latin1.decode(moved).replace(/\s+/g, ' ')).toContain('q q 1 0 0 1 0 -30 cm 400 300 m 410 300 l 410 310 l h f Q Q');
		expect(contentObjects(tokenize(moved), resources)[7].box).toEqual({ x0: 400, y0: 270, x1: 410, y1: 280 });
		const removed = latin1.decode(rewriteContent(data, ops, objects, new Map([[7, { remove: true }]])));
		expect(removed.slice(removed.lastIndexOf('Do')).replace(/\s+/g, ' ').trim()).toBe('Do q Q');
	});
});
