import { describe, expect, it } from 'vitest';
import { Picker } from './pick.svelte.js';

// Picking in lists and grids – the same in Files, Notes, Screen Capture, the Text Editor and the PDF Editor

const ORDER = ['a', 'b', 'c', 'd'];
const click = (mods: Partial<MouseEvent> = {}) => ({ ctrlKey: false, metaKey: false, shiftKey: false, type: 'click', ...mods }) as MouseEvent;

describe('Picker', () => {
	it.each([
		['click, Ctrl+click, Shift+click', [['b', {}], ['d', { ctrlKey: true }], ['a', { shiftKey: true }]], ['a', 'b', 'c', 'd']],
		['Shift+click from the last click', [['b', {}], ['c', { shiftKey: true }]], ['b', 'c']],
		['Ctrl+click removes', [['b', {}], ['b', { ctrlKey: true }]], []]
	] as const)('%s', (_, steps, picked) => {
		const p = new Picker();
		for (const [id, mods] of steps) p.click(click(mods), id, ORDER);
		expect(p.ordered(ORDER)).toEqual(picked);
	});

	it('with nothing picked the current entry counts: Ctrl+click adds to it, Shift+click picks from it', () => {
		const p = new Picker();
		p.click(click({ ctrlKey: true }), 'd', ORDER, 'b');
		expect(p.ordered(ORDER)).toEqual(['b', 'd']);
		p.clear();
		p.click(click({ shiftKey: true }), 'c', ORDER, 'a');
		expect(p.ordered(ORDER)).toEqual(['a', 'b', 'c']);
	});

	it('touch: a tap opens; a long press starts the selection mode, taps then pick until none is left', () => {
		const p = new Picker();
		p.pointerdown({ pointerType: 'touch' } as PointerEvent);
		expect(p.click(click(), 'a', ORDER)).toBe('open');
		p.menu(click({ type: 'contextmenu' } as Partial<MouseEvent>), 'b');
		expect(p.marking).toBe(true);
		expect(p.click(click(), 'c', ORDER)).toBe('picked');
		expect(p.ordered(ORDER)).toEqual(['b', 'c']);
		p.click(click(), 'b', ORDER);
		p.click(click(), 'c', ORDER);
		expect(p.marking).toBe(false);
		expect(p.click(click(), 'a', ORDER)).toBe('open');
	});

	it('Shift+arrow grows and shrinks from the anchor', () => {
		const p = new Picker();
		p.click(click(), 'b', ORDER);
		p.extend('d', ORDER);
		p.extend('c', ORDER);
		expect(p.ordered(ORDER)).toEqual(['b', 'c']);
		p.extend('a', ORDER);
		expect(p.ordered(ORDER)).toEqual(['a', 'b']);
	});
});
