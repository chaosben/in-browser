import { describe, expect, it } from 'vitest';
import { growTo, refitDefaults, resizeCanvas, shrunkSources } from './canvas';
import { cameraRect, fitRect } from './defaults';
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
			fade: false,
			shadow: false,
			x: 0,
			y: 1,
			text: 'Hi',
			size: 0.1,
			color: '#000',
			font: 'system',
			background: '#fff',
			tip: { x: 1, y: 0 }
		};
		const a = resizeCanvas(timeline(text), from, to).items[0];
		expect(a).toMatchObject({ x: 0.25, y: 0.75, size: 0.05, tip: { x: 0.75, y: 0.25 } });
	});
	it('zoom keeps w === h and shows the same area', () => {
		const t = resizeCanvas({ ...timeline(), zoom: [{ id: 'z', start: 0, end: 1, ease: 0.5, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } }] }, from, { width: 2000, height: 500 });
		expect(t.zoom[0].rect).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
	});
	it('same size: unchanged', () => {
		const t = timeline(clip());
		expect(resizeCanvas(t, from, from)).toBe(t);
	});
});

describe('growTo', () => {
	it('hull of canvas and larger sources with a picture', () => {
		expect(growTo(from, [source(1600, 400), { ...source(3000, 3000), hasVideo: false }])).toEqual({ width: 1600, height: 500 });
	});
	it('null if everything fits', () => {
		expect(growTo(from, [source(1000, 500), source(800, 300)])).toBeNull();
	});
});

describe('refitDefaults', () => {
	it('a larger source in its default placement fills the new canvas', () => {
		const s = source(2000, 1000);
		const t = refitDefaults(resizeCanvas(timeline(clip(fitRect(s, from.width, from.height))), from, to), [s], from, to);
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

describe('refitDefaults: webcam', () => {
	it('a webcam in its default corner moves to the corner of the new canvas', () => {
		const cam = source(640, 360);
		const t = refitDefaults(resizeCanvas(timeline(clip(cameraRect(cam, from.width, from.height))), from, to), [cam], from, to);
		expect((t.items[0] as Clip).rect).toEqual(cameraRect(cam, to.width, to.height));
	});
});

describe('shrunkSources', () => {
	it('only larger sources in their default placement', () => {
		const big = { ...source(2000, 1000), id: 'big' };
		const small = { ...source(800, 400), id: 'small' };
		const cam = { ...source(1920, 1080), id: 'cam' };
		const t = timeline(
			{ ...clip(fitRect(big, from.width, from.height)), id: 'a', sourceId: 'big' },
			{ ...clip(fitRect(small, from.width, from.height)), id: 'b', sourceId: 'small' },
			{ ...clip({ x: 0.7, y: 0.7, w: 0.25, h: 0.25 }), id: 'c', sourceId: 'cam' }
		);
		expect(shrunkSources(t, [big, small, cam], from).map((s) => s.id)).toEqual(['big']);
	});
});
