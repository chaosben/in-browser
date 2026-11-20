// Raster cache of the pages: square tiles of TILE device pixels at a fixed scale (device pixels per point). A tile is
// rendered once (the page's backdrop – paper, PDF page –, items from the grid index) and then only copied to the screen; panning and zooming never
// re-render strokes. A new stroke is drawn into the cached tiles it touches; erasing re-renders only those tiles.
// Tiles of a former scale stay as a stretched fallback until the sharp ones are there; least recently used go first.

import type { Box } from '../geometry.js';
import type { Backdrop, SceneItem, SurfacePage } from './kit.js';
import type { PageScene } from './scene.js';

export const TILE = 512;

export interface TilePage<P extends SurfacePage, I extends SceneItem> {
	meta: P;
	/** null while the page content is loading: only the backdrop is drawn, the tile is not kept */
	scene: PageScene<I> | null;
}

export interface Tile {
	canvas: OffscreenCanvas;
	page: string;
	scale: number;
	tx: number;
	ty: number;
	used: number;
	/** Shows a stretched preview of its PDF page: rendered again once the sharp piece is there */
	exact: boolean;
}

/** Region of a tile in page points */
export function tileBox(scale: number, tx: number, ty: number): Box {
	const size = TILE / scale;
	return { x0: tx * size, y0: ty * size, x1: (tx + 1) * size, y1: (ty + 1) * size };
}

/** Tile indices covering a page region at `scale` */
export function tileRange(scale: number, box: Box) {
	const size = TILE / scale;
	return {
		tx0: Math.max(0, Math.floor(box.x0 / size)),
		ty0: Math.max(0, Math.floor(box.y0 / size)),
		tx1: Math.max(0, Math.ceil(box.x1 / size) - 1),
		ty1: Math.max(0, Math.ceil(box.y1 / size) - 1)
	};
}

export class TileCache<P extends SurfacePage, I extends SceneItem> {
	private tiles = new Map<string, Tile>();
	private spare: OffscreenCanvas[] = [];
	private clock = 0;
	/** Upper limit of kept tiles (about 1 MB each) */
	max = 64;

	private key = (page: string, scale: number, tx: number, ty: number) => `${page}|${scale}|${tx}|${ty}`;

	get(page: string, scale: number, tx: number, ty: number): Tile | undefined {
		const tile = this.tiles.get(this.key(page, scale, tx, ty));
		if (tile) tile.used = ++this.clock;
		return tile;
	}

	constructor(private readonly backdrop: Backdrop<P>) {}

	/**
	 * Renders a tile (or re-renders it in place) and keeps it if the page content is there. Null while its piece of
	 * the backdrop is not rendered yet (the caller shows what it has meanwhile).
	 */
	render(page: TilePage<P, I>, scale: number, tx: number, ty: number): Tile | null {
		const { meta } = page;
		const background = this.backdrop.piece(meta, scale, tx, ty);
		if (background === null) return null;
		const key = this.key(meta.id, scale, tx, ty);
		let tile = this.tiles.get(key);
		if (!tile) {
			tile = { canvas: this.spare.pop() ?? new OffscreenCanvas(TILE, TILE), page: meta.id, scale, tx, ty, used: 0, exact: true };
		}
		tile.exact = background?.exact ?? true;
		tile.used = ++this.clock;
		const ctx = tile.canvas.getContext('2d')!;
		const box = tileBox(scale, tx, ty);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, TILE, TILE);
		ctx.setTransform(scale, 0, 0, scale, -box.x0 * scale, -box.y0 * scale);
		this.backdrop.paint(ctx, meta, box, scale);
		if (background) {
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(background.image, background.sx, background.sy, background.sw, background.sh, 0, 0, TILE, TILE);
			ctx.restore();
		}
		if (page.scene) {
			// Ink stays on the page
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, meta.w, meta.h);
			ctx.clip();
			page.scene.draw(ctx, page.scene.itemsIn(box));
			ctx.restore();
			this.tiles.set(key, tile);
		}
		return tile;
	}

	/** Draws a new item into every cached tile of the page it touches (all scales) */
	drawItem(page: string, scene: PageScene<I>, s: I, box: Box) {
		for (const tile of this.tiles.values()) {
			if (tile.page !== page) continue;
			const t = tileBox(tile.scale, tile.tx, tile.ty);
			if (box.x1 < t.x0 || box.x0 > t.x1 || box.y1 < t.y0 || box.y0 > t.y1) continue;
			const ctx = tile.canvas.getContext('2d')!;
			ctx.setTransform(tile.scale, 0, 0, tile.scale, -t.x0 * tile.scale, -t.y0 * tile.scale);
			scene.kit.draw(ctx, s, scene);
		}
	}

	/** Re-renders the cached tiles of a page that touch `box` at `scale`; drops those of other scales */
	refresh(page: TilePage<P, I>, box: Box | null, scale: number) {
		for (const [key, tile] of this.tiles) {
			if (tile.page !== page.meta.id) continue;
			if (box) {
				const t = tileBox(tile.scale, tile.tx, tile.ty);
				if (box.x1 < t.x0 || box.x0 > t.x1 || box.y1 < t.y0 || box.y0 > t.y1) continue;
			}
			if (tile.scale !== scale || !this.render(page, scale, tile.tx, tile.ty)) this.drop(key, tile);
		}
	}

	/** Tiles showing a preview of their backdrop */
	*inexact(): Generator<Tile> {
		for (const tile of this.tiles.values()) if (!tile.exact) yield tile;
	}

	/** A page's backdrop changes: its tiles stay shown, and are rendered again once it is there (`inexact`) */
	outdate(page: string) {
		for (const tile of this.tiles.values()) if (tile.page === page) tile.exact = false;
	}

	/** Forgets all tiles of a page (e.g. another backdrop) or of all pages */
	clear(page?: string) {
		for (const [key, tile] of this.tiles) if (!page || tile.page === page) this.drop(key, tile);
	}

	private drop(key: string, tile: Tile) {
		this.tiles.delete(key);
		if (this.spare.length < 8) this.spare.push(tile.canvas);
	}

	/** Removes the least recently used tiles beyond the limit */
	trim() {
		if (this.tiles.size <= this.max) return;
		const byAge = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used);
		for (const [key, tile] of byAge.slice(0, this.tiles.size - this.max)) this.drop(key, tile);
	}

	/** Cached tiles of a page at another scale than `scale` that overlap `box` (for a stretched fallback) */
	*fallbacks(page: string, scale: number, box: Box): Generator<Tile> {
		for (const tile of this.tiles.values()) {
			if (tile.page !== page || tile.scale === scale) continue;
			const t = tileBox(tile.scale, tile.tx, tile.ty);
			if (box.x1 < t.x0 || box.x0 > t.x1 || box.y1 < t.y0 || box.y0 > t.y1) continue;
			yield tile;
		}
	}

	get size() {
		return this.tiles.size;
	}
}
