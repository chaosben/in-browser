import { m } from '#lib/i18n/index.js';
import { newId, type Annotation, type AnnotationKind, type Rect, type Source, type VideoClip, type ZoomSegment } from './types.js';

/** Label and icon per annotation type (classes written out in full so Tailwind finds them). */
export const OVERLAY_KINDS: Record<AnnotationKind, { label: string; icon: string }> = {
	arrow: { label: m.kinds.arrow, icon: 'icon-[material-symbols-light--arrow-outward]' },
	rect: { label: m.kinds.rect, icon: 'icon-[material-symbols-light--crop-square-outline]' },
	highlight: { label: m.kinds.highlight, icon: 'icon-[material-symbols-light--ink-highlighter-outline]' },
	spotlight: { label: m.kinds.spotlight, icon: 'icon-[material-symbols-light--flashlight-on-outline]' },
	blur: { label: m.kinds.blur, icon: 'icon-[material-symbols-light--blur-on]' },
	text: { label: m.kinds.text, icon: 'icon-[material-symbols-light--title]' }
};

export const ZOOM_ICON = 'icon-[material-symbols-light--zoom-in]';
export const FREEZE_ICON = 'icon-[material-symbols-light--ac-unit]';

/** Swatches of the color picker (opacity is set separately) */
export const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

/** New annotation with sensible defaults in the center of the frame. */
export function createOverlay(kind: AnnotationKind, start: number, end: number): Annotation {
	// The actual track is assigned by `addItem` (new items go to the front).
	const base = { id: newId(), type: 'annotation' as const, start, end, fade: true, track: 0 };
	switch (kind) {
		case 'arrow':
			return { ...base, kind, from: { x: 0.3, y: 0.3 }, to: { x: 0.48, y: 0.48 }, color: '#ef4444', width: 0.007 };
		case 'rect':
			return { ...base, kind, rect: { x: 0.35, y: 0.38, w: 0.3, h: 0.24 }, color: '#ef4444', width: 0.005, radius: 0.01 };
		case 'highlight':
			return { ...base, kind, rect: { x: 0.35, y: 0.46, w: 0.3, h: 0.08 }, color: '#facc1566' };
		case 'spotlight':
			return { ...base, kind, rect: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, color: '#00000099' };
		case 'blur':
			return { ...base, kind, rect: { x: 0.4, y: 0.44, w: 0.2, h: 0.12 }, strength: 0.012, area: 'inside' };
		case 'text':
			return {
				...base,
				kind,
				x: 0.08,
				y: 0.08,
				text: m.kinds.text,
				size: 0.05,
				color: '#ffffff',
				background: '#000000a6'
			};
	}
}

/** New zoom segment: 2× on the center of the frame. `w === h` so the aspect ratio is preserved. */
export function createZoom(start: number, end: number): ZoomSegment {
	return { id: newId(), start, end, ease: 0.6, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } };
}

/** Source fitted into the canvas keeping its aspect ratio (`cover`: filling, then extends past the edge). */
export function fitRect(source: Pick<Source, 'width' | 'height'>, width: number, height: number, cover = false): Rect {
	// Audio-only sources have no picture
	if (!source.width || !source.height) return { x: 0, y: 0, w: 1, h: 1 };
	const fit = cover ? Math.max : Math.min;
	const scale = fit(width / source.width, height / source.height);
	const w = (source.width * scale) / width;
	const h = (source.height * scale) / height;
	return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Webcam overlay bottom right: 25 % of the canvas width, margin 3 % of the canvas height */
export function cameraRect(source: Pick<Source, 'width' | 'height'>, width: number, height: number): Rect {
	if (!source.width || !source.height) return fitRect(source, width, height);
	const w = 0.25;
	const h = (w * width * (source.height / source.width)) / height;
	const margin = 0.03;
	return { x: 1 - w - (margin * height) / width, y: 1 - h - margin, w, h };
}

/** Clip spanning the whole source, fitted. Start and track are assigned by `appendClip` or `addItem`. */
export function createClip(source: Source, width: number, height: number, start = 0): VideoClip {
	return {
		id: newId(),
		type: 'video',
		sourceId: source.id,
		start,
		track: 0,
		in: 0,
		out: source.duration,
		rect: fitRect(source, width, height)
	};
}

/** Default background of new projects */
export const DEFAULT_BACKGROUND = '#000000';
