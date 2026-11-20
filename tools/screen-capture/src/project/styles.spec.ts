import { describe, expect, it } from 'vitest';
import { createOverlay } from './defaults';
import { applyStyle, styleFields } from './styles';
import type { TextAnnotation } from './types';

const text = () => createOverlay('text', 10, 13) as TextAnnotation;

describe('styleFields', () => {
	it('keeps settings, never position, timing, content, the picture or the icon', () => {
		expect(styleFields({ color: '#ff0000', x: 0.5, text: 'Hi', start: 2, number: 3, font: 'inter', imageId: 'x', icon: {} })).toEqual({
			color: '#ff0000',
			font: 'inter'
		});
	});
});

describe('applyStyle', () => {
	it('applies remembered settings but keeps position and text', () => {
		const t = applyStyle(text(), { color: '#ff0000', font: 'caveat', background: null, x: 0.9, text: 'Old' });
		expect(t).toMatchObject({ color: '#ff0000', font: 'caveat', background: null, x: 0.08 });
		expect(t.text).toBe(text().text);
	});
	it('ignores unknown fields and values of another type', () => {
		const t = applyStyle(text(), { size: 'big', dashed: true, shadow: 1, duration: -1 });
		expect(t.size).toBe(text().size);
		expect('dashed' in t).toBe(false);
		expect(t.shadow).toBe(text().shadow);
		expect(t).toMatchObject({ start: 10, end: 13 });
	});
});
