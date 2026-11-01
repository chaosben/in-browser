import { describe, expect, it } from 'vitest';
import { cleanCrop, croppedRect, croppedSize, cropInsets, dragCrop, fullRect, insetsCrop } from './crop';

const source = { width: 1000, height: 500 };
const close = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => {
	for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k]).toBeCloseTo(b[k]);
};

describe('fullRect / croppedRect', () => {
	it('round trip', () => {
		const rect = { x: 0.2, y: 0.1, w: 0.3, h: 0.4 };
		const crop = { x: 0.25, y: 0.5, w: 0.5, h: 0.25 };
		close(croppedRect(fullRect(rect, crop), crop), rect);
		close(fullRect(rect, crop), { x: 0.05, y: -0.7, w: 0.6, h: 1.6 });
	});
});

describe('dragCrop', () => {
	const full = { x: 0, y: 0, w: 1, h: 1 };
	it('moves only the dragged edge', () => {
		close(dragCrop({ x: 0, y: 0, w: 1, h: 1 }, 'w', 0.1, 0.3, full, source), { x: 0.1, y: 0, w: 0.9, h: 1 });
		close(dragCrop({ x: 0, y: 0, w: 1, h: 1 }, 'se', -0.2, -0.5, full, source), { x: 0, y: 0, w: 0.8, h: 0.5 });
	});
	it('stays within the source and keeps a minimum size', () => {
		close(dragCrop({ x: 0.1, y: 0, w: 0.9, h: 1 }, 'w', -0.5, 0, full, source), { x: 0, y: 0, w: 1, h: 1 });
		expect(dragCrop({ x: 0, y: 0, w: 1, h: 1 }, 'e', -2, 0, full, source).w).toBeCloseTo(16 / 1000);
	});
});

describe('insets', () => {
	it('converts both ways in source pixels', () => {
		const crop = insetsCrop(source, { left: 100, top: 50, right: 200, bottom: 0 });
		close(crop, { x: 0.1, y: 0.1, w: 0.7, h: 0.9 });
		expect(cropInsets(source, crop)).toEqual({ left: 100, top: 50, right: 200, bottom: 0 });
		expect(croppedSize(source, crop)).toEqual({ width: 700, height: 450 });
	});
	it('limits insets that leave too little', () => {
		expect(cropInsets(source, insetsCrop(source, { left: 990, top: 0, right: 50, bottom: 0 }))).toEqual({ left: 984, top: 0, right: 0, bottom: 0 });
	});
});

describe('cleanCrop', () => {
	it('the whole source is no crop', () => {
		expect(cleanCrop({ x: 0, y: 0, w: 1, h: 1 })).toBeUndefined();
		expect(cleanCrop({ x: 0.1, y: 0, w: 0.9, h: 1 })).toEqual({ x: 0.1, y: 0, w: 0.9, h: 1 });
	});
});
