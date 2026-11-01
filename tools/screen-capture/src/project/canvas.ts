// Resizing the canvas: positions are fractions of the canvas (x/w of its width, y/h and sizes of its height),
// so a new canvas size means converting everything. Existing content keeps its size in pixels and stays
// centered; new space around it stays empty, on a smaller canvas it reaches over the edge.

import { cameraRect, placeRect } from './defaults.js';
import type { Annotation, Item, Point, Rect, Source, Timeline, ZoomSegment } from './types.js';

export interface Size {
	width: number;
	height: number;
}

/** Sizes offered for a new project or when changing the canvas (`name` → `m.canvasSize`) */
export const CANVAS_PRESETS = [
	{ name: 'fullHd', width: 1920, height: 1080 },
	{ name: 'hd', width: 1280, height: 720 },
	{ name: 'qhd', width: 2560, height: 1440 },
	{ name: 'uhd', width: 3840, height: 2160 },
	{ name: 'portrait', width: 1080, height: 1920 },
	{ name: 'square', width: 1080, height: 1080 },
	{ name: 'feed', width: 1080, height: 1350 }
] as const;

export const MIN_CANVAS = 16;
export const MAX_CANVAS = 7680;

/** Even pixel counts (like the export) within MIN_CANVAS…MAX_CANVAS */
export function clampCanvasSize(size: Size): Size {
	const clamp = (v: number) => {
		const even = Math.floor((Number.isFinite(v) ? v : MIN_CANVAS) / 2) * 2;
		return Math.min(Math.max(even, MIN_CANVAS), MAX_CANVAS);
	};
	return { width: clamp(size.width), height: clamp(size.height) };
}

/**
 * Converts all positions and sizes from canvas `from` to canvas `to`. `offset`: where the old canvas lies in
 * the new one, in pixels (default: centered).
 */
export function resizeCanvas(timeline: Timeline, from: Size, to: Size, offset?: Point): Timeline {
	if (from.width === to.width && from.height === to.height && !offset?.x && !offset?.y) return timeline;
	const sx = from.width / to.width;
	const sy = from.height / to.height;
	const ox = (offset?.x ?? (to.width - from.width) / 2) / to.width;
	const oy = (offset?.y ?? (to.height - from.height) / 2) / to.height;
	const point = (p: Point): Point => ({ x: p.x * sx + ox, y: p.y * sy + oy });
	const rect = (r: Rect): Rect => ({ ...point(r), w: r.w * sx, h: r.h * sy });
	// Fixed text boxes keep their width in pixels, so the text wraps the same
	const boxWidth = (w: number | undefined) => (w === undefined ? {} : { boxWidth: w * sx });

	const annotation = (a: Annotation): Annotation => {
		switch (a.kind) {
			case 'arrow':
			case 'line':
				return { ...a, from: point(a.from), to: point(a.to), width: a.width * sy };
			case 'rect':
				return { ...a, rect: rect(a.rect), width: a.width * sy, radius: a.radius * sy };
			case 'ellipse':
				return { ...a, rect: rect(a.rect), width: a.width * sy };
			case 'spotlight':
				return { ...a, rect: rect(a.rect), blur: a.blur * sy, radius: a.radius * sy };
			case 'highlight':
			case 'icon':
				return { ...a, rect: rect(a.rect) };
			case 'image':
				return { ...a, rect: rect(a.rect), radius: a.radius * sy };
			case 'blur':
				return { ...a, rect: rect(a.rect), strength: a.strength * sy, radius: a.radius * sy };
			case 'step':
				return { ...a, ...point(a), size: a.size * sy };
			case 'text':
				return { ...a, ...point(a), size: a.size * sy, radius: a.radius * sy, padding: a.padding * sy, ...boxWidth(a.boxWidth) };
			case 'callout':
				return {
					...a,
					...point(a),
					size: a.size * sy,
					radius: a.radius * sy,
					padding: a.padding * sy,
					...boxWidth(a.boxWidth),
					tip: point(a.tip)
				};
		}
	};
	const item = (i: Item): Item => (i.type === 'annotation' ? annotation(i) : { ...i, rect: rect(i.rect) });

	// Zoom views keep the canvas aspect ratio (`w === h`): show at least the same area, centered on the same spot
	const zoom = (z: ZoomSegment): ZoomSegment => {
		const s = Math.min(Math.max(z.rect.w * sx, z.rect.h * sy), 1);
		const c = point({ x: z.rect.x + z.rect.w / 2, y: z.rect.y + z.rect.h / 2 });
		const clamp = (v: number) => Math.min(Math.max(v - s / 2, 0), 1 - s);
		return { ...z, rect: { x: clamp(c.x), y: clamp(c.y), w: s, h: s } };
	};

	return { ...timeline, items: timeline.items.map(item), zoom: timeline.zoom.map(zoom) };
}

