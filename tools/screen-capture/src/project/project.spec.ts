import { describe, expect, it } from 'vitest';
import { emptyTimeline } from '#lib/timeline/ops.js';
import { canvasSize, IMAGE_SECONDS, placeImages } from './project';
import type { ImageAnnotation, ImageAsset, Source } from './types';

const image = (id: string, width: number, height: number): ImageAsset => ({ id, file: `${id}.png`, name: id, width, height });
const video = { id: 'v', hasVideo: true, width: 1280, height: 720 } as Source;
const audio = { id: 'a', hasVideo: false, width: 0, height: 0 } as Source;

describe('canvasSize', () => {
	it('the first source with a picture wins', () => {
		expect(canvasSize([audio, video], [image('i', 800, 600)])).toEqual({ width: 1280, height: 720 });
	});
	it('without one, the first image sets it – even and within 16–7680 px', () => {
		expect(canvasSize([audio], [image('i', 801, 599)])).toEqual({ width: 802, height: 600 });
		expect(canvasSize([], [image('i', 9000, 5)])).toEqual({ width: 7680, height: 16 });
	});
	it('otherwise Full HD', () => {
		expect(canvasSize([], [])).toEqual({ width: 1920, height: 1080 });
	});
});

describe('placeImages', () => {
	it('one after another from the start, each fitted into the canvas', () => {
		const timeline = placeImages(emptyTimeline(), [image('a', 800, 600), image('b', 600, 800)], 800, 600, 10);
		const items = timeline.items as ImageAnnotation[];
		expect(items.map((i) => [i.imageId, i.start, i.end])).toEqual([
			['a', 10, 10 + IMAGE_SECONDS],
			['b', 10 + IMAGE_SECONDS, 10 + 2 * IMAGE_SECONDS]
		]);
		expect(items[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
		// Portrait image in a landscape canvas: full height, centered
		expect(items[1].rect.h).toBeCloseTo(1);
		expect(items[1].rect.x).toBeGreaterThan(0);
		expect(new Set(items.map((i) => i.track)).size).toBe(1);
	});
});
