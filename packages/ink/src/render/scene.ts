// Drawable state of one page: its items in draw order, their outlines (Path2D, computed once) and a grid index.
// What an item is and how it is drawn comes from the tool's `ItemKit`.

import { GridIndex, type Box } from '../geometry.js';
import type { Ctx, DrawContext, ItemKit, SceneItem } from './kit.js';

export class PageScene<I extends SceneItem> implements DrawContext {
	readonly items: I[] = [];
	private readonly paths = new Map<string, Path2D>();
	private readonly order = new Map<string, number>();
	private next = 0;
	readonly index = new GridIndex<I>(64);

	constructor(
		readonly kit: ItemKit<I>,
		items?: Iterable<I>
	) {
		if (items) for (const s of items) this.add(s);
	}

	add(s: I, at = this.items.length) {
		this.items.splice(at, 0, s);
		// Draw order: an item put back by undo keeps its place
		this.order.set(s.id, at === this.items.length - 1 ? this.next++ : this.orderAt(at));
		this.index.add(s, this.kit.bounds(s));
	}

	private orderAt(at: number): number {
		const before = at > 0 ? this.order.get(this.items[at - 1].id)! : -1;
		const after = at < this.items.length - 1 ? this.order.get(this.items[at + 1].id)! : before + 2;
		return (before + after) / 2;
	}

	remove(s: I): number {
		const at = this.items.indexOf(s);
		if (at < 0) return -1;
		this.items.splice(at, 1);
		this.index.remove(s);
		this.paths.delete(s.id);
		this.order.delete(s.id);
		return at;
	}

	bounds(s: I): Box {
		return this.index.box(s.id) ?? this.kit.bounds(s);
	}

	/** The outline of an item, built once while it is on the page */
	path<T extends SceneItem>(s: T, build: (item: T) => Path2D): Path2D {
		let path = this.paths.get(s.id);
		if (!path) this.paths.set(s.id, (path = build(s)));
		return path;
	}

	/** Items touching `box`, in draw order */
	itemsIn(box: Box): I[] {
		return [...this.index.query(box)].sort((a, b) => this.order.get(a.id)! - this.order.get(b.id)!);
	}

	/** Draws items (page points; the context's transform maps them) */
	draw(ctx: Ctx, items: Iterable<I>) {
		for (const s of items) this.kit.draw(ctx, s, this);
	}
}
