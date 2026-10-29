import { anchorFactors } from '#lib/media/content.js';
import { isDrawable, type Anchor, type ClipShape, type Rect, type Timeline } from '#lib/project/types.js';
import { drawProgress, fadeAlpha, itemEnd, itemsAt, trackState, viewAt } from '#lib/timeline/ops.js';
import { drawOverlay, overlayAlpha } from './overlays.js';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The area `x`, `y`, `width` × `height` of `image` fills the clip's rect */
export interface Frame {
	image: CanvasImageSource;
	x?: number;
	y?: number;
	width: number;
	height: number;
	/** Only this centered part is drawn (recorded window smaller than its largest size); the rest stays empty */
	visible?: { width: number; height: number };
	/** Where the visible part sits in the rect (default: center) */
	anchor?: Anchor;
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
	/** Fade annotations and clips in and out (default); the paused preview draws everything at full opacity */
	fades?: boolean;
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
			const still = scene.fades === false;
			const progress = still || !isDrawable(item) ? 1 : drawProgress(scene.t, item.start, item.drawIn);
			drawOverlay(ctx, item, width, height, still ? 1 : overlayAlpha(item, scene.t), progress);
			continue;
		}
		const frame = scene.frames.get(item.id);
		if (!frame || frame.width <= 0 || frame.height <= 0) continue;
		const { x, y, w, h } = item.rect;
		// Fading clips let the tracks below and the background shine through
		ctx.globalAlpha = scene.fades === false ? 1 : fadeAlpha(scene.t, item.start, itemEnd(item), item.fadeIn, item.fadeOut);
		drawClip(ctx, frame, x * width, y * height, w * width, h * height, item.shape ?? 'rect');
		ctx.globalAlpha = 1;
	}
	ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Draws a clip frame into its rect, rounded or as a circle (centered, diameter = shorter side) */
function drawClip(ctx: Ctx2D, frame: Frame, x: number, y: number, w: number, h: number, shape: ClipShape) {
	if (shape === 'rect') {
		drawFrame(ctx, frame, x, y, w, h);
		return;
	}
	ctx.save();
	ctx.beginPath();
	if (shape === 'rounded') ctx.roundRect(x, y, w, h, 0.08 * Math.min(w, h));
	else ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, 2 * Math.PI);
	ctx.clip();
	drawFrame(ctx, frame, x, y, w, h);
	ctx.restore();
}

function drawFrame(ctx: Ctx2D, frame: Frame, x: number, y: number, w: number, h: number) {
	const { width, height } = frame;
	const vw = Math.min(frame.visible?.width ?? width, width);
	const vh = Math.min(frame.visible?.height ?? height, height);
	const dw = (w * vw) / width;
	const dh = (h * vh) / height;
	// The window is always centered in the file, only its place in the rect can change
	const sx = (frame.x ?? 0) + (width - vw) / 2;
	const sy = (frame.y ?? 0) + (height - vh) / 2;
	const f = anchorFactors(frame.anchor);
	ctx.drawImage(frame.image, sx, sy, vw, vh, x + (w - dw) * f.x, y + (h - dh) * f.y, dw, dh);
}
