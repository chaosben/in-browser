// The items of the ink core (strokes, shapes) for the surface: drawing, hit tests, erasing, snapping.

import { pageTargets, snapBox } from '../align.js';
import { hitsStroke, itemBounds } from '../geometry.js';
import { isInk, isShape, isStroke, type Ink, type Item, type ShapeItem } from '../items.js';
import { inLasso, pointInPolygon, transformItem } from '../lasso.js';
import { inkAlpha, inkColor, inkPath } from '../outline.js';
import { inkMessages } from '../i18n/index.svelte.js';
import { fillOutline, handlesOf, inkStrokes, moveHandle, shapePoints, type ShapeFit } from '../shapes.js';
import type { Ctx, ItemKit } from './kit.js';

export const inkKit: ItemKit<Item> = {
	bounds: itemBounds,
	draw(ctx, item, cx) {
		drawInk(ctx, item, cx.path(item, inkPath));
	},
	hit(item, x, y, r) {
		if (inkStrokes(item).some((piece) => hitsStroke(piece, x, y, r))) return true;
		const fill = isShape(item) && fillOutline(item);
		return !!fill && pointInPolygon(x, y, fill);
	},
	erases(item, x, y, r) {
		return inkStrokes(item).some((piece) => hitsStroke(piece, x, y, r));
	},
	inLasso,
	snapBox,
	targets: pageTargets,
	mark(item) {
		const t = inkMessages().tools;
		if (isShape(item)) return { name: shapeName(item.fit), glyph: fitGlyph(item.fit) };
		return { name: t.pen, icon: 'icon-[material-symbols-light--stylus-outline]' };
	},
	color: (item) => inkColor(isStroke(item) ? item.tool : 'pen', item.color),
	transform: transformItem,
	handles: (item) => (isShape(item) ? handlesOf(item.fit) : null),
	moveHandle: (item, index, x, y, o) => (isShape(item) ? { ...item, fit: moveHandle(item.fit, index, x, y, o.snap, o.keepAspect) } : item)
};

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
	// A `#rrggbbaa` color brings its opacity; the outline is one fill, so see-through ink is even
	ctx.fillStyle = s.color;
	if (!isShape(s) && s.tool === 'highlighter') {
		// Multiply: text and lines below stay readable, overlapping marker parts don't get darker
		ctx.globalCompositeOperation = 'multiply';
		if (s.color.length !== 9) ctx.globalAlpha = inkAlpha('highlighter');
		ctx.fill(path);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
	} else {
		ctx.fill(path);
	}
}

/** A shape's name as guides show it */
function shapeName(fit: ShapeFit): string {
	const t = inkMessages().tools;
	if (fit.kind === 'line') return fit.start && fit.end ? t.shapes.doubleArrow : fit.start || fit.end ? t.shapes.arrow : t.shapes.line;
	if (fit.kind === 'ellipse' || fit.kind === 'roundedRect' || fit.kind === 'polyline') return t.shapes[fit.kind];
	const p = fit.points;
	if (p.length === 6) return t.shapes.triangle;
	// Four corners on two x and two y values: a rectangle
	if (p.length === 8 && new Set([p[0], p[2], p[4], p[6]]).size === 2 && new Set([p[1], p[3], p[5], p[7]]).size === 2) return t.shapes.rect;
	return t.shapeName;
}

/** The shape itself, small: its outline fitted into a 24 × 24 box (polyline points, like `shapeGlyph`) */
function fitGlyph(fit: ShapeFit): string {
	const pts = shapePoints(fit, 1);
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (let i = 0; i < pts.length; i += 3) {
		x0 = Math.min(x0, pts[i]);
		x1 = Math.max(x1, pts[i]);
		y0 = Math.min(y0, pts[i + 1]);
		y1 = Math.max(y1, pts[i + 1]);
	}
	const k = 18 / Math.max(x1 - x0, y1 - y0, 1e-6);
	const ox = 12 - ((x0 + x1) / 2) * k;
	const oy = 12 - ((y0 + y1) / 2) * k;
	let points = '';
	for (let i = 0; i < pts.length; i += 3) points += `${(pts[i] * k + ox).toFixed(1)},${(pts[i + 1] * k + oy).toFixed(1)} `;
	return points.trim();
}
