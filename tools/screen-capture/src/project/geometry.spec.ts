import { describe, expect, it } from 'vitest';
import {
	CROP_HANDLES,
	clampZoomRect,
	cornerPoint,
	padded,
	resized,
	resizedKeepingAspect,
	resizedZoom,
	sign,
	zoomRectAt
} from './geometry';
import type { Rect } from './types';

const close = (a: Rect, b: Rect) => {
	for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k]).toBeCloseTo(b[k]);
};
const r = { x: 0.2, y: 0.2, w: 0.4, h: 0.2 };

describe('corners', () => {
	it('sign and position', () => {
		expect(sign('se', 'e')).toBe(1);
		expect(sign('nw', 's')).toBe(-1);
		expect(cornerPoint(r, 'nw')).toEqual({ x: 0.2, y: 0.2 });
		close({ ...cornerPoint(r, 'se'), w: 0, h: 0 }, { x: 0.6, y: 0.4, w: 0, h: 0 });
	});
});

describe('padded', () => {
	it('grows thin boxes around their center only', () => {
		close(padded({ x: 0.5, y: 0.5, w: 0, h: 0.1 }, 0.02), { x: 0.49, y: 0.5, w: 0.02, h: 0.1 });
		expect(padded(r, 0.02)).toEqual(r);
	});
});

describe('resized', () => {
	it('keeps the opposite corner', () => {
		close(resized(r, 'se', 0.1, 0.1), { x: 0.2, y: 0.2, w: 0.5, h: 0.3 });
		close(resized(r, 'nw', 0.1, -0.1), { x: 0.3, y: 0.1, w: 0.3, h: 0.3 });
	});
	it('flips past the opposite corner and keeps a minimum size', () => {
		close(resized(r, 'se', -0.6, 0), { x: 0, y: 0.2, w: 0.2, h: 0.2 });
		expect(resized(r, 'se', -0.4, -0.2).w).toBe(0.01);
	});
});

describe('resizedKeepingAspect', () => {
	it('keeps the aspect ratio and the opposite corner', () => {
		const next = resizedKeepingAspect(r, 'nw', -0.2, -0.1);
		close(next, { x: 0, y: 0.1, w: 0.6, h: 0.3 });
	});
	it('stops at the minimum width', () => {
		expect(resizedKeepingAspect(r, 'se', -1, -1).w).toBe(0.05);
		expect(resizedKeepingAspect(r, 'se', -1, -1, 0.01).w).toBe(0.01);
	});
});

describe('zoom views', () => {
	const z = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
	it('resizedZoom stays square and within the frame', () => {
		close(resizedZoom(z, 'se', 0.1, 0.1), { x: 0.25, y: 0.25, w: 0.6, h: 0.6 });
		close(resizedZoom(z, 'se', 1, 1), { x: 0.25, y: 0.25, w: 0.75, h: 0.75 });
		close(resizedZoom(z, 'nw', 1, 1), { x: 0.65, y: 0.65, w: 0.1, h: 0.1 });
	});
	it('zoomRectAt centers and clamps', () => {
		close(zoomRectAt(0.5, 0.5, 0.2), { x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
		close(zoomRectAt(0, 1, 0.5), { x: 0, y: 0.5, w: 0.5, h: 0.5 });
		expect(clampZoomRect({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 })).toEqual({ x: 0, y: 0.5, w: 0.5, h: 0.5 });
	});
});

describe('CROP_HANDLES', () => {
	it('places corners and side middles', () => {
		const at = Object.fromEntries(CROP_HANDLES.map((h) => [h.handle, h.at(r)]));
		expect(at.nw).toEqual([0.2, 0.2]);
		expect(at.e[0]).toBeCloseTo(0.6);
		expect(at.e[1]).toBeCloseTo(0.3);
	});
});
