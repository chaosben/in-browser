// What lies on a page, in page points (1/72 inch) with the origin at the page's top left: pen strokes, shapes and
// pictures. Shared by every tool that draws with the ink core (Notes, PDF Editor); each tool stores them its own way.

import type { IconData } from '@in-browser/graphics/icons/types.js';
import type { Dash, ShapeFit } from './shapes.js';

export type InkTool = 'pen' | 'highlighter';

export interface Stroke {
	id: string;
	tool: InkTool;
	/** `#rrggbb` */
	color: string;
	/** Base diameter in points */
	size: number;
	/** x, y, pressure (0…1) per point */
	points: Float32Array;
}

/** A geometric shape (line, arrow, polygon, ellipse …), drawn like pen strokes along its outline (`inkStrokes`) */
export interface ShapeItem {
	id: string;
	type: 'shape';
	fit: ShapeFit;
	/** `#rrggbb` */
	color: string;
	/** Pen diameter in points */
	size: number;
	/** `#rrggbbaa` inside (closed shapes only); none when missing */
	fill?: string;
	/** Solid when missing */
	dash?: Exclude<Dash, 'solid'>;
	/** Hand-drawn instead of exact */
	sketch?: true;
}

/** A picture on a page: a box in page points (top left, size), drawn stretched into it */
interface PictureBase {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** An image file of the notebook (`assets/<asset>`) */
export interface ImageItem extends PictureBase {
	type: 'image';
	asset: string;
}

/** An icon: its SVG travels along (no icon set needed to show it), drawn in one color */
export interface IconItem extends PictureBase {
	type: 'icon';
	icon: IconData;
	/** `#rrggbb` */
	color: string;
}

export type Picture = ImageItem | IconItem;

/** Everything on a page, in draw order (later on top) */
export type Item = Stroke | ShapeItem | Picture;

/** What is drawn with a pen: erasable, drawn as strokes (`inkStrokes` in `shapes.ts`) */
export type Ink = Stroke | ShapeItem;

// Stroke and shape guards also take items of other kinds (a tool's own items next to these, e.g. PDF annotations)
export const isStroke = <T extends { readonly id: string }>(item: T): item is T & Stroke => 'points' in item;
export const isShape = <T extends { readonly id: string }>(item: T): item is T & ShapeItem => 'type' in item && item.type === 'shape';
export const isInk = <T extends { readonly id: string }>(item: T): item is T & Ink => isStroke(item) || isShape(item);
export const isPicture = (item: Item): item is Picture => !isInk(item);
