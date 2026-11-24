import { describe, expect, it } from 'vitest';
import { emptyTimeline } from '#lib/timeline/ops.js';
import { canvasSize, placeRecording } from './project';
import { FORMAT, parseProject, VERSION, type ImageAsset, type Source, type TextAnnotation, type VideoClip } from './types';
import { createOverlay } from './defaults';
import { lineHeightOf } from '#lib/render/overlays.js';

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

describe('formatted text in project.json', () => {
	it('keeps its formats, and text from before keeps its line height', () => {
		const rich = [{ spans: [{ text: 'Hello ' }, { text: 'world', bold: true, size: 0.08 }], list: 'bullet' as const }];
		const old = createOverlay('text', 0, 1) as TextAnnotation;
		const { lineHeight: _, bold: __, italic: ___, underline: ____, ...before } = old;
		const formatted = { ...old, id: 'f', rich, text: 'Hello world', italic: true, lineHeight: 1.5 };
		const timeline = { ...emptyTimeline(), items: [before, formatted] };
		const raw = JSON.parse(JSON.stringify({ format: FORMAT, version: VERSION, sources: [], timeline }));
		const [a, b] = parseProject(raw).timeline.items as TextAnnotation[];
		expect(lineHeightOf(a)).toBe(1.25);
		expect(b).toMatchObject({ rich, text: 'Hello world', italic: true, lineHeight: 1.5 });
	});
});
