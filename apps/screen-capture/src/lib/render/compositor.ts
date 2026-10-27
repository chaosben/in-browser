import type { ClipShape, Rect, Timeline } from '#lib/project/types.js';
import { itemsAt, trackState, viewAt } from '#lib/timeline/ops.js';
import { drawOverlay, overlayAlpha } from './overlays.js';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Frame {
	image: CanvasImageSource;
	width: number;
	height: number;
}

export interface Scene {
	/** Timeline time in seconds */
	t: number;
	timeline: Timeline;
	/** Canvas background color (wherever there is no clip) */
	background: string;
	/** Current frame per clip ID; if one is missing (not decoded yet), the clip stays empty. */
	frames: Map<string, Frame>;
	/** Forces a view (e.g. full frame while editing a zoom segment). */
	view?: Rect;
	/** Annotations drawn at full opacity, ignoring their fade (selected ones while editing) */
	opaque?: ReadonlySet<string>;
}

/**
 * Draws an output frame: background, then all tracks from back to front (clips in their frames,
 * annotations), with pan & zoom. Shared by preview and export so both look identical.
 */
export function renderFrame(ctx: Ctx2D, width: number, height: number, scene: Scene) {
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.fillStyle = scene.background;
	ctx.fillRect(0, 0, width, height);

	// Clips and annotations share the same coordinate system and therefore zoom together.
	const view = scene.view ?? viewAt(scene.timeline, scene.t);
	const sx = 1 / view.w;
	const sy = 1 / view.h;
	ctx.setTransform(sx, 0, 0, sy, -view.x * width * sx, -view.y * height * sy);
	ctx.imageSmoothingQuality = 'high';

	// Blur/spotlight also affect everything below, clips included.
	for (const item of itemsAt(scene.timeline, scene.t)) {
		if (trackState(scene.timeline, item.track).hidden) continue;
		if (item.type === 'annotation') {
			drawOverlay(ctx, item, width, height, scene.opaque?.has(item.id) ? 1 : overlayAlpha(item, scene.t));
			continue;
		}
		const frame = scene.frames.get(item.id);
		if (!frame || frame.width <= 0 || frame.height <= 0) continue;
		const { x, y, w, h } = item.rect;
		drawClip(ctx, frame, x * width, y * height, w * width, h * height, item.shape ?? 'rect');
	}
	ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Draws a clip frame into its rect, rounded or as a circle (centered, diameter = shorter side) */
function drawClip(ctx: Ctx2D, frame: Frame, x: number, y: number, w: number, h: number, shape: ClipShape) {
	if (shape === 'rect') {
		ctx.drawImage(frame.image, x, y, w, h);
		return;
	}
	ctx.save();
	ctx.beginPath();
	if (shape === 'rounded') ctx.roundRect(x, y, w, h, 0.08 * Math.min(w, h));
	else ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, 2 * Math.PI);
	ctx.clip();
	ctx.drawImage(frame.image, x, y, w, h);
	ctx.restore();
}
