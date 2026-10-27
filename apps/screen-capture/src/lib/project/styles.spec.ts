import { describe, expect, it } from 'vitest';
import { createOverlay } from './defaults';
import { applyStyle, styleFields } from './styles';
import type { TextAnnotation } from './types';

const text = () => createOverlay('text', 10, 13) as TextAnnotation;

describe('styleFields', () => {
	it('keeps settings, drops position, timing and content', () => {
		expect(styleFields({ color: '#ff0000', x: 0.5, text: 'Hi', start: 2, number: 3, font: 'inter' })).toEqual({
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
		const t = applyStyle(text(), { size: 'big', radius: 0.02, shadow: 1, fade: false });
		expect(t.size).toBe(text().size);
		expect('radius' in t).toBe(false);
		expect(t.shadow).toBe(text().shadow);
		expect(t.fade).toBe(false);
	});
	it('takes over the duration from the start', () => {
		expect(applyStyle(text(), { duration: 5 })).toMatchObject({ start: 10, end: 15 });
		expect(applyStyle(text(), { duration: -1 })).toMatchObject({ start: 10, end: 13 });
	});
});
