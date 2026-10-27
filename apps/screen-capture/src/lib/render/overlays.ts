import type { Annotation, Rect, TextAnnotation } from '#lib/project/types.js';
import type { Ctx2D } from './compositor.js';

/** Fade-in/fade-out duration in seconds. */
export const FADE = 0.2;

export const TEXT_FONT = '600 {px}px system-ui, "Segoe UI", Roboto, sans-serif';
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
			shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = a.width * H;
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, a.radius * H);
			ctx.stroke();
			break;
		}
		case 'arrow': {
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
			shadow(ctx, H);
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
		case 'text': {
			const box = textBox(ctx, a, W, H);
			if (a.background) {
				ctx.fillStyle = a.background;
				ctx.beginPath();
				ctx.roundRect(box.x, box.y, box.w, box.h, box.font * 0.3);
				ctx.fill();
			} else {
				shadow(ctx, H);
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

/** Dimensions of a text box in canvas pixels. Sets `ctx.font` along the way. */
export function textBox(ctx: Ctx2D, a: TextAnnotation, W: number, H: number) {
	const font = a.size * H;
	ctx.font = TEXT_FONT.replace('{px}', String(font));
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

let measureCtx: OffscreenCanvasRenderingContext2D | null = null;

/** Bounding box of an annotation, normalized (for selection and handles in the editor). */
export function overlayBounds(a: Annotation, W: number, H: number): Rect {
	switch (a.kind) {
		case 'arrow':
			return {
				x: Math.min(a.from.x, a.to.x),
				y: Math.min(a.from.y, a.to.y),
				w: Math.abs(a.to.x - a.from.x),
				h: Math.abs(a.to.y - a.from.y)
			};
		case 'text': {
			measureCtx ??= new OffscreenCanvas(1, 1).getContext('2d');
			const box = textBox(measureCtx!, a, W, H);
			return { x: a.x, y: a.y, w: box.w / W, h: box.h / H };
		}
		default:
			return a.rect;
	}
}