/**
 * Canvas reduced to the largest clip with a picture (its frame within the canvas, even pixel counts, centered on
 * it) and the offset for `resizeCanvas`; `null` if there is none or it would not get smaller.
 */
export function largestClipArea(timeline: Timeline, sources: Source[], canvas: Size): { size: Size; offset: Point } | null {
	const pictures = new Set(sources.filter((s) => s.hasVideo).map((s) => s.id));
	let best: Rect | null = null;
	for (const item of timeline.items) {
		if (item.type === 'annotation' || !pictures.has(item.sourceId)) continue;
		if (!best || item.rect.w * item.rect.h > best.w * best.h) best = item.rect;
	}
	if (!best) return null;
	const x0 = Math.max(0, best.x * canvas.width);
	const y0 = Math.max(0, best.y * canvas.height);
	const x1 = Math.min(canvas.width, (best.x + best.w) * canvas.width);
	const y1 = Math.min(canvas.height, (best.y + best.h) * canvas.height);
	if (x1 <= x0 || y1 <= y0) return null;
	const size = clampCanvasSize({ width: x1 - x0, height: y1 - y0 });
	if (size.width >= canvas.width && size.height >= canvas.height) return null;
	return { size, offset: { x: -(x0 + (x1 - x0 - size.width) / 2), y: -(y0 + (y1 - y0 - size.height) / 2) } };
}

/** Canvas size that also holds the new sources with a picture 1:1, or `null` if they already fit */
export function growTo(canvas: Size, sources: Pick<Source, 'hasVideo' | 'width' | 'height'>[]): Size | null {
	const visual = sources.filter((s) => s.hasVideo && s.width > 0 && s.height > 0);
	const width = Math.max(canvas.width, ...visual.map((s) => s.width));
	const height = Math.max(canvas.height, ...visual.map((s) => s.height));
	return width > canvas.width || height > canvas.height ? { width, height } : null;
}

const near = (a: Rect, b: Rect) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h) < 1e-6;

/** Sources larger than the canvas with a clip in the default placement, i.e. shown shrunk to fit */
export function shrunkSources(timeline: Timeline, sources: Source[], canvas: Size): Source[] {
	return sources.filter(
		(s) =>
			s.hasVideo &&
			(s.width > canvas.width || s.height > canvas.height) &&
			timeline.items.some((i) => i.type !== 'annotation' && i.sourceId === s.id && near(i.rect, placeRect(s, canvas.width, canvas.height)))
	);
}

/**
 * Clips still in a default placement after the canvas has grown: those that were only shrunk to fit the old
 * canvas (source larger than it) fill the new one 1:1, webcam overlays move to the corner of the new one.
 * Moved or resized clips stay as they are.
 */
export function refitDefaults(timeline: Timeline, sources: Source[], from: Size, to: Size): Timeline {
	const items = timeline.items.map((item) => {
		if (item.type === 'annotation') return item;
		const source = sources.find((s) => s.id === item.sourceId);
		if (!source?.hasVideo) return item;
		// Default placement in the old canvas, converted like everything else
		const was = (rect: Rect) => near(item.rect, (resizeCanvas(timeline1({ ...item, rect }), from, to).items[0] as typeof item).rect);
		const larger = source.width > from.width || source.height > from.height;
		if (larger && was(placeRect(source, from.width, from.height))) return { ...item, rect: placeRect(source, to.width, to.height) };
		if (was(cameraRect(source, from.width, from.height))) return { ...item, rect: cameraRect(source, to.width, to.height) };
		return item;
	});
	return { ...timeline, items };
}

const timeline1 = (item: Item): Timeline => ({ items: [item], tracks: [], zoom: [] });
