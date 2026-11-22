// Measuring: a line, an open path or a polygon that says how long or how large it is – the distance between two
// points, the length of a path, the area inside an outline. The number follows the shape (moved points measure
// anew) and the scale of the plan the PDF shows (`scale`: 1 on paper is that much in reality).

import type { Box } from '@in-browser/ink/geometry.js';
import type { MeasureKind, MeasureUnit, ShapeItem } from '@in-browser/ink/items.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';
import { intlLocale } from '#lib/i18n/index.js';
import { fontOf, textWidth } from './textbox.js';

export const MEASURE_UNITS: readonly MeasureUnit[] = ['mm', 'cm', 'm', 'in', 'pt'];
/** How many of a unit one millimeter is */
const PER_MM: Record<MeasureUnit, number> = { mm: 1, cm: 0.1, m: 0.001, in: 1 / 25.4, pt: 72 / 25.4 };
const MM_PER_POINT = 25.4 / 72;

/** How many of `unit` in reality one point on the page is, at a scale of 1 : `scale` */
export const unitsPerPoint = (scale: number, unit: MeasureUnit) => MM_PER_POINT * scale * PER_MM[unit];

export type Measured = ShapeItem & { measure: NonNullable<ShapeItem['measure']> };
export const isMeasured = (item: { readonly id: string }): item is Measured => (item as ShapeItem).type === 'shape' && !!(item as ShapeItem).measure;

/** The corners of a measured shape (x, y pairs) */
function corners(item: ShapeItem): number[] {
	const fit = item.fit;
	if (fit.kind === 'line') return [fit.x0, fit.y0, fit.x1, fit.y1];
	if (fit.kind === 'polyline' || fit.kind === 'polygon') return fit.points;
	return [fit.x, fit.y, fit.x + fit.w, fit.y, fit.x + fit.w, fit.y + fit.h, fit.x, fit.y + fit.h];
}

/** Length of the path through the points (page points), back to the first one when `closed` */
export function pathLength(points: ArrayLike<number>, closed: boolean): number {
	let sum = 0;
	for (let i = 2; i < points.length; i += 2) sum += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
	if (closed && points.length >= 4) sum += Math.hypot(points[0] - points[points.length - 2], points[1] - points[points.length - 1]);
	return sum;
}

/** Area inside the outline through the points (square page points) */
export function polygonArea(points: ArrayLike<number>): number {
	let sum = 0;
	for (let i = 0; i < points.length; i += 2) {
		const j = (i + 2) % points.length;
		sum += points[i] * points[j + 1] - points[j] * points[i + 1];
	}
	return Math.abs(sum) / 2;
}

/** What a measured shape measures, in its unit (an area in square units) */
export function measuredValue(item: Measured): number {
	const points = corners(item);
	const k = unitsPerPoint(item.measure.scale, item.measure.unit);
	if (item.measure.kind === 'area') return polygonArea(points) * k * k;
	return pathLength(points, item.fit.kind !== 'line' && item.fit.kind !== 'polyline') * k;
}

const numbers = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2, useGrouping: false });

/** The number with its unit, as it stands at the shape ("12.5 m", "40 m²") */
export const measureText = (item: Measured): string => `${numbers.format(measuredValue(item))} ${item.measure.unit}${item.measure.kind === 'area' ? '²' : ''}`;

/** Font size of the number (points) */
const LABEL_SIZE = 9;

/** Where the number stands (page points as shown): its left end on the baseline – above the middle of a distance or
 * of a path's longest piece, in the middle of an area */
export function measureLabel(item: Measured): { text: string; x: number; y: number; w: number; size: number } {
	const text = measureText(item);
	const w = textWidth(text, LABEL_SIZE);
	const p = corners(item);
	if (item.measure.kind === 'area') {
		let [cx, cy] = [0, 0];
		for (let i = 0; i < p.length; i += 2) {
			cx += p[i];
			cy += p[i + 1];
		}
		const n = Math.max(1, p.length / 2);
		return { text, x: cx / n - w / 2, y: cy / n + LABEL_SIZE * 0.35, w, size: LABEL_SIZE };
	}
	let best = 0;
	let length = -1;
	for (let i = 2; i < p.length; i += 2) {
		const piece = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
		if (piece > length) [best, length] = [i, piece];
	}
	const [mx, my] = best ? [(p[best] + p[best - 2]) / 2, (p[best + 1] + p[best - 1]) / 2] : [p[0] ?? 0, p[1] ?? 0];
	return { text, x: mx - w / 2, y: my - item.size / 2 - 3, w, size: LABEL_SIZE };
}

/** The box the number takes (with the light edge around its letters) */
export function labelBox(item: Measured): Box {
	const l = measureLabel(item);
	return { x0: l.x - 2, y0: l.y - l.size - 1, x1: l.x + l.w + 2, y1: l.y + l.size * 0.3 + 1 };
}

/** Draws the number of a measured shape: in the shape's color, with a light edge so it reads on every page */
export function drawMeasure(ctx: Ctx, item: Measured) {
	const l = measureLabel(item);
	ctx.save();
	ctx.font = fontOf(l.size);
	ctx.textBaseline = 'alphabetic';
	ctx.lineJoin = 'round';
	ctx.lineWidth = 2;
	ctx.strokeStyle = '#ffffff';
	ctx.strokeText(l.text, l.x, l.y);
	ctx.fillStyle = item.color.slice(0, 7);
	ctx.fillText(l.text, l.x, l.y);
	ctx.restore();
}
