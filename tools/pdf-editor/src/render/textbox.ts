// Text boxes: text typed onto the page, saved as `/FreeText` annotations. Lines are broken once when the text is
// written (`layoutText`, with Liberation Sans – the metrics of Helvetica, the font of the saved appearance), so the
// screen and every PDF viewer break them in the same places; drawing just writes the stored lines. The box lies on the
// page as shown; `rot` turns its text (the page turned after it was written). A background and a border (inside the
// box, the text inside it) are optional. Sizing and handles as everywhere in the suite (`@in-browser/graphics/text-box.js`):
// auto width, auto height or a fixed size; text that doesn't fit a fixed size runs out below the box.

import { handlePoint, resizeTextBox, TEXT_HANDLES, textBoxSize, wrapText, type TextHandle, type TextSizing } from '@in-browser/graphics/text-box.js';
import type { Box } from '@in-browser/ink/geometry.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';
import { standardFontUrl } from '@in-browser/pdf/pdfjs.js';

export interface TextItem {
	id: string;
	type: 'text';
	/** The box on the page as shown (page points) */
	x: number;
	y: number;
	w: number;
	h: number;
	/** Direction of the text in degrees clockwise (0, 90, 180, 270) */
	rot: number;
	/** Font size (points) */
	size: number;
	/** `#rrggbb`, or `#rrggbbaa` see-through */
	color: string;
	text: string;
	/** The text broken into lines for the box's width */
	lines: string[];
	/** Background (`#rrggbb[aa]`); none when missing */
	fill?: string | null;
	/** Border color (`#rrggbb[aa]`) and width (points); no border when the color is missing */
	border?: string | null;
	borderWidth?: number;
	/** How the box follows the text; missing: auto height (boxes written before there was a choice) */
	sizing?: TextSizing;
}

export const sizingOf = (t: Pick<TextItem, 'sizing'>): TextSizing => t.sizing ?? 'auto-height';

export const isText = (item: { readonly id: string }): item is TextItem => (item as TextItem).type === 'text';

/** Space between the box's edge and the text, line height and where the first baseline lies (× font size) – where a
 * browser puts it in a line of Liberation Sans 1.2 high (ascent 0.905, descent 0.212, centered), so the text field
 * typed into shows the text where it is drawn */
export const TEXT_PAD = 2;
export const LINE_HEIGHT = 1.2;
export const ASCENT = 0.947;

/** Border widths to choose from (points) */
export const BORDER_WIDTHS = [0.5, 1, 2, 3, 4];

/** Width of the box's border (0 without one) */
export const borderOf = (t: Pick<TextItem, 'border' | 'borderWidth'>) => (t.border ? (t.borderWidth ?? 1) : 0);

/** Space between the box's edge and its text: the border lies inside the box, the text inside the border */
export const padOf = (t: Pick<TextItem, 'border' | 'borderWidth'>) => TEXT_PAD + borderOf(t);

/** The family canvases draw text boxes in */
const FAMILY = 'PdfEditorSans';
let loading: Promise<void> | null = null;

/** Loads the font of text boxes once; `then` runs when it is there (draw again) */
export function loadTextFont(): Promise<void> {
	loading ??= (async () => {
		const url = standardFontUrl('LiberationSans-Regular.ttf');
		if (!url) return;
		const face = new FontFace(FAMILY, `url(${url})`);
		document.fonts.add(await face.load());
	})().catch((e) => console.warn('[pdf-editor] text font', e));
	return loading;
}

export const fontOf = (size: number) => `${size}px ${FAMILY}, Arial, Helvetica, sans-serif`;

/** Width and height of the text's own box (along and across its lines) */
export const textExtent = (t: TextItem) => (t.rot % 180 ? { w: t.h, h: t.w } : { w: t.w, h: t.h });

/** Height of a box holding `lines` lines */
export const textHeight = (lines: number, size: number, pad = TEXT_PAD) => 2 * pad + Math.max(1, lines) * size * LINE_HEIGHT;

let measurer: CanvasRenderingContext2D | null = null;

/** Width of `s` in the font of text boxes */
function measureWith(size: number): (s: string) => number {
	measurer ??= document.createElement('canvas').getContext('2d');
	const ctx = measurer!;
	ctx.font = fontOf(size);
	return (s) => ctx.measureText(s).width;
}

/** Width of `s` at `size` in the font of text boxes (Helvetica's metrics) */
export const textWidth = (s: string, size: number) => measureWith(size)(s);

/**
 * Breaks text into lines no wider than `width` (points, the box's padding included): at spaces, words longer than a
 * line at characters; an infinite width breaks only at Enter
 */
export function layoutText(text: string, size: number, width: number, pad = TEXT_PAD): string[] {
	const measure = measureWith(size);
	return wrapText(text, measure, Number.isFinite(width) ? Math.max(size, width - 2 * pad) : undefined).map((l) => l.text);
}

/** Smallest box: about two characters wide, one line high */
export const minTextSize = (t: Pick<TextItem, 'size' | 'border' | 'borderWidth'>) => ({ w: 2 * t.size + 2 * padOf(t), h: textHeight(1, t.size, padOf(t)) });

/** Room for the text from where it starts to the page's edge in its direction (points), for auto width */
export function roomOf(t: TextItem, page: { w: number; h: number }): number {
	switch (t.rot) {
		case 90:
			return page.h - t.y;
		case 180:
			return t.x + t.w;
		case 270:
			return t.y + t.h;
		default:
			return page.w - t.x;
	}
}

/**
 * The item with `text` written into it: its lines follow its sizing – auto width as wide as the longest line (no wider
 * than `room`, where it wraps), else at the box's width – and its box (auto height and auto width: as high as the
 * lines). The box keeps the corner its text starts at.
 */
