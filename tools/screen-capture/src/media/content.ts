// Recordings of a window that is resized while recording: every frame is drawn 1:1 and centered into a fixed
// box (the encoder needs a constant size). Afterwards the source only uses the area of the largest window
// (`Source.crop`, `width`/`height`) and knows the window size over time (`Source.sizes`), so the rest of
// the box stays empty instead of black.

import type { Anchor, Source, SourceSize } from '#lib/project/types.js';

interface Size {
	width: number;
	height: number;
}

const even = (n: number) => Math.ceil(n / 2) * 2;

/** Area of the file the source uses, in pixels */
export function sourceCrop(source: Source) {
	return { left: source.crop?.x ?? 0, top: source.crop?.y ?? 0, width: source.width, height: source.height };
}

/** Window size at source time `t`; without size changes the whole source */
export function contentSizeAt(source: Source, t: number): Size {
	const sizes = source.sizes;
	if (!sizes?.length) return { width: source.width, height: source.height };
	// Last entry with `t <= time`, the first one also covers anything before it
	let lo = 0;
	let hi = sizes.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (sizes[mid].t <= t) lo = mid;
		else hi = mid - 1;
	}
	return { width: sizes[lo].width, height: sizes[lo].height };
}

/** Source fields for a recording into `box` with the largest frame `max` and the size changes `sizes` */
export function captureLayout(box: Size, max: Size, sizes: SourceSize[]): Pick<Source, 'width' | 'height' | 'crop' | 'sizes'> {
	const width = Math.min(even(max.width), box.width);
	const height = Math.min(even(max.height), box.height);
	const crop = width === box.width && height === box.height ? undefined : { x: (box.width - width) / 2, y: (box.height - height) / 2 };
	return { width, height, crop, sizes: sizes.length > 1 ? sizes : undefined };
}

/**
 * Where to draw a frame of `frame` size centered into `box`, 1:1 – only scaled down if it does not fit
 * (e.g. a window on a larger monitor).
 */
export function placeInBox(box: Size, frame: Size) {
	const scale = Math.min(1, box.width / frame.width, box.height / frame.height);
	const width = Math.round(frame.width * scale);
	const height = Math.round(frame.height * scale);
	return { x: Math.floor((box.width - width) / 2), y: Math.floor((box.height - height) / 2), width, height };
}

/**
 * Area of a frame of `width` × `height` (the whole decoded video) to draw for `source` at source time `t`
 * (see `Frame` in the compositor)
 */
export function frameArea(source: Source | undefined, t: number, width: number, height: number) {
	if (!source || (!source.crop && !source.sizes)) return { width, height };
	const { left, top } = sourceCrop(source);
	return { x: left, y: top, width: source.width, height: source.height, visible: visibleAt(source, t) };
}

/** Window size at `t` if it changed during the recording */
export function visibleAt(source: Source, t: number): Size | undefined {
	return source.sizes ? contentSizeAt(source, t) : undefined;
}

/** All window positions, row by row (order of the picker) */
export const ANCHORS: Anchor[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

/** Share of the free space left of and above the window (0, 0.5 or 1) */
export function anchorFactors(anchor: Anchor = 'center') {
	const x = anchor.endsWith('left') ? 0 : anchor.endsWith('right') ? 1 : 0.5;
	const y = anchor.startsWith('top') ? 0 : anchor.startsWith('bottom') ? 1 : 0.5;
	return { x, y };
}

/**
 * Part of an image (`width` × `height`, showing the source's used area) that the window covered at source
 * time `t`, centered; `null` without size changes
 */
export function visibleRect(source: Source, t: number, width: number, height: number) {
	if (!source.sizes) return null;
	const v = contentSizeAt(source, t);
	const w = (Math.min(v.width, source.width) * width) / source.width;
	const h = (Math.min(v.height, source.height) * height) / source.height;
	return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}
