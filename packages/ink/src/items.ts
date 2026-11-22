// What lies on a page, in page points (1/72 inch) with the origin at the page's top left: pen strokes and shapes.
// Shared by every tool that draws with the ink core (the PDF Editor); a tool adds its own kinds next to them.

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
	/** The outline of a closed shape as a cloud */
	cloud?: true;
	/** The shape measures: what, and the scale and unit of the plan it lies on (1 on paper is `scale` in reality).
	 * The tool using the core draws the number (the PDF Editor) */
	measure?: { kind: MeasureKind; scale: number; unit: MeasureUnit };
}

export type MeasureKind = 'distance' | 'perimeter' | 'area';
export type MeasureUnit = 'mm' | 'cm' | 'm' | 'in' | 'pt';

/** Everything on a page, in draw order (later on top) */
export type Item = Stroke | ShapeItem;

/** What is drawn with a pen: erasable, drawn as strokes (`inkStrokes` in `shapes.ts`) */
export type Ink = Stroke | ShapeItem;

// Stroke and shape guards also take items of other kinds (a tool's own items next to these, e.g. PDF annotations)
export const isStroke = <T extends { readonly id: string }>(item: T): item is T & Stroke => 'points' in item;
export const isShape = <T extends { readonly id: string }>(item: T): item is T & ShapeItem => 'type' in item && item.type === 'shape';
export const isInk = <T extends { readonly id: string }>(item: T): item is T & Ink => isStroke(item) || isShape(item);
