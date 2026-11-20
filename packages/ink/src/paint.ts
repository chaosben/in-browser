// Strokes and shapes as plain vector paint, for writing them into documents (PDF export, PDF annotations): the same
// shape as on screen (`outline.ts`) – lines with round caps and joins, one run per width – and shape fills under them.
// Coordinates in page points (y down), rounded to 0.01 pt.

import type { Ink, Stroke } from './items.js';
import { isShape } from './items.js';
import { diameter, inkAlpha } from './outline.js';
import { fillOutline, inkStrokes } from './shapes.js';

/** The area of a filled shape */
export interface FillPaint {
	kind: 'fill';
	/** `#rrggbb` */
	color: string;
	/** 0…1 */
	alpha: number;
	/** Closed polygon, x/y pairs */
	outline: number[];
}

/** A pen line: runs of equal width, each a polyline (x/y pairs) drawn with round caps and joins */
export interface LinePaint {
	kind: 'line';
	/** `#rrggbb` */
	color: string;
	/** Drawn multiplied */
	highlighter: boolean;
	/** Opacity of the whole line (`inkAlpha`): drawn as one group, so its overlapping runs don't get darker */
	alpha: number;
	runs: { width: number; points: number[] }[];
}

export type Paint = FillPaint | LinePaint;

const round = (n: number) => Math.round(n * 100) / 100;

/** How a stroke or shape is painted, bottom first (a shape's fill under its lines) */
export function paintOf(item: Ink): Paint[] {
	const paint: Paint[] = [];
	if (isShape(item) && item.fill) {
		const outline = fillOutline(item);
		if (outline) {
			paint.push({
				kind: 'fill',
				color: item.fill.slice(0, 7),
				alpha: item.fill.length === 9 ? Math.round((parseInt(item.fill.slice(7, 9), 16) / 255) * 100) / 100 : 1,
				outline: Array.from(outline, round)
			});
		}
	}
	for (const s of inkStrokes(item)) paint.push(linePaint(s));
	return paint;
}

/** A pen line: the first point is a dot (a line of no length with round caps); then one run per width */
function linePaint(s: Stroke): LinePaint {
	const pts = s.points;
	let width = round(diameter(s.tool, s.size, pts[2]));
	let run = { width, points: [round(pts[0]), round(pts[1]), round(pts[0]), round(pts[1])] };
	const runs = [run];
	for (let i = 3; i < pts.length; i += 3) {
		const w = round(diameter(s.tool, s.size, pts[i + 2]));
		if (w !== width) {
			run = { width: w, points: [round(pts[i - 3]), round(pts[i - 2])] };
			runs.push(run);
			width = w;
		}
		run.points.push(round(pts[i]), round(pts[i + 1]));
	}
	return { kind: 'line', color: s.color.slice(0, 7), highlighter: s.tool === 'highlighter', alpha: Math.round(inkAlpha(s.tool, s.color) * 100) / 100, runs };
}
