// What the surface (stage, tiles, scene, overlay) needs to know about a tool's pages and items. The tool describes
// its page look as a `Backdrop` and its items as an `ItemKit`; everything else is shared.

import type { Rect, SnapTargets } from '@in-browser/graphics/snap.js';
import type { Box } from '../geometry.js';
import type { Transform } from '../lasso.js';
import type { PictureSource } from './pictures.js';

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A page as the surface sees it: an id and its size in points */
export interface SurfacePage {
	readonly id: string;
	readonly w: number;
	readonly h: number;
}

/** Anything on a page */
export interface SceneItem {
	readonly id: string;
}

/** A part of a rendered image for a tile; `exact` false = a stretched preview (rendered again once sharp) */
export interface Piece {
	image: CanvasImageSource;
	sx: number;
	sy: number;
	sw: number;
	sh: number;
	exact: boolean;
}

/** What lies under the items of a page (paper, a PDF page) */
export interface Backdrop<P extends SurfacePage> {
	/** Color of a page until its tiles are there */
	readonly color: string;
	/** Compared when pages are set (never per frame): a change drops the page's tiles */
	key(page: P): string;
	/** Vector part in page points (the context maps them), clipped to `box` */
	paint(ctx: Ctx, page: P, box: Box, scale: number): void;
	/** Raster part for tile (tx, ty): undefined = none on this page, null = not there yet (the tile is not kept) */
	piece(page: P, scale: number, tx: number, ty: number): Piece | null | undefined;
	/** A new frame starts asking for pieces */
	frame?(): void;
	/** How many tiles' worth of raster parts to keep (follows the tile cache) */
	budget?(tiles: number): void;
}

/** Caches an item's outline while it is drawn repeatedly (tiles of a scene, the dragged selection) */
export interface DrawContext {
	path<T extends SceneItem>(item: T, build: (item: T) => Path2D): Path2D;
	readonly pictures: PictureSource | null;
}

/** Everything the surface asks of the items of a tool */
export interface ItemKit<I extends SceneItem> {
	/** Bounds in page points, including the pen width (index, culling, redraw regions) */
	bounds(item: I): Box;
	/** Draws an item in page points (the context's transform maps them) */
	draw(ctx: Ctx, item: I, cx: DrawContext): void;
	/** Is the item at (x, y) within `r` (page points)? Tapping to select */
	hit(item: I, x: number, y: number, r: number): boolean;
	/** Does an eraser circle at (x, y) with radius `r` touch it (its bounds already do)? Never true for what erasers leave alone */
	erases(item: I, x: number, y: number, r: number): boolean;
	/** Does a loop (page points, x/y pairs) select the item? */
	inLasso(item: I, poly: ArrayLike<number>): boolean;
	/** Geometric box (without pen width): what snaps when the item is moved */
	snapBox(item: I): Rect;
	/** Snap targets of a page: its frame and the items except `exclude` (with their ids, for the guides' marks) */
	targets(items: readonly I[], exclude: ReadonlySet<string>, w: number, h: number): SnapTargets;
	/** How a guide snapping to the item shows it: its kind's name and icon class or drawing (`GuideMark`) */
	mark?(item: I): ItemMark;
	/** The item's color (`#rrggbb`, or `#rrggbbaa` when its opacity can be chosen), or null if it can't be recolored */
	color(item: I): string | null;
	/** The item moved/scaled (a new object) */
	transform(item: I, t: Transform): I;
	/** Stays where it is (it belongs to the page's content, e.g. marked text): selected, recolored, reordered and
	 * deleted, never moved, scaled, aligned or duplicated (the rest of a selection is, around it) */
	fixed?(item: I): boolean;
	/** Points of a single selected item that are dragged instead of the corner handles (a shape's points, a text
	 * box's corners and sides); null: the corners scale it */
	handles?(item: I): [number, number][] | null;
	/** The item with handle `index` dragged to (x, y) (page points) */
	moveHandle?(item: I, index: number, x: number, y: number, o: HandleOptions): I;
	/** Sizes itself when scaled (a text box keeps its font unless `Transform.scaleText`): drawn as `transform` gives
	 * it while a selection is scaled, not stretched */
	ownScale?(item: I): boolean;
}

/** An item's kind as guides show it: name, and an icon class or a drawing (polyline points in 24 × 24) */
export interface ItemMark {
	name: string;
	icon?: string;
	glyph?: string;
}

/** Keys held while a handle is dragged */
export interface HandleOptions {
	/** Line ends snap to 15° steps (snapping on and the point on no guide) */
	snap: boolean;
	/** Shift: corners keep the proportions */
	keepAspect: boolean;
	/** K: scale the content too (a text box's font) */
	scaleText: boolean;
}
