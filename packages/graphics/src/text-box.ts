// Text boxes, the same in every tool (as in Figma): three sizings, handles that change only the box, the font scaled
// only on request. Pure and unit-free: the tool measures (`measure`) and maps its own coordinates.
//
// - `auto-width`: as wide as the longest line, lines break only at Enter (and at the edge of the frame the tool gives)
// - `auto-height`: a fixed width, lines wrap, the height follows the text
// - `fixed`: width and height fixed; text that doesn't fit runs out below, the box stays
//
// Creating: a click → auto width, dragging a box → fixed size. Handles: left/right → the width (auto width becomes
// auto height), top/bottom and corners → fixed size; Shift keeps a corner's proportions. Only with `scaleText` (the
// tool's modifier, K) does the box scale with its font.

import type { Rect } from './snap.js';

export type TextSizing = 'auto-width' | 'auto-height' | 'fixed';

export interface TextLine {
	text: string;
	/** Ends a paragraph (stays left-aligned in justified text) */
	last: boolean;
}

/**
 * Breaks text into lines like a browser's text field: paragraphs at `\n`; with `maxWidth`, between words (spaces stay
 * with the word before, trailing ones don't count), a word too long on its own between characters (at least one per
 * line). Without `maxWidth` only at `\n`.
 */
export function wrapText(text: string, measure: (s: string) => number, maxWidth?: number): TextLine[] {
	const lines: TextLine[] = [];
	const fits = (s: string) => maxWidth === undefined || measure(s) <= maxWidth;
	for (const paragraph of text.split('\n')) {
		if (maxWidth === undefined) {
			lines.push({ text: paragraph.trimEnd(), last: true });
			continue;
		}
		let line = '';
		for (const word of paragraph.split(/(?<= )/)) {
			if (fits(line + word.trimEnd())) {
				line += word;
				continue;
			}
			if (line) lines.push({ text: line.trimEnd(), last: false });
			line = '';
			let rest = word;
			while (!fits(rest.trimEnd()) && rest.length > 1) {
				let n = rest.length - 1;
				while (n > 1 && !fits(rest.slice(0, n))) n--;
				lines.push({ text: rest.slice(0, n), last: false });
				rest = rest.slice(n);
			}
			line = rest;
		}
		lines.push({ text: line.trimEnd(), last: true });
	}
	return lines;
}

/** Width of the longest line */
export const widestLine = (lines: readonly TextLine[], measure: (s: string) => number) => lines.reduce((w, l) => Math.max(w, measure(l.text)), 0);

/**
 * The box of a text in its sizing: `content` is what the text needs (the longest line and all lines, padding
 * included), `box` the box it has. Auto width takes the content, auto height the box's width and the content's
 * height, fixed size the box.
 */
export function textBoxSize(sizing: TextSizing, box: { w: number; h: number }, content: { w: number; h: number }): { w: number; h: number } {
	if (sizing === 'auto-width') return content;
	if (sizing === 'auto-height') return { w: box.w, h: content.h };
	return { w: box.w, h: box.h };
}

/** Handles of a text box: corners and the middles of the sides */
export type TextHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** All handles, corners first, then the sides */
export const TEXT_HANDLES: readonly TextHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];

/** Where a handle sits on a box */
export function handlePoint(r: Rect, handle: TextHandle): [number, number] {
	const x = handle.includes('w') ? r.x : handle.includes('e') ? r.x + r.w : r.x + r.w / 2;
	const y = handle.includes('n') ? r.y : handle.includes('s') ? r.y + r.h : r.y + r.h / 2;
	return [x, y];
}

/** The sizing after dragging a handle: left/right keep the text wrapping (auto width → auto height), the rest fixes the size */
export function sizingAfter(sizing: TextSizing, handle: TextHandle): TextSizing {
	if (handle === 'e' || handle === 'w') return sizing === 'fixed' ? 'fixed' : 'auto-height';
	return 'fixed';
}

export interface ResizeOptions {
	/** Corners keep the box's proportions (Shift) */
	keepAspect?: boolean;
	/** The box scales with its font (K): the result's `scale`; the sizing stays */
	scaleText?: boolean;
	/** Smallest width and height */
	minW?: number;
	minH?: number;
}

export interface Resized {
	rect: Rect;
	sizing: TextSizing;
	/** Factor of the font, padding and border (1 unless `scaleText`) */
	scale: number;
}

/**
 * A box after dragging `handle` by (dx, dy); the opposite side or corner stays. Without `scaleText` only the box
 * changes (the caller lays the text out again; with auto height its height then follows the text).
 */
export function resizeTextBox(start: Rect, sizing: TextSizing, handle: TextHandle, dx: number, dy: number, options: ResizeOptions = {}): Resized {
	const { minW = 1, minH = 1 } = options;
	const west = handle.includes('w');
	const east = handle.includes('e');
	const north = handle.includes('n');
	const south = handle.includes('s');
	let w = start.w + (east ? dx : west ? -dx : 0);
	let h = start.h + (south ? dy : north ? -dy : 0);
	let scale = 1;
	if (options.scaleText) {
		// Uniform: by the dragged axis (the larger change at a corner)
		const kx = start.w > 0 ? w / start.w : 1;
		const ky = start.h > 0 ? h / start.h : 1;
		scale = east || west ? (north || south ? (Math.abs(kx - 1) > Math.abs(ky - 1) ? kx : ky) : kx) : ky;
		scale = Math.max(scale, minW / Math.max(start.w, 1e-9), minH / Math.max(start.h, 1e-9), 0.05);
		w = start.w * scale;
		h = start.h * scale;
	} else {
		if ((east || west) && (north || south) && options.keepAspect && start.w > 0 && start.h > 0) {
			const k = Math.max(w / start.w, h / start.h);
			w = start.w * k;
			h = start.h * k;
		}
		w = Math.max(w, minW);
		h = Math.max(h, minH);
	}
	// The opposite side or corner stays; scaled from a side, the box grows evenly across it
	const x = west ? start.x + start.w - w : east ? start.x : options.scaleText ? start.x + (start.w - w) / 2 : start.x;
	const y = north ? start.y + start.h - h : south ? start.y : options.scaleText ? start.y + (start.h - h) / 2 : start.y;
	return { rect: { x, y, w, h }, sizing: options.scaleText ? sizing : sizingAfter(sizing, handle), scale };
}
