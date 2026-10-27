import type { Annotation, CalloutAnnotation, Point, Rect, TextAnnotation } from '#lib/project/types.js';
import { parseColor } from '#lib/util/color.js';
import type { Ctx2D } from './compositor.js';
import { fontCss } from './fonts.svelte.js';

/** Fade-in/fade-out duration in seconds. */
export const FADE = 0.2;

const LINE_HEIGHT = 1.25;
const TEXT_PADDING = 0.4;

export function overlayAlpha(a: Annotation, t: number): number {
	if (!a.fade) return 1;
	return Math.max(0, Math.min(1, (t - a.start) / FADE, (a.end - t) / FADE));
}

/**
 * Draws an annotation. `ctx` already has the zoom transform; coordinates are canvas pixels
 * (W × H) in content space.
 */
export function drawOverlay(ctx: Ctx2D, a: Annotation, W: number, H: number, alpha: number) {
	if (alpha <= 0) return;
	ctx.save();
	ctx.globalAlpha = alpha;
	const px = (r: Rect) => [r.x * W, r.y * H, r.w * W, r.h * H] as const;

	switch (a.kind) {
		case 'blur': {
			const [x, y, w, h] = px(a.rect);
			const m = ctx.getTransform();
			ctx.beginPath();
			if (a.area === 'outside') {
				// Everything except the area (cut out as with the spotlight)
				ctx.rect(-W, -H, 3 * W, 3 * H);
				ctx.rect(x, y, w, h);
				ctx.clip('evenodd');
			} else {
				ctx.rect(x, y, w, h);
				ctx.clip();
			}
			// Copy the already drawn image, blurred, into the area (without transform)
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.filter = `blur(${Math.max(1, a.strength * H * m.a)}px)`;
			ctx.drawImage(ctx.canvas as CanvasImageSource, 0, 0);
			break;
		}
		case 'spotlight': {
			const [x, y, w, h] = px(a.rect);
			ctx.beginPath();
			ctx.rect(-W, -H, 3 * W, 3 * H);
			ctx.roundRect(x, y, w, h, 0.01 * H);
			ctx.fillStyle = a.color;
			ctx.fill('evenodd');
			break;
		}
		case 'highlight': {
			const [x, y, w, h] = px(a.rect);
			ctx.fillStyle = a.color;
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, 0.004 * H);
			ctx.fill();
			break;
		}
		case 'rect': {
			const [x, y, w, h] = px(a.rect);
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = a.width * H;
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, a.radius * H);
			ctx.stroke();
			break;
		}
		case 'ellipse': {
			const [x, y, w, h] = px(a.rect);
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = a.width * H;
			ctx.beginPath();
			ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
			ctx.stroke();
			break;
		}
		case 'line': {
			const lw = a.width * H;
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = lw;
			ctx.lineCap = 'round';
			// Round caps lengthen each dash by one line width
			if (a.dashed) ctx.setLineDash([2 * lw, 3 * lw]);
			ctx.beginPath();
			ctx.moveTo(a.from.x * W, a.from.y * H);
			ctx.lineTo(a.to.x * W, a.to.y * H);
			ctx.stroke();
			break;
		}
		case 'step': {
			const r = (a.size * H) / 2;
			const cx = a.x * W;
			const cy = a.y * H;
			if (a.shadow) shadow(ctx, H);
			ctx.fillStyle = a.color;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, 2 * Math.PI);
			ctx.fill();
			noShadow(ctx);
			ctx.fillStyle = contrastText(a.color);
			ctx.font = `700 ${r * 1.1}px system-ui, "Segoe UI", Roboto, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			// Optical center: digits sit slightly high with "middle"
			ctx.fillText(String(a.number), cx, cy + r * 0.05);
			break;
		}		case 'arrow': {
			const x1 = a.from.x * W;
			const y1 = a.from.y * H;
			const x2 = a.to.x * W;
			const y2 = a.to.y * H;
			const lw = a.width * H;
			const len = Math.hypot(x2 - x1, y2 - y1);
			if (len < 1) break;
			const head = Math.min(Math.max(lw * 3.5, 0.02 * H), len * 0.6);
			const angle = Math.atan2(y2 - y1, x2 - x1);
			const bx = x2 - Math.cos(angle) * head * 0.8;
			const by = y2 - Math.sin(angle) * head * 0.8;
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = ctx.fillStyle = a.color;
			ctx.lineWidth = lw;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(bx, by);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x2, y2);
			ctx.lineTo(x2 - Math.cos(angle - 0.45) * head, y2 - Math.sin(angle - 0.45) * head);
			ctx.lineTo(x2 - Math.cos(angle + 0.45) * head, y2 - Math.sin(angle + 0.45) * head);
			ctx.closePath();
			ctx.fill();
			break;
		}
		case 'text':
		case 'callout': {
			const box = textBox(ctx, a, W, H);
			if (a.shadow) shadow(ctx, H);
			if (a.background) {
				ctx.fillStyle = a.background;
				ctx.beginPath();
				ctx.roundRect(box.x, box.y, box.w, box.h, box.font * 0.3);
				const tail = a.kind === 'callout' ? calloutTail(box, { x: a.tip.x * W, y: a.tip.y * H }) : null;
				if (tail) {
					// Same path and winding as the box: no darker overlap with a translucent background
					ctx.moveTo(tail[0].x, tail[0].y);
					ctx.lineTo(tail[1].x, tail[1].y);
					ctx.lineTo(tail[2].x, tail[2].y);
					ctx.closePath();
				}
				ctx.fill('nonzero');
				// The box carries the shadow, not the text on it
				noShadow(ctx);
			}
			ctx.fillStyle = a.color;
			ctx.textBaseline = 'top';
			const pad = a.background ? box.font * TEXT_PADDING : 0;
			box.lines.forEach((line, i) => {
				ctx.fillText(line, box.x + pad, box.y + pad + i * box.font * LINE_HEIGHT + box.font * 0.1);
			});
			break;
		}
	}
	ctx.restore();
}

function shadow(ctx: Ctx2D, H: number) {
	ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
	ctx.shadowBlur = 0.006 * H;
	ctx.shadowOffsetY = 0.002 * H;
}

function noShadow(ctx: Ctx2D) {
	ctx.shadowColor = 'transparent';
}

/** Black or white, whichever reads better on `fill` */
function contrastText(fill: string) {
	const { hex } = parseColor(fill);
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#000000' : '#ffffff';
}

/**
 * Pointer of a speech bubble: triangle from the box center to `tip`, base across the direction to the tip.
 * Winding matches `roundRect` (positive area in canvas coordinates), so both fill as one shape.
 * `null` if the tip lies within the box.
 */
export function calloutTail(box: Rect, tip: Point): [Point, Point, Point] | null {
	if (tip.x >= box.x && tip.x <= box.x + box.w && tip.y >= box.y && tip.y <= box.y + box.h) return null;
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const len = Math.hypot(tip.x - cx, tip.y - cy);
	const half = Math.min(box.w, box.h) * 0.25;
	const nx = (-(tip.y - cy) / len) * half;
	const ny = ((tip.x - cx) / len) * half;
	const a = { x: cx + nx, y: cy + ny };
	const b = { x: cx - nx, y: cy - ny };
	const area = (a.x * tip.y - tip.x * a.y) + (tip.x * b.y - b.x * tip.y) + (b.x * a.y - a.x * b.y);
	return area > 0 ? [a, tip, b] : [b, tip, a];
}

/** Dimensions of a text box in canvas pixels. Sets `ctx.font` along the way. */
export function textBox(ctx: Ctx2D, a: TextAnnotation | CalloutAnnotation, W: number, H: number) {
	const font = a.size * H;
	ctx.font = fontCss(a.font, font);
	const lines = (a.text || ' ').split('\n');
	const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
	const pad = a.background ? font * TEXT_PADDING : 0;
	return {
		x: a.x * W,
		y: a.y * H,
		w: width + 2 * pad,
		h: lines.length * font * LINE_HEIGHT + 2 * pad,
		font,
		lines
	};
}

/** Change that moves an annotation by an offset in content coordinates */
export function moveAnnotation(a: Annotation, dx: number, dy: number): Partial<Annotation> {
	const by = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
	switch (a.kind) {
		case 'arrow':
		case 'line':
			return { from: by(a.from), to: by(a.to) };
		case 'text':
		case 'step':
			return { x: a.x + dx, y: a.y + dy };
		case 'callout':
			// The pointer moves along
			return { x: a.x + dx, y: a.y + dy, tip: by(a.tip) };
		default:
			return { rect: { ...a.rect, x: a.rect.x + dx, y: a.rect.y + dy } };
	}
}

let measureCtx: OffscreenCanvasRenderingContext2D | null = null;

/** Bounding box of an annotation, normalized (for selection and handles in the editor). */
export function overlayBounds(a: Annotation, W: number, H: number): Rect {
	switch (a.kind) {
		case 'arrow':
		case 'line':
			return {
				x: Math.min(a.from.x, a.to.x),
				y: Math.min(a.from.y, a.to.y),
				w: Math.abs(a.to.x - a.from.x),
				h: Math.abs(a.to.y - a.from.y)
			};
		case 'step':
			return { x: a.x - (a.size * H) / W / 2, y: a.y - a.size / 2, w: (a.size * H) / W, h: a.size };
		case 'text':
		case 'callout': {
			measureCtx ??= new OffscreenCanvas(1, 1).getContext('2d');
			const box = textBox(measureCtx!, a, W, H);
			return { x: a.x, y: a.y, w: box.w / W, h: box.h / H };
		}
		default:
			return a.rect;
	}
}
