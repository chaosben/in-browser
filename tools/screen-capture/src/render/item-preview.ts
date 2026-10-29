// Picture of elements on their own (library tiles, the elements at the pointer): cut to their outline, transparent
// background. Clips show their thumbnail in their shape (a neutral area until it has loaded); clips without a
// picture (audio) have no place in the picture – an entry of only audio shows its waveform instead.
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
 * `media`: loaded thumbnails and waveforms; `hasPicture` tells clips with a picture from audio.
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
	if (!bounds) return drawWaveforms(canvas, ctx, items, maxWidth, maxHeight, media);
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

/** Only audio: the waveforms of the trimmed parts, one row per clip */
function drawWaveforms(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	items: readonly Item[],
	width: number,
	height: number,
	media?: ItemMedia
) {
	const clips = items.filter((item) => item.type === 'video');
	if (!clips.length) return;
	canvas.width = width;
	canvas.height = Math.min(height, clips.length * Math.round(height / 2));
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--color-primary') || '#6366f1';
	const row = canvas.height / clips.length;
	clips.forEach((clip, r) => {
		const p = media?.peaks.get(clip.id);
		const mid = row * r + row / 2;
		if (!p) return ctx.fillRect(0, mid - 0.5, width, 1);
		const from = clip.in * p.rate;
		const to = clip.out * p.rate;
		for (let x = 0; x < width; x++) {
			// Loudest peak of the samples behind this pixel column
			let v = 0;
			for (let i = Math.floor(from + ((to - from) * x) / width); i < from + ((to - from) * (x + 1)) / width; i++) {
				v = Math.max(v, p.data[i] ?? 0);
			}
			const half = Math.max(0.5, (v * row * 0.9) / 2);
			ctx.fillRect(x, mid - half, 1, 2 * half);
		}
	});
}
