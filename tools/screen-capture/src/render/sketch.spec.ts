import { describe, expect, it } from 'vitest';
import type { DrawableAnnotation } from '#lib/project/types.js';
import { strokesLength, strokesOf } from './sketch';

const base = { type: 'annotation', start: 0, end: 3, fadeIn: 0, fadeOut: 0, track: 0, color: '#f00', width: 0.005, shadow: false, drawIn: 0 } as const;
const ellipse = (id: string, sketch: boolean): DrawableAnnotation => ({
	...base,
	id,
	kind: 'ellipse',
	rect: { x: 0.2, y: 0.2, w: 0.4, h: 0.3 },
	sketch
});

describe('strokesOf', () => {
	it('draws a hand-drawn shape the same way every time, only depending on the element', () => {
		expect(strokesOf(ellipse('e1', true), 1920, 1080)).toEqual(strokesOf(ellipse('e1', true), 1920, 1080));
		expect(strokesOf(ellipse('e1', true), 1920, 1080)).not.toEqual(strokesOf(ellipse('e2', true), 1920, 1080));
	});
	it('circles a bit more than once when hand-drawn', () => {
		const exact = strokesLength(strokesOf(ellipse('e', false), 1920, 1080));
		const pen = strokesLength(strokesOf(ellipse('e', true), 1920, 1080));
		expect(pen).toBeGreaterThan(exact * 1.03);
	});
	it('gives a hand-drawn arrow a shaft and an open head', () => {
		const arrow: DrawableAnnotation = { ...base, id: 'a', kind: 'arrow', from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.5 }, sketch: true };
		const strokes = strokesOf(arrow, 1920, 1080);
		expect(strokes).toHaveLength(2);
		expect(strokes[1]).toHaveLength(3);
		expect(strokes[1][1]).toEqual({ x: 960, y: 540 });
	});
});
