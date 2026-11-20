import { describe, expect, it } from 'vitest';
import { emptyTimeline } from '#lib/timeline/ops.js';
import { canvasSize, placeRecording } from './project';
import type { ImageAsset, Source, VideoClip } from './types';

const image = (id: string, width: number, height: number): ImageAsset => ({ id, file: `${id}.png`, name: id, width, height });
const video = { id: 'v', hasVideo: true, width: 1280, height: 720 } as Source;
const audio = { id: 'a', hasVideo: false, width: 0, height: 0 } as Source;

describe('canvasSize', () => {
	it('takes the first picture; from an image only even and within 16–7680 px', () => {
		expect(canvasSize([audio, video], [image('i', 800, 600)])).toEqual({ width: 1280, height: 720 });
		expect(canvasSize([audio], [image('i', 801, 599)])).toEqual({ width: 802, height: 600 });
		expect(canvasSize([], [image('i', 9000, 5)])).toEqual({ width: 7680, height: 16 });
	});
});

describe('placeRecording', () => {
	it('a smaller screen recording is not enlarged', () => {
		const screen = { ...video, duration: 5 } as Source;
		const clip = placeRecording(emptyTimeline(), { screen }, 2560, 1440).items[0] as VideoClip;
		expect(clip.rect).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
	});
});
