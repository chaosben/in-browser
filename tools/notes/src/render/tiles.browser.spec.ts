import { describe, expect, it } from 'vitest';
import { isStroke, type Stroke } from '#lib/model/types.js';
import { PageScene } from './scene';
import { TILE, TileCache, tileRange } from './tiles';

// Performance budget of the drawing surface (see .claude/rules/notes.md): a full page of handwriting must render
// its tiles quickly, and adding a stroke to cached tiles must be far below a frame.

function scribble(count: number): Stroke[] {
	let seed = 1;
	const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	return Array.from({ length: count }, (_, i) => {
		const x = random() * 560 + 10;
		const y = random() * 800 + 20;
		const pts: number[] = [];
		for (let j = 0; j < 24; j++) pts.push(x + j * 1.2, y + Math.sin(j / 2) * 4, 0.4 + random() * 0.4);
		return { id: `s${i}`, tool: 'pen', color: '#1e293b', size: 1.5, points: new Float32Array(pts) };
	});
}

describe('tile rendering budget', () => {
	const scene = new PageScene({ items: scribble(5000) });
	const page = { id: 'p', w: 595, h: 842, paper: 'lined' as const, scene };

	it('renders the visible tiles of a page with 5,000 strokes in time', () => {
		// Outlines are computed once per stroke (when loading); measured separately
		let t = performance.now();
		for (const s of scene.items) if (isStroke(s)) scene.path(s);
		const outlines = performance.now() - t;

		const cache = new TileCache();
		const scale = 2; // e.g. fit width on a phone with DPR 3
		const { tx0, ty0, tx1, ty1 } = tileRange(scale, { x0: 0, y0: 0, x1: 595, y1: 842 });
		t = performance.now();
		let tiles = 0;
		for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++, tiles++) cache.render(page, scale, tx, ty);
		const perTile = (performance.now() - t) / tiles;
		console.info(`[bench] outlines ${outlines.toFixed(0)} ms for 5000 strokes, ${perTile.toFixed(1)} ms per ${TILE}px tile`);
		expect(outlines).toBeLessThan(1500);
		expect(perTile).toBeLessThan(60);
	});

	it('adds a finished stroke to the cached tiles well within a frame', () => {
		const cache = new TileCache();
		for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 3; tx++) cache.render(page, 2, tx, ty);
		const [s] = scribble(1);
		scene.add({ ...s, id: 'new' });
		const stroke = scene.items.at(-1) as Stroke;
		const t = performance.now();
		cache.drawStroke('p', scene, stroke, scene.bounds(stroke));
		const ms = performance.now() - t;
		console.info(`[bench] commit ${ms.toFixed(2)} ms`);
		expect(ms).toBeLessThan(4);
	});
});
