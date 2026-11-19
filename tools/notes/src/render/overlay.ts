// Drawing of the stage's overlay canvas (lasso loop, selection frame, snap guides, laser pointer). Plain functions:
// the stage passes what they need, once per frame.

import { toMm } from '#lib/ink/align.js';
import { inkPath } from '#lib/ink/outline.js';
import type { Transform } from '#lib/ink/lasso.js';
import type { Guides, Rect } from '@in-browser/graphics/snap.js';
import { isPicture, type Ink, type Item } from '#lib/model/types.js';
import { drawPicture, type PictureSource } from './pictures.js';
import { drawInk } from './scene.js';
import type { PageRect, Viewport } from './viewport.js';

/** Laser pointer: points fade out after this time */
const LASER_MS = 1200;

/** A laser point in document coordinates, with the time it was added */
export interface LaserPoint {
	x: number;
	y: number;
	t: number;
}

/** Screen box (CSS pixels) */
export interface ScreenRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Items taken out of a page while dragged, moved/scaled by `t` as they will be put back. `paths` caches their ink
 * outlines across frames.
 */
export function drawLifted(
	ctx: CanvasRenderingContext2D,
	view: Viewport,
	rect: PageRect,
	t: Transform,
	items: Item[],
	pictures: PictureSource | null,
	paths: WeakMap<Ink, Path2D>
) {
	const k = view.zoom;
	ctx.save();
	ctx.translate((rect.x - view.x) * k, (rect.y - view.y) * k);
	ctx.scale(k, k);
	ctx.translate(t.ox + t.dx, t.oy + t.dy);
	ctx.scale(t.scale, t.scale);
	ctx.translate(-t.ox, -t.oy);
	for (const item of items) {
		if (isPicture(item)) {
			drawPicture(ctx, item, pictures);
			continue;
		}
		let path = paths.get(item);
		if (!path) paths.set(item, (path = inkPath(item)));
		drawInk(ctx, item, path);
	}
	ctx.restore();
}

/** Dashed frame around the selection with its handles: the corners, or `points` of a single shape */
export function drawSelectionFrame(ctx: CanvasRenderingContext2D, r: ScreenRect, points: [number, number][] | null, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([6, 4]);
	ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
	ctx.setLineDash([]);
	ctx.fillStyle = '#ffffff';
	const handles = points ?? [
		[r.x - 4, r.y - 4],
		[r.x + r.w + 4, r.y - 4],
		[r.x + r.w + 4, r.y + r.h + 4],
		[r.x - 4, r.y + r.h + 4]
	];
	for (const [x, y] of handles) {
		ctx.beginPath();
		ctx.arc(x, y, 6, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
}

/** Snap lines across the page, equal gaps with their size, outlines of what is snapped to */
export function drawGuides(
	ctx: CanvasRenderingContext2D,
	view: Viewport,
	rect: PageRect,
	guides: Guides,
	boxes: Rect[],
	colors: { guide: string; text: string }
) {
	const sx = (x: number) => view.toScreenX(rect.x + x);
	const sy = (y: number) => view.toScreenY(rect.y + y);
	ctx.save();
	ctx.strokeStyle = colors.guide;
	ctx.lineWidth = 1;
	ctx.beginPath();
	if (guides.x) {
		const x = Math.round(sx(guides.x.at)) + 0.5;
		ctx.moveTo(x, sy(0));
		ctx.lineTo(x, sy(rect.h));
	}
	if (guides.y) {
		const y = Math.round(sy(guides.y.at)) + 0.5;
		ctx.moveTo(sx(0), y);
		ctx.lineTo(sx(rect.w), y);
	}
	for (const box of new Set([guides.x?.box, guides.y?.box])) {
		if (box == null || !boxes[box]) continue;
		const b = boxes[box];
		ctx.rect(sx(b.x), sy(b.y), sx(b.x + b.w) - sx(b.x), sy(b.y + b.h) - sy(b.y));
	}
	ctx.stroke();
	// Equal gaps: a measure with end ticks and its length
	ctx.font = '10px system-ui, sans-serif';
	ctx.textBaseline = 'middle';
	for (const gap of guides.gaps) {
		const along = gap.axis === 'x';
		const [a, b, c] = along ? [sx(gap.from), sx(gap.to), sy(gap.at)] : [sy(gap.from), sy(gap.to), sx(gap.at)];
		ctx.beginPath();
		const line = (x0: number, y0: number, x1: number, y1: number) => {
			if (along) {
				ctx.moveTo(x0, y0);
				ctx.lineTo(x1, y1);
			} else {
				ctx.moveTo(y0, x0);
				ctx.lineTo(y1, x1);
			}
		};
		line(a, c, b, c);
		line(a, c - 4, a, c + 4);
		line(b, c - 4, b, c + 4);
		ctx.stroke();
		const label = `${toMm(gap.to - gap.from)} mm`;
		const w = ctx.measureText(label).width + 6;
		const [lx, ly] = along ? [(a + b) / 2 - w / 2, c + 6] : [c + 6, (a + b) / 2 - 8];
		ctx.fillStyle = colors.guide;
		ctx.beginPath();
		ctx.roundRect(lx, ly, w, 16, 3);
		ctx.fill();
		ctx.fillStyle = colors.text;
		ctx.fillText(label, lx + 3, ly + 8);
	}
	ctx.restore();
}

/** Lasso loop (screen points as x, y pairs) */
export function drawLasso(ctx: CanvasRenderingContext2D, points: number[], color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([5, 5]);
	ctx.beginPath();
	ctx.moveTo(points[0], points[1]);
	for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
	ctx.closePath();
	ctx.stroke();
	ctx.setLineDash([]);
}

/** Laser trail, fading out; the points still visible (none left: no further frames needed) */
export function drawLaser(ctx: CanvasRenderingContext2D, view: Viewport, laser: LaserPoint[]): LaserPoint[] {
	const now = performance.now();
	const points = laser.filter((p) => now - p.t < LASER_MS);
	if (!points.length) return points;
	ctx.strokeStyle = '#ef4444';
	ctx.shadowColor = '#ef4444';
	ctx.shadowBlur = 8;
	ctx.lineWidth = 4;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		// A new stroke starts after a pause
		if (b.t - a.t > 200) continue;
		ctx.globalAlpha = Math.max(0, 1 - (now - b.t) / LASER_MS);
		ctx.beginPath();
		ctx.moveTo(view.toScreenX(a.x), view.toScreenY(a.y));
		ctx.lineTo(view.toScreenX(b.x), view.toScreenY(b.y));
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.shadowBlur = 0;
	return points;
}
