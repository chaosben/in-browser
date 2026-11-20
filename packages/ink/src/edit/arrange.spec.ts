import { describe, expect, it } from 'vitest';
import type { ItemKit } from '../render/kit.js';
import { PageScene } from '../render/scene.js';
import { ItemEditor, type Command } from './items.js';

interface BoxItem {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

const kit = {
	bounds: (i: BoxItem) => ({ x0: i.x, y0: i.y, x1: i.x + i.w, y1: i.y + i.h }),
	snapBox: (i: BoxItem) => ({ x: i.x, y: i.y, w: i.w, h: i.h }),
	transform: (i: BoxItem, t: { dx: number; dy: number }) => ({ ...i, x: i.x + t.dx, y: i.y + t.dy })
} as unknown as ItemKit<BoxItem>;

function setup(items: BoxItem[]) {
	const scene = new PageScene(kit, items);
	const history: Command[] = [];
	const editor = new ItemEditor<BoxItem>(
		{ pages: [{ id: 'p', w: 500, h: 500 }], scene: () => scene, push: (c) => history.push(c), touch: () => {}, committed: () => {}, region: () => {} },
		kit
	);
	const at = (id: string) => scene.items.find((i) => i.id === id)!;
	return { scene, history, editor, at };
}

const items = (): BoxItem[] => [
	{ id: 'a', x: 10, y: 10, w: 20, h: 10 },
	{ id: 'b', x: 50, y: 40, w: 40, h: 20 },
	{ id: 'c', x: 200, y: 5, w: 10, h: 30 }
];

describe('ItemEditor arranging', () => {
	it('reorders as one undo step', () => {
		const { scene, history, editor } = setup(items());
		editor.reorder(0, new Set(['a']), 'front');
		expect(scene.items.map((i) => i.id).join('')).toBe('bca');
		history[0].undo();
		expect(scene.items.map((i) => i.id).join('')).toBe('abc');
		history[0].redo();
		expect(scene.items.map((i) => i.id).join('')).toBe('bca');
		editor.reorder(0, new Set(['a']), 'front');
		expect(history).toHaveLength(1);
	});

	it('aligns with the edges and middles of the box around all', () => {
		const { editor, at, history } = setup(items());
		const all = new Set(['a', 'b', 'c']);
		editor.align(0, all, 'right');
		expect([at('a').x + at('a').w, at('b').x + at('b').w, at('c').x + at('c').w]).toEqual([210, 210, 210]);
		editor.align(0, all, 'middle');
		// The box runs from 5 to 60: middles at 32.5
		expect([at('a').y, at('b').y, at('c').y]).toEqual([27.5, 22.5, 17.5]);
		expect(history).toHaveLength(2);
		history[1].undo();
		expect(at('a').y).toBe(10);
	});

	it('spreads three or more with equal gaps', () => {
		const { editor, at } = setup(items());
		editor.distribute(0, new Set(['a', 'b', 'c']), 'x');
		// From 10 to 210, boxes 20 + 40 + 10 wide: gaps of 65
		expect([at('a').x, at('b').x, at('c').x]).toEqual([10, 95, 200]);
		const { editor: two, history } = setup(items());
		two.distribute(0, new Set(['a', 'b']), 'x');
		expect(history).toHaveLength(0);
	});
});
