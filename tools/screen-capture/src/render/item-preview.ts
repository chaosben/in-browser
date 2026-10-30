// Picture of elements on their own (library tiles, the elements at the pointer): cut to their outline, transparent
// background. Clips show their thumbnail in their shape (a neutral area until it has loaded); clips without a
// picture (audio) have no place in the picture – for items of only audio the caller shows an audio icon instead.
import type { ItemMedia } from '#lib/media/visuals.js';
import type { Clip, Item, Rect } from '#lib/project/types.js';
import { drawOverlay, overlayBounds } from './overlays.js';

/** Outline of the items with a picture in canvas pixels, with a margin for strokes and shadows */
export function previewBounds(
	items: readonly Item[],
	W: number,
	H: number,
	hasPicture: (clip: Clip) => boolean = () => true
): Rect | null {
	const rects = items.flatMap((item) =>
		item.type === 'annotation' ? [overlayBounds(item, W, H)] : hasPicture(item) ? [item.rect] : []
	);
	if (!rects.length) return null;
	const x1 = Math.min(...rects.map((r) => r.x)) * W;
	const y1 = Math.min(...rects.map((r) => r.y)) * H;
	const x2 = Math.max(...rects.map((r) => r.x + r.w)) * W;
	const y2 = Math.max(...rects.map((r) => r.y + r.h)) * H;
	const pad = 0.02 * H;
	return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad };
}

/** Clip area in its shape (as in the compositor: rounded, or a centered circle) */
function clipShape(ctx: CanvasRenderingContext2D, clip: Clip, W: number, H: number) {
	const x = clip.rect.x * W;
	const y = clip.rect.y * H;
	const w = clip.rect.w * W;
	const h = clip.rect.h * H;
	ctx.beginPath();
	if (clip.shape === 'circle') ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, 2 * Math.PI);
	else ctx.roundRect(x, y, w, h, clip.shape === 'rounded' ? 0.08 * Math.min(w, h) : 0);
	return { x, y, w, h };
}

/**
 * Draws the items fitted into `maxWidth` × `maxHeight` (pixels of the canvas); the canvas takes their shape.
 * `media`: loaded thumbnails; `hasPicture` tells clips with a picture from audio. Nothing to draw without a picture.
 */
export function drawItemsPreview(
	canvas: HTMLCanvasElement,
	items: readonly Item[],
	W: number,
	H: number,
	maxWidth: number,
	maxHeight: number,
	media?: ItemMedia,
	hasPicture: (clip: Clip) => boolean = () => true
) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const bounds = previewBounds(items, W, H, hasPicture);
	if (!bounds) return;
	const scale = Math.min(maxWidth / bounds.w, maxHeight / bounds.h);
	canvas.width = Math.max(1, Math.round(bounds.w * scale));
	canvas.height = Math.max(1, Math.round(bounds.h * scale));
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale);
	for (const item of [...items].sort((a, b) => a.track - b.track)) {
		if (item.type === 'annotation') {
			drawOverlay(ctx, item, W, H, 1);
			continue;
		}
		if (!hasPicture(item)) continue;
		ctx.save();
		const { x, y, w, h } = clipShape(ctx, item, W, H);
		const frame = media?.frames.get(item.id);
		if (frame) {
			ctx.clip();
			ctx.drawImage(frame, x, y, w, h);
		} else {
			ctx.fillStyle = '#6b7280';
			ctx.fill();
		}
		ctx.restore();
	}
}
