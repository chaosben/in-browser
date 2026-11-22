// Drawing of the stage's overlay canvas (lasso loop, selection frame). Plain functions:
// the stage passes what they need, once per frame.

import type { Transform } from '../lasso.js';
import type { DrawContext, ItemKit, SceneItem } from './kit.js';
import type { PageRect, Viewport } from './viewport.js';

/** Screen box (CSS pixels) */
export interface ScreenRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Outlines of items while they are dragged (computed once per object) */
export class LiftedContext implements DrawContext {
	private readonly paths = new WeakMap<SceneItem, Path2D>();

	path<T extends SceneItem>(item: T, build: (item: T) => Path2D): Path2D {
		let path = this.paths.get(item);
		if (!path) this.paths.set(item, (path = build(item)));
		return path;
	}
}

/** Items taken out of a page while dragged, moved/scaled by `t` as they will be put back */
export function drawLifted<I extends SceneItem>(
	ctx: CanvasRenderingContext2D,
	view: Viewport,
	rect: PageRect,
	t: Transform,
	items: I[],
	kit: ItemKit<I>,
	cx: DrawContext
) {
	const k = view.zoom;
	ctx.save();
	ctx.translate((rect.x - view.x) * k, (rect.y - view.y) * k);
	ctx.scale(k, k);
	ctx.translate(t.ox + t.dx, t.oy + t.dy);
	ctx.scale(t.scale, t.scale);
	ctx.translate(-t.ox, -t.oy);
	for (const item of items) {
		if (t.scale === 1 || !kit.ownScale?.(item)) {
			kit.draw(ctx, item, cx);
			continue;
		}
		// Sizes itself: drawn as it will be, not stretched
		ctx.save();
		ctx.translate(t.ox, t.oy);
		ctx.scale(1 / t.scale, 1 / t.scale);
		ctx.translate(-t.ox - t.dx, -t.oy - t.dy);
		kit.draw(ctx, kit.transform(item, t), cx);
		ctx.restore();
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

/** A shape not on the page yet (page points as x, y, pressure triples), as a plain line in its ink */
export function drawRubber(
	ctx: CanvasRenderingContext2D,
	view: { zoom: number; toScreenX(x: number): number; toScreenY(y: number): number },
	rect: { x: number; y: number },
	rubber: { points: ArrayLike<number>; color: string; size: number }
) {
	const pts = rubber.points;
	if (pts.length < 6) return;
	ctx.strokeStyle = rubber.color;
	ctx.lineWidth = Math.max(1, rubber.size * view.zoom);
	ctx.beginPath();
	ctx.moveTo(view.toScreenX(rect.x + pts[0]), view.toScreenY(rect.y + pts[1]));
	for (let i = 3; i < pts.length; i += 3) ctx.lineTo(view.toScreenX(rect.x + pts[i]), view.toScreenY(rect.y + pts[i + 1]));
	ctx.stroke();
}
