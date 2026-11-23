// Stamps: a framed word ("Approved", "Draft" …, optionally with a second line: who and when) or a picture, in a box
// on the page – saved as `/Stamp` annotations. They stay upright when the page is turned (only where they lie turns
// along). Pictures – pixels or vectors (`PdfPicture`) – are kept apart from the items (`stampImages`, by the item's
// `image` key): embedded once, drawn for the screen when first shown.

import type { BarcodeSpec } from '@in-browser/graphics/barcode.js';
import type { Box } from '@in-browser/ink/geometry.js';
import type { Ctx } from '@in-browser/ink/render/kit.js';
import { formBitmap, isForm, type PdfPicture } from '@in-browser/pdf/write/form.js';
import { imageBitmap } from '@in-browser/pdf/write/image.js';
import { svgForm } from '@in-browser/pdf/write/svg.js';
import { fontOf, textWidth } from './textbox.js';

export interface StampItem {
	id: string;
	type: 'stamp';
	/** Its box (page points as shown) */
	x: number;
	y: number;
	w: number;
	h: number;
	/** What it says, as the PDF standard names it (`/Name`: `Approved`, `Draft` …); `Image` for a picture */
	name: string;
	/** The word shown (in the language it was placed in) and the line below it */
	text?: string;
	sub?: string;
	/** `#rrggbb` (with an opacity) of frame and text */
	color: string;
	/** A picture instead of the word: its key in `stampImages` */
	image?: string;
	/** The picture is an icon drawn in `color`: its drawing, so another color draws it anew (`recolorIcon`) */
	icon?: StampIcon;
	/** The picture is a barcode: what it is made of, so it can be changed (“Edit barcode”) */
	barcode?: BarcodeSpec;
}

/** An icon's drawing (SVG markup, `currentColor` where its color goes) and its size */
export interface StampIcon {
	body: string;
	width: number;
	height: number;
}

/** An icon in a color (`#rrggbb`, optionally with an opacity) as SVG, `width` × `height` pixels */
export function iconSvg(icon: StampIcon, color: string, width = icon.width, height = icon.height): string {
	const opacity = color.length > 7 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${icon.width} ${icon.height}" opacity="${opacity}">${icon.body.replaceAll('currentColor', color.slice(0, 7))}</svg>`;
}

/** An icon stamp in another color: its vectors are drawn anew (at once as an item; the picture follows – a form
 * may still be on its way, whoever needs it waits) */
export function recolorIcon(s: StampItem & { icon: StampIcon }, color: string): StampItem {
	stampEvents.recolored?.(color);
	// As `svgForm` sizes it: 1 pixel = 0.75 points
	const pdf = svgForm(iconSvg(s.icon, color)).then((form) => {
		if (!form) throw new Error('The icon can not be drawn as vectors');
		return form.pdf;
	});
	pdf.catch(() => {});
	const key = crypto.randomUUID();
	registerStampImage(key, { width: s.icon.width * 0.75, height: s.icon.height * 0.75, pdf });
	return { ...s, color, image: key };
}

export const isStamp = (item: { readonly id: string }): item is StampItem => (item as StampItem).type === 'stamp';

export const stampBounds = (s: StampItem): Box => ({ x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h });

export { STAMP_NAMES, STAMPS, type StampName } from './stamp-names.js';

/** Height of a new stamp with one line, with two (points) */
const HEIGHT = 30;
const HEIGHT_SUB = 42;

/** Where a stamp's lines stand in its box (the same on screen and in the saved appearance): font sizes, baselines
 * from the top, the frame's width */
export function stampLayout(s: Pick<StampItem, 'w' | 'h' | 'text' | 'sub'>) {
	const frame = Math.max(0.75, s.h * 0.06);
	const room = Math.max(1, s.w - 2 * frame - s.h * 0.3);
	const fit = (text: string, size: number) => {
		const width = textWidth(text, size);
		const fitted = width > room ? (size * room) / width : size;
		return { text, size: fitted, x: (s.w - Math.min(width, room)) / 2 };
	};
	const main = fit(s.text ?? '', s.h * (s.sub ? 0.4 : 0.52));
	return {
		frame,
		main: { ...main, y: s.h * (s.sub ? 0.5 : 0.68) },
		sub: s.sub ? { ...fit(s.sub, s.h * 0.2), y: s.h * 0.8 } : null
	};
}

