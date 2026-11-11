import { describe, expect, it } from 'vitest';
import { clampCanvasSize, clipCanvasArea, growTo, largestClipArea, refitDefaults, resizeCanvas, shrunkSources } from './canvas';
import { cameraRect, placeRect } from './defaults';
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
	it('images and icons keep their pixel size', () => {
		const image: Annotation = { id: 'i', type: 'annotation', kind: 'image', start: 0, end: 1, track: 1, fadeIn: 0, fadeOut: 0, shadow: false, rect: { x: 0, y: 0, w: 1, h: 1 }, imageId: 'p', radius: 0.02 };
		expect(resizeCanvas(timeline(image), from, to).items[0]).toMatchObject({ rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, radius: 0.01 });
	});
		it('zoom keeps w === h and shows the same area', () => {
		const t = resizeCanvas({ ...timeline(), zoom: [{ id: 'z', start: 0, end: 1, easeIn: 0.5, easeOut: 0.5, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } }] }, from, { width: 2000, height: 500 });
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
			{ ...clip(placeRect(big, from.width, from.height)), id: 'a', sourceId: 'big' },
			{ ...clip(placeRect(small, from.width, from.height)), id: 'b', sourceId: 'small' },
			{ ...clip({ x: 0.7, y: 0.7, w: 0.25, h: 0.25 }), id: 'c', sourceId: 'cam' }
		);
		expect(shrunkSources(t, [big, small, cam], from).map((s) => s.id)).toEqual(['big']);
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

describe('largestClipArea', () => {
	const big = { ...source(1000, 500), id: 'big' };
	const audio = { ...source(0, 0), id: 'audio', hasVideo: false };
	it('the largest clip with a picture, within the canvas, even and centered on it', () => {
		const t = timeline(
			{ ...clip({ x: 0.1, y: 0.1, w: 0.301, h: 0.5 }), id: 'a', sourceId: 'big' },
			{ ...clip({ x: 0.8, y: 0.8, w: 0.1, h: 0.1 }), id: 'b', sourceId: 'big' },
			{ ...clip(), id: 'c', sourceId: 'audio' }
		);
		expect(largestClipArea(t, [big, audio], from)).toEqual({ size: { width: 300, height: 250 }, offset: { x: -100.5, y: -50 } });
	});
	it('cuts the clip to the canvas', () => {
		const t = timeline({ ...clip({ x: -0.5, y: 0, w: 1, h: 0.5 }), sourceId: 'big' });
		expect(largestClipArea(t, [big], from)?.size).toEqual({ width: 500, height: 250 });
	});
	it('null if nothing gets smaller or there is no clip with a picture', () => {
		expect(largestClipArea(timeline({ ...clip(), sourceId: 'big' }), [big], from)).toBeNull();
		expect(largestClipArea(timeline({ ...clip({ x: 0, y: 0, w: 0.5, h: 0.5 }), sourceId: 'audio' }), [audio], from)).toBeNull();
	});
});

describe('clipCanvasArea', () => {
	const hd = { width: 1920, height: 1080 };
	it('grows to a clip shown shrunk, centered on it', () => {
		expect(clipCanvasArea(clip(), source(3840, 2160), hd)).toEqual({ size: { width: 3840, height: 2160 }, offset: { x: 960, y: 540 } });
	});
	it('shrinks to a smaller clip around its center', () => {
		const s = source(800, 600);
		const area = clipCanvasArea(clip(placeRect(s, 1920, 1080)), s, hd);
		expect(area?.size).toEqual({ width: 800, height: 600 });
		expect(area?.offset.x).toBeCloseTo(-560);
		expect(area?.offset.y).toBeCloseTo(-240);
	});
	it('uses the cropped part', () => {
		const c = { ...clip({ x: 0, y: 0, w: 0.5, h: 1 }), crop: { x: 0, y: 0, w: 0.5, h: 1 } };
		expect(clipCanvasArea(c, source(1920, 1080), hd)?.size).toEqual({ width: 960, height: 1080 });
	});
	it('stays within the largest canvas, keeping the aspect ratio', () => {
		expect(clipCanvasArea(clip(), source(10000, 5000), hd)?.size).toEqual({ width: 7680, height: 3840 });
	});
	it('returns null when the clip already fills the canvas 1:1 or has no picture', () => {
		expect(clipCanvasArea(clip(), source(1920, 1080), hd)).toBeNull();
		expect(clipCanvasArea(clip(), { ...source(0, 0), hasVideo: false }, hd)).toBeNull();
	});
	it('converts click marks like steps', () => {
		const click: Annotation = { id: 'k', type: 'annotation', kind: 'click', start: 0, end: 1, track: 1, fadeIn: 0, fadeOut: 0, x: 0.5, y: 0.5, size: 0.1, color: '#fff', style: 'dot' };
		const t = resizeCanvas(timeline(click), from, to);
		expect(t.items[0]).toMatchObject({ x: 0.5, y: 0.5, size: 0.05 });
	});
});

describe('refitDefaults: cameras only', () => {
	it('leaves shrunk clips alone', () => {
		const s = source(4000, 2000);
		const t = resizeCanvas(timeline(clip(placeRect(s, from.width, from.height))), from, to);
		expect(refitDefaults(t, [s], from, to, undefined, true)).toEqual(t);
	});
});