export function withText(t: TextItem, text: string, room = Infinity): TextItem {
	const pad = padOf(t);
	const sizing = sizingOf(t);
	const extent = textExtent(t);
	const min = minTextSize(t);
	const width = sizing === 'auto-width' ? room : extent.w;
	const lines = layoutText(text, t.size, width, pad);
	const measure = measureWith(t.size);
	const widest = Math.max(...lines.map(measure), 0) + 2 * pad;
	const content = { w: Math.max(min.w, Math.min(Math.ceil(widest * 100) / 100, room)), h: textHeight(lines.length, t.size, pad) };
	const { w: along, h: across } = textBoxSize(sizing, extent, content);
	const box = t.rot % 180 ? { w: across, h: along } : { w: along, h: across };
	// The corner the text starts at stays: right for text running left or downwards, bottom for text running up or
	// upside down
	const x = t.rot === 90 || t.rot === 180 ? t.x + t.w - box.w : t.x;
	const y = t.rot === 180 || t.rot === 270 ? t.y + t.h - box.h : t.y;
	return { ...t, text, lines, x, y, ...box };
}

/** How far the text runs out of a box of fixed size (points, across its lines) */
export const overflowOf = (t: TextItem) => Math.max(0, textHeight(t.lines.length, t.size, padOf(t)) - textExtent(t).h);

/** The compass directions clockwise, to turn handles with the text */
const COMPASS: TextHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/** The handles of a text box on the page (corners, then sides – `TEXT_HANDLES`) */
export const textHandles = (t: TextItem): [number, number][] => TEXT_HANDLES.map((h) => handlePoint(t, h));

/**
 * The text box with handle `index` (`textHandles`) dragged to (x, y): its box changes (Figma: sides set the width,
 * the rest a fixed size), the font only with `scaleText`. Worked out along the text's own direction.
 */
export function moveTextHandle(t: TextItem, index: number, x: number, y: number, o: { keepAspect: boolean; scaleText: boolean }, room = Infinity): TextItem {
	const onPage = TEXT_HANDLES[index];
	const [hx, hy] = handlePoint(t, onPage);
	const turn = (t.rot * Math.PI) / 180;
	const cos = Math.round(Math.cos(turn));
	const sin = Math.round(Math.sin(turn));
	// Into the text's own frame: along its lines and down across them
	const du = (x - hx) * cos + (y - hy) * sin;
	const dv = -(x - hx) * sin + (y - hy) * cos;
	const own = COMPASS[(COMPASS.indexOf(onPage) - (t.rot / 90) * 2 + 8) % 8];
	const extent = textExtent(t);
	const min = minTextSize(t);
	const r = resizeTextBox({ x: 0, y: 0, ...extent }, sizingOf(t), own, du, dv, { ...o, minW: min.w, minH: min.h });
	// Back onto the page: the text's own top left corner moves by the result's offset
	const along = [cos, sin];
	const down = [-sin, cos];
	const cx = t.x + t.w / 2 - (along[0] * extent.w + down[0] * extent.h) / 2 + r.rect.x * along[0] + r.rect.y * down[0];
	const cy = t.y + t.h / 2 - (along[1] * extent.w + down[1] * extent.h) / 2 + r.rect.x * along[1] + r.rect.y * down[1];
	const mx = cx + (along[0] * r.rect.w + down[0] * r.rect.h) / 2;
	const my = cy + (along[1] * r.rect.w + down[1] * r.rect.h) / 2;
	const box = t.rot % 180 ? { w: r.rect.h, h: r.rect.w } : { w: r.rect.w, h: r.rect.h };
	const round = (v: number) => Math.round(v * 100) / 100;
	const scaled =
		r.scale === 1
			? {}
			: { size: round(t.size * r.scale), ...(t.borderWidth ? { borderWidth: round(t.borderWidth * r.scale) } : {}) };
	return withText({ ...t, ...scaled, sizing: r.sizing, x: mx - box.w / 2, y: my - box.h / 2, ...box }, t.text, room);
}

/** The box and text running out of it (below the lines, in the text's direction) */
export function textBounds(t: TextItem): Box {
	const over = overflowOf(t);
	const box = { x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + t.h };
	if (!over) return box;
	if (t.rot === 90) box.x0 -= over;
	else if (t.rot === 180) box.y0 -= over;
	else if (t.rot === 270) box.x1 += over;
	else box.y1 += over;
	return box;
}

/** Draws a text box (page points): background, border, then its lines from its top left corner in its direction */
export function drawText(ctx: Ctx, t: TextItem) {
	const { w, h } = textExtent(t);
	const bw = borderOf(t);
	const pad = TEXT_PAD + bw;
	ctx.save();
	ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
	if (t.rot) ctx.rotate((t.rot * Math.PI) / 180);
	if (t.fill) {
		ctx.fillStyle = t.fill;
		ctx.fillRect(-w / 2, -h / 2, w, h);
	}
	if (bw) {
		ctx.strokeStyle = t.border!;
		ctx.lineWidth = bw;
		ctx.setLineDash([]);
		ctx.strokeRect(-w / 2 + bw / 2, -h / 2 + bw / 2, w - bw, h - bw);
	}
	ctx.font = fontOf(t.size);
	ctx.fillStyle = t.color;
	ctx.textBaseline = 'alphabetic';
	for (let i = 0; i < t.lines.length; i++) ctx.fillText(t.lines[i], -w / 2 + pad, -h / 2 + pad + t.size * (ASCENT + i * LINE_HEIGHT));
	ctx.restore();
}