/** A new stamp saying `text` (and `sub` below) in `color`, its middle at (cx, cy). `name`: the standard's name of
 * the word, `Custom` for a word of the user's */
export function wordStamp(name: string, text: string, sub: string | undefined, cx: number, cy: number, color: string): StampItem {
	const h = sub ? HEIGHT_SUB : HEIGHT;
	const w = Math.max(textWidth(text, h * (sub ? 0.4 : 0.52)), sub ? textWidth(sub, h * 0.2) : 0) + h * 0.7;
	return { id: crypto.randomUUID(), type: 'stamp', x: cx - w / 2, y: cy - h / 2, w, h, name, text, ...(sub && { sub }), color };
}

/** A word stamp saying something else: as wide as the new lines need, around its middle; the height stays, but
 * for a second line that comes or goes */
export function withStampText(s: StampItem, text: string, sub: string | undefined): StampItem {
	const h = !!s.sub === !!sub ? s.h : sub ? (s.h * HEIGHT_SUB) / HEIGHT : (s.h * HEIGHT) / HEIGHT_SUB;
	const w = Math.max(textWidth(text, h * (sub ? 0.4 : 0.52)), sub ? textWidth(sub, h * 0.2) : 0) + h * 0.7;
	const { sub: _, ...rest } = s;
	return { ...rest, x: s.x + (s.w - w) / 2, y: s.y + (s.h - h) / 2, w, h, text, ...(sub && { sub }) };
}

// --- Pictures ---

/** A picture as a stamp on a page, its middle at (cx, cy) and wholly on the page: as big as on a screen (96 pixels
 * per inch; vectors in their own size) – or `side` points on its longer side (icons) –, at most half the page */
export function pictureStamp(picture: { key: string; width: number; height: number; vector?: boolean }, page: { w: number; h: number }, cx: number, cy: number, side?: number): StampItem {
	const k = Math.min(side ? side / Math.max(picture.width, picture.height) : picture.vector ? 1 : 72 / 96, (page.w * 0.5) / picture.width, (page.h * 0.5) / picture.height);
	const [w, h] = [picture.width * k, picture.height * k];
	const x = Math.max(0, Math.min(page.w - w, cx - w / 2));
	const y = Math.max(0, Math.min(page.h - h, cy - h / 2));
	return { id: crypto.randomUUID(), type: 'stamp', x, y, w, h, name: 'Image', color: '#000000', image: picture.key };
}

/** The pictures of stamps by key, as they are written into the PDF */
export const stampImages = new Map<string, PdfPicture>();
/** A picture as drawn for the screen: pixels are decoded once; vectors are drawn at `scale` pixels per point of
 * the form, and again when they are shown larger (`pending`: the scale being drawn) */
interface Drawn {
	bitmap: ImageBitmap | null;
	scale: number;
	pending: number;
	done: Promise<void>;
}
const bitmaps = new Map<string, Drawn>();
/** Most pixels of a vector picture drawn for the screen: beyond that (a large stamp, zoomed in far) it gets soft
 * here – in the file it stays vectors */
export const STAMP_PIXELS = 16_000_000;
/** A picture is decoded: draw the stamps showing it again (set by the open document) */
/** `recolored`: an icon was given a color (the tools remember it for the next icon) */
export const stampEvents: { ready: ((key: string) => void) | null; recolored: ((color: string) => void) | null } = { ready: null, recolored: null };

/** Remembers a picture under `key` (an item's `image`) */
export function registerStampImage(key: string, image: PdfPicture) {
	stampImages.set(key, image);
}

/** The scale a form is drawn at to be sharp at `need` pixels per point: steps of two (zooming doesn't draw it over
 * and over), capped by `STAMP_PIXELS` */
