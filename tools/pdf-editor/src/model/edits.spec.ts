import { describe, expect, it } from 'vitest';
import { applyOp, History, invert, movePages, normalizeAngle, type Op } from './edits';

const at = (...angles: number[]) => angles.map((rotate, i) => ({ id: `p${i}`, rotate }));

describe('edits', () => {
	it('turns the named pages and keeps the angle in 0…270', () => {
		expect(applyOp(at(0, 90, 270), { kind: 'rotate', pages: ['p0', 'p2'], by: 90 })).toEqual([90, 90, 0]);
		expect(applyOp(at(0), { kind: 'rotate', pages: ['p0'], by: -90 })).toEqual([270]);
		expect(applyOp(at(0), { kind: 'rotate', pages: ['p5'], by: 90 })).toEqual([0]);
		expect(normalizeAngle(-450)).toBe(270);
	});

	it('undoing a step gives the state before it', () => {
		const op: Op = { kind: 'rotate', pages: ['p1'], by: 90 };
		const before = at(0, 180);
		const turned = applyOp(before, op).map((rotate, i) => ({ id: `p${i}`, rotate }));
		expect(applyOp(turned, invert(op))).toEqual([0, 180]);
	});

	it('moves pages before the one at a place, keeping their order', () => {
		const pages = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
		const ids = (list: { id: string }[]) => list.map((p) => p.id).join('');
		expect(ids(movePages(pages, new Set(['b', 'd']), 0))).toBe('bdace');
		expect(ids(movePages(pages, new Set(['a']), 5))).toBe('bcdea');
		expect(ids(movePages(pages, new Set(['a', 'b']), 3))).toBe('cabde');
		expect(ids(movePages(pages, new Set(['c']), 2))).toBe('abcde');
	});

	it('undoes and redoes in order; a new step drops what could be redone', () => {
		const history = new History();
		const log: string[] = [];
		const step = (name: string) => ({ undo: () => log.push(`undo ${name}`), redo: () => log.push(`redo ${name}`) });
		history.push(step('a'));
		history.push(step('b'));
		expect(history.undo()).toBe(true);
		expect(history.canRedo).toBe(true);
		expect(history.redo()).toBe(true);
		history.undo();
		history.push(step('c'));
		expect(history.canRedo).toBe(false);
		history.undo();
		history.undo();
		expect(history.undo()).toBe(false);
		expect(log).toEqual(['undo b', 'redo b', 'undo b', 'undo c', 'undo a']);
	});
});
