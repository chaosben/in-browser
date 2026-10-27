import { describe, expect, it } from 'vitest';
import { anchorFactors, captureLayout, contentSizeAt, placeInBox, sourceCrop } from './content';
import type { Source } from '#lib/project/types.js';

const source = (extra: Partial<Source> = {}): Source => ({
	id: 's',
	file: 's.mp4',
	name: 'S',
	kind: 'recording',
	duration: 10,
	hasVideo: true,
	width: 800,
	height: 600,
	hasAudio: false,
	...extra
});

describe('sourceCrop', () => {
	it('whole file without crop', () => {
		expect(sourceCrop(source())).toEqual({ left: 0, top: 0, width: 800, height: 600 });
	});
	it('offset of the used area', () => {
		expect(sourceCrop(source({ crop: { x: 100, y: 50 } }))).toEqual({ left: 100, top: 50, width: 800, height: 600 });
	});
});

describe('contentSizeAt', () => {
	const sizes = [
		{ t: 0.1, width: 400, height: 300 },
		{ t: 2, width: 800, height: 600 },
		{ t: 5, width: 600, height: 400 }
	];
	it('whole source without size changes', () => {
		expect(contentSizeAt(source(), 3)).toEqual({ width: 800, height: 600 });
	});
	it('size valid at the time', () => {
		expect(contentSizeAt(source({ sizes }), 0)).toEqual({ width: 400, height: 300 });
		expect(contentSizeAt(source({ sizes }), 2)).toEqual({ width: 800, height: 600 });
		expect(contentSizeAt(source({ sizes }), 4.9)).toEqual({ width: 800, height: 600 });
		expect(contentSizeAt(source({ sizes }), 9)).toEqual({ width: 600, height: 400 });
	});
});

describe('captureLayout', () => {
	const box = { width: 1920, height: 1080 };
	it('largest frame, centered and even', () => {
		const sizes = [
			{ t: 0, width: 800, height: 600 },
			{ t: 1, width: 1001, height: 701 }
		];
		expect(captureLayout(box, { width: 1001, height: 701 }, sizes)).toEqual({
			width: 1002,
			height: 702,
			crop: { x: 459, y: 189 },
			sizes
		});
	});
	it('no crop and no sizes when nothing changed', () => {
		expect(captureLayout(box, box, [{ t: 0, ...box }])).toEqual({ width: 1920, height: 1080, crop: undefined, sizes: undefined });
	});
});

describe('placeInBox', () => {
	it('centered 1:1', () => {
		expect(placeInBox({ width: 1920, height: 1080 }, { width: 801, height: 600 })).toEqual({ x: 559, y: 240, width: 801, height: 600 });
	});
	it('scaled down if too large', () => {
		expect(placeInBox({ width: 1000, height: 500 }, { width: 2000, height: 500 })).toEqual({ x: 0, y: 125, width: 1000, height: 250 });
	});
});

describe('anchorFactors', () => {
	it('center by default', () => {
		expect(anchorFactors()).toEqual({ x: 0.5, y: 0.5 });
	});
	it('corners and edges', () => {
		expect(anchorFactors('top-left')).toEqual({ x: 0, y: 0 });
		expect(anchorFactors('bottom')).toEqual({ x: 0.5, y: 1 });
		expect(anchorFactors('right')).toEqual({ x: 1, y: 0.5 });
		expect(anchorFactors('bottom-right')).toEqual({ x: 1, y: 1 });
	});
});
