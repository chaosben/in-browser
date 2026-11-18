// Drawable state of one page: its items (strokes, shapes, pictures) in draw order, ink outlines (Path2D, computed once)
// and a grid index.

import { isInk, isShape, type Ink, type Item, type PageContent, type ShapeItem } from '#lib/model/types.js';
import { GridIndex, itemBounds, type Box } from '#lib/ink/geometry.js';
import { inkAlpha, inkPath } from '#lib/ink/outline.js';
import { fillOutline } from '#lib/ink/shapes.js';
import { drawPicture, type PictureSource } from './pictures.js';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class PageScene {
	readonly items: Item[] = [];
	private readonly paths = new Map<string, Path2D>();
	private readonly order = new Map<string, number>();
	private next = 0;
	readonly index = new GridIndex<Item>(64);

	constructor(
		content?: PageContent,
		/** Decoded pictures (shared by the notebook's pages) */
		readonly pictures: PictureSource | null = null
	) {
		if (content) for (const s of content.items) this.add(s);
	}

	add(s: Item, at = this.items.length) {
		this.items.splice(at, 0, s);
		// Draw order: an item put back by undo keeps its place
		this.order.set(s.id, at === this.items.length - 1 ? this.next++ : this.orderAt(at));
		this.index.add(s, itemBounds(s));
	}

	private orderAt(at: number): number {
		const before = at > 0 ? this.order.get(this.items[at - 1].id)! : -1;
		const after = at < this.items.length - 1 ? this.order.get(this.items[at + 1].id)! : before + 2;
		return (before + after) / 2;
	}

	remove(s: Item): number {
		const at = this.items.indexOf(s);
		if (at < 0) return -1;
		this.items.splice(at, 1);
		this.index.remove(s);
		this.paths.delete(s.id);
		this.order.delete(s.id);
		return at;
	}

	bounds(s: Item): Box {
		return this.index.box(s.id) ?? itemBounds(s);
	}

	path(s: Ink): Path2D {
		let path = this.paths.get(s.id);
		if (!path) this.paths.set(s.id, (path = inkPath(s)));
		return path;
	}

	/** Items touching `box`, in draw order */
	itemsIn(box: Box): Item[] {
		return [...this.index.query(box)].sort((a, b) => this.order.get(a.id)! - this.order.get(b.id)!);
	}

	/** Draws items (page points; the context's transform maps them) */
	draw(ctx: Ctx, items: Iterable<Item>) {
		for (const s of items) {
			if (isInk(s)) drawInk(ctx, s, this.path(s));
			else drawPicture(ctx, s, this.pictures);
		}
	}
}

const fills = new WeakMap<ShapeItem, Path2D | null>();

/** Area of a filled shape (computed once per object), null without fill */
function fillPath(s: ShapeItem): Path2D | null {
	let path = fills.get(s);
	if (path === undefined) {
		const outline = fillOutline(s);
		if (outline) {
			path = new Path2D();
			path.moveTo(outline[0], outline[1]);
			for (let i = 2; i < outline.length; i += 2) path.lineTo(outline[i], outline[i + 1]);
			path.closePath();
		} else path = null;
		fills.set(s, path);
	}
	return path;
}

/** Draws a stroke or shape (`path`: its outline, `inkPath`); a shape's fill goes under it */
export function drawInk(ctx: Ctx, s: Ink, path: Path2D) {
	if (isShape(s) && s.fill) {
		const fill = fillPath(s);
		if (fill) {
			ctx.fillStyle = s.fill;
			ctx.fill(fill);
		}
	}
	ctx.fillStyle = s.color;
	if (!isShape(s) && s.tool === 'highlighter') {
		// Multiply: text and lines below stay readable, overlapping marker parts don't get darker
		ctx.globalCompositeOperation = 'multiply';
		ctx.globalAlpha = inkAlpha('highlighter');
		ctx.fill(path);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
	} else {
		ctx.fill(path);
	}
}