function formScale(form: { width: number; height: number }, need: number): number {
	const most = Math.sqrt(STAMP_PIXELS / Math.max(1, form.width * form.height));
	return Math.min(most, 2 ** Math.ceil(Math.log2(Math.max(0.25, need))));
}

/** A picture's pixels for the screen (null until they are there – `stampEvents.ready` tells). `need`: the pixels
 * per point of the picture it is shown at; vectors are drawn again when that is more than they have */
export function stampBitmap(key: string, need = 1): ImageBitmap | null {
	const image = stampImages.get(key);
	if (!image) return null;
	let drawn = bitmaps.get(key);
	if (!drawn) bitmaps.set(key, (drawn = { bitmap: null, scale: 0, pending: 0, done: Promise.resolve() }));
	const entry = drawn;
	const target = isForm(image) ? formScale(image, need) : 1;
	if (entry.scale >= target || entry.pending) return entry.bitmap;
	entry.pending = target;
	// What is there stays until the sharper one is ready
	entry.done = (isForm(image) ? formBitmap(image, target) : imageBitmap(image)).then(
		(bitmap) => {
			entry.bitmap?.close();
			entry.bitmap = bitmap;
			entry.scale = target;
			entry.pending = 0;
			stampEvents.ready?.(key);
		},
		(e) => {
			// Not asked for again at this scale
			entry.scale = target;
			entry.pending = 0;
			console.warn('[pdf-editor] stamp picture', e);
		}
	);
	return entry.bitmap;
}

/** Pixels per point of the picture a stamp is shown at on `ctx` */
function shownScale(ctx: Ctx, s: StampItem): number {
	const image = s.image ? stampImages.get(s.image) : undefined;
	if (!image || !isForm(image)) return 1;
	const t = ctx.getTransform();
	return Math.hypot(t.a, t.b) * Math.max(s.w / image.width, s.h / image.height);
}

/** Waits until the vector pictures of `items` are drawn for `scale` pixels per page point (printing draws once) */
export async function stampsSharp(items: readonly { readonly id: string }[], scale: number) {
	for (let round = 0; round < 8; round++) {
		const waiting: Promise<void>[] = [];
		for (const item of items) {
			if (!isStamp(item) || !item.image) continue;
			const image = stampImages.get(item.image);
			if (!image) continue;
			const need = isForm(image) ? scale * Math.max(item.w / image.width, item.h / image.height) : 1;
			stampBitmap(item.image, need);
			const entry = bitmaps.get(item.image);
			if (entry?.pending) waiting.push(entry.done);
		}
		if (!waiting.length) return;
		await Promise.all(waiting);
	}
}

/** Draws a stamp (page points) */
export function drawStamp(ctx: Ctx, s: StampItem) {
	if (s.image) {
		const bitmap = stampBitmap(s.image, shownScale(ctx, s));
		if (bitmap) ctx.drawImage(bitmap, s.x, s.y, s.w, s.h);
		else {
			ctx.fillStyle = '#9ca3af40';
			ctx.fillRect(s.x, s.y, s.w, s.h);
		}
		return;
	}
	const { frame, main, sub } = stampLayout(s);
	ctx.save();
	ctx.fillStyle = s.color;
	ctx.strokeStyle = s.color;
	// A tint of its color inside the frame
	ctx.globalAlpha *= STAMP_TINT;
	ctx.fillRect(s.x, s.y, s.w, s.h);
	ctx.globalAlpha /= STAMP_TINT;
	ctx.lineWidth = frame;
	ctx.lineJoin = 'round';
	ctx.strokeRect(s.x + frame / 2, s.y + frame / 2, s.w - frame, s.h - frame);
	ctx.textBaseline = 'alphabetic';
	for (const line of sub ? [main, sub] : [main]) {
		ctx.font = fontOf(line.size);
		ctx.fillText(line.text, s.x + line.x, s.y + line.y);
	}
	ctx.restore();
}

/** Opacity of the tint inside a stamp's frame */
export const STAMP_TINT = 0.1;
