// Raster cache of the pages: square tiles of TILE device pixels at a fixed scale (device pixels per point). A tile is
// rendered once (paper, PDF page, items from the grid index) and then only copied to the screen; panning and zooming never
// re-render strokes. A new stroke is drawn into the cached tiles it touches; erasing re-renders only those tiles.
// Tiles of a former scale stay as a stretched fallback until the sharp ones are there; least recently used go first.

import type { Stroke } from '#lib/model/types.js';
import type { Box } from '#lib/ink/geometry.js';
import type { Piece } from './backgrounds.js';
import { drawPaper } from './paper.js';
import { drawStroke, type PageScene } from './scene.js';
import type { Paper } from '#lib/model/types.js';

export const TILE = 512;

export interface TilePage {
	id: string;
	w: number;
	h: number;
	paper: Paper;
	/** null while the page content is loading: only the paper is drawn, the tile is not kept */
	scene: PageScene | null;
	/** The PDF page under it, piece by piece (null while nothing of it is rendered yet: no tile) */
	pdf?: ((scale: number, tx: number, ty: number) => Piece | null) | null;
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

export class TileCache {
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

	/**
	 * Renders a tile (or re-renders it in place) and keeps it if the page content is there. Null while its piece of
	 * a PDF page is not rendered yet (the caller shows what it has meanwhile).
	 */
	render(page: TilePage, scale: number, tx: number, ty: number): Tile | null {
		const background = page.pdf ? page.pdf(scale, tx, ty) : null;
		if (page.pdf && !background) return null;
		const key = this.key(page.id, scale, tx, ty);
		let tile = this.tiles.get(key);
		if (!tile) {
			tile = { canvas: this.spare.pop() ?? new OffscreenCanvas(TILE, TILE), page: page.id, scale, tx, ty, used: 0, exact: true };
		}
		tile.exact = background?.exact ?? true;
		tile.used = ++this.clock;
		const ctx = tile.canvas.getContext('2d')!;
		const box = tileBox(scale, tx, ty);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, TILE, TILE);
		ctx.setTransform(scale, 0, 0, scale, -box.x0 * scale, -box.y0 * scale);
		drawPaper(ctx, page.paper, page.w, page.h, box, scale);
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
			ctx.rect(0, 0, page.w, page.h);
			ctx.clip();
			page.scene.draw(ctx, page.scene.itemsIn(box));
			ctx.restore();
			this.tiles.set(key, tile);
		}
		return tile;
	}

	/** Draws a new stroke into every cached tile of the page it touches (all scales) */
	drawStroke(page: string, scene: PageScene, s: Stroke, box: Box) {
		for (const tile of this.tiles.values()) {
			if (tile.page !== page) continue;
			const t = tileBox(tile.scale, tile.tx, tile.ty);
			if (box.x1 < t.x0 || box.x0 > t.x1 || box.y1 < t.y0 || box.y0 > t.y1) continue;
			const ctx = tile.canvas.getContext('2d')!;
			ctx.setTransform(tile.scale, 0, 0, tile.scale, -t.x0 * tile.scale, -t.y0 * tile.scale);
			drawStroke(ctx, s, scene.path(s));
		}
	}

	/** Re-renders the cached tiles of a page that touch `box` at `scale`; drops those of other scales */
	refresh(page: TilePage, box: Box | null, scale: number) {
		for (const [key, tile] of this.tiles) {
			if (tile.page !== page.id) continue;
			if (box) {
				const t = tileBox(tile.scale, tile.tx, tile.ty);
				if (box.x1 < t.x0 || box.x0 > t.x1 || box.y1 < t.y0 || box.y0 > t.y1) continue;
			}
			if (tile.scale !== scale || !this.render(page, scale, tile.tx, tile.ty)) this.drop(key, tile);
		}
	}

	/** Tiles showing a preview of their PDF page */
	*inexact(): Generator<Tile> {
		for (const tile of this.tiles.values()) if (!tile.exact) yield tile;
	}

	/** Forgets all tiles of a page (e.g. new paper) or of all pages */
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
