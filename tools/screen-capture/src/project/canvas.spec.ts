import { describe, expect, it } from 'vitest';
import { clampCanvasSize, refitDefaults, resizeCanvas } from './canvas';
import { placeRect } from './defaults';
import type { Annotation, Clip, Source, Timeline } from './types';

const from = { width: 1000, height: 500 };
const to = { width: 2000, height: 1000 };

const clip = (rect = { x: 0, y: 0, w: 1, h: 1 }): Clip => ({ id: 'c', type: 'video', sourceId: 's', start: 0, track: 0, in: 0, out: 5, rect });
const timeline = (...items: Timeline['items']): Timeline => ({ items, tracks: [], zoom: [] });
const source = (width: number, height: number): Source => ({
	id: 's',
	file: 's.mp4',
	name: 'S',
	kind: 'recording',
	duration: 5,
	hasVideo: true,
	width,
	height,
	hasAudio: false
});

describe('resizeCanvas', () => {
	it('keeps pixel size and centers', () => {
		const t = resizeCanvas(timeline(clip()), from, to);
		expect((t.items[0] as Clip).rect).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
	});
	it('converts annotation points and height based sizes', () => {
		const text: Annotation = {
			id: 't',
			type: 'annotation',
			kind: 'callout',
			start: 0,
			end: 1,
			track: 1,
			fadeIn: 0,
			fadeOut: 0,
			shadow: false,
			x: 0,
			y: 1,
			text: 'Hi',
			size: 0.1,
			color: '#000',
			font: 'system',
			align: 'left',
			boxWidth: 0.4,
			radius: 0.02,
			padding: 0.04,
			background: '#fff',
			tip: { x: 1, y: 0 }
		};
		const a = resizeCanvas(timeline(text), from, to).items[0];
		expect(a).toMatchObject({ x: 0.25, y: 0.75, size: 0.05, radius: 0.01, padding: 0.02, boxWidth: 0.2, tip: { x: 0.75, y: 0.25 } });
	});
	it('zoom keeps w === h and shows the same area', () => {
		const t = resizeCanvas({ ...timeline(), zoom: [{ id: 'z', start: 0, end: 1, easeIn: 0.5, easeOut: 0.5, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } }] }, from, { width: 2000, height: 500 });
		expect(t.zoom[0].rect).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
	});
});

describe('refitDefaults', () => {
	it('a larger source in its default placement fills the new canvas', () => {
		const s = source(2000, 1000);
		const t = refitDefaults(resizeCanvas(timeline(clip(placeRect(s, from.width, from.height))), from, to), [s], from, to);
		expect((t.items[0] as Clip).rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	});
	it('smaller sources and moved clips keep their pixel size', () => {
		const small = source(1000, 500);
		const t1 = resizeCanvas(timeline(clip()), from, to);
		expect(refitDefaults(t1, [small], from, to).items[0]).toEqual(t1.items[0]);
		const big = source(2000, 1000);
		const t2 = resizeCanvas(timeline(clip({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 })), from, to);
		expect(refitDefaults(t2, [big], from, to).items[0]).toEqual(t2.items[0]);
	});
});

describe('clampCanvasSize', () => {
	it('rounds down to even sizes within the limits', () => {
		expect(clampCanvasSize({ width: 1001, height: 15 })).toEqual({ width: 1000, height: 16 });
		expect(clampCanvasSize({ width: 9999, height: NaN })).toEqual({ width: 7680, height: 16 });
	});
});

describe('resizeCanvas with an offset', () => {
	it('places the old canvas at the offset', () => {
		// The clip at 250…750 × 125…375 of a 1000×500 canvas becomes the whole 500×250 canvas
		const t = resizeCanvas(timeline(clip({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })), from, { width: 500, height: 250 }, { x: -250, y: -125 });
		const r = (t.items[0] as Clip).rect;
		expect(r.x).toBeCloseTo(0);
		expect(r.y).toBeCloseTo(0);
		expect(r.w).toBeCloseTo(1);
		expect(r.h).toBeCloseTo(1);
	});
});

