// Annotations already in the file as items of the editor, so they can be selected, changed and deleted like drawn
// ones: ink, lines, open lines, boxes, ellipses, polygons and marked text (also wavy underlines). Ours carry the item itself (`/InBrowser`, with the
// `/M` it was written with – changed elsewhere since, the standard entries count); others are read from their
// standard entries (`/InkList`, `/L`, `/QuadPoints` …). Kinds the editor can't draw stay as they are in the file.

import type { ShapeItem, Stroke } from '@in-browser/ink/items.js';
import { closed, withHeads, type LineEnd } from '@in-browser/ink/shapes.js';
import type { ExistingAnnotation, NewAnnotation, Rgb } from '@in-browser/pdf/write/annotations.js';
import { pdfDate } from '@in-browser/pdf/write/annotations.js';
import { rotatePdfItem, type Annotatable, type MarkupItem, type PdfItem } from '#lib/render/markup.js';
import { isNote, NOTE_ICONS, NOTE_SIZE, type NoteIcon } from '#lib/render/note.js';
import { isStamp } from '#lib/render/stamp.js';
import { caretIn } from '#lib/render/caret.js';
import { isLink } from '#lib/render/link.js';
import type { Box } from '@in-browser/ink/geometry.js';
import { layoutText, padOf, withRich, type TextItem } from '#lib/render/textbox.js';
import { richFromContents } from './rich-pdf.js';

/** User space → page points as shown (`toShown` of `@in-browser/pdf/geometry.js`) */
export type ToPage = (x: number, y: number) => [number, number];

/** What `/InBrowser` holds */
interface Saved {
	/** `/M` as written with it */
	m: string;
	/** The page's rotation the item's points are for, and the page's size then */
	r: number;
	w: number;
	h: number;
	item: unknown;
}

const hex = (c: Rgb) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
/** `/LE` names as the ends lines carry here (the reversed arrows as their plain ones, `/Slash` as a bar) */
const ENDS: Record<string, LineEnd> = { OpenArrow: 'arrow', ROpenArrow: 'arrow', ClosedArrow: 'closed', RClosedArrow: 'closed', Circle: 'circle', Square: 'square', Diamond: 'diamond', Butt: 'bar', Slash: 'bar' };
const lineEnd = (name: string | undefined): LineEnd | null => (name && ENDS[name]) || null;

/** Color of a note without one */
const NOTE_YELLOW: Rgb = [1, 0.82, 0.25];
const round = (v: number) => Math.round(v * 100) / 100;
/** Two hex digits of an opacity 0…1 */
const alphaHex = (opacity: number) => Math.round(Math.min(1, Math.max(0, opacity)) * 255).toString(16).padStart(2, '0');

/** A part's opacity: its own in the appearance (if read) times `/CA`, which viewers apply to the whole annotation */
const opacityOf = (a: ExistingAnnotation, own: number | undefined) => Math.min(1, Math.max(0, a.opacity * (own ?? 1)));

/** `#rrggbb` with an opacity below 1 as `#rrggbbaa` */
const withOpacity = (color: string, opacity: number) =>
	opacity < 1 ? color + Math.round(Math.max(0, opacity) * 255).toString(16).padStart(2, '0') : color;

/** The `/InBrowser` entry for an item written with `/M` of `modified`, on a page shown `w`×`h` turned by `rotation` */
export function savedData(item: Annotatable, modified: Date, rotation: number, w: number, h: number): string {
	const plain = 'points' in item ? { ...item, points: Array.from(item.points, round) } : item;
	const saved: Saved = { m: pdfDate(modified).slice(1, -1), r: rotation, w: round(w), h: round(h), item: plain };
	return JSON.stringify(saved);
}

/** `annotation` with the item it comes from, so the editor finds it again exactly */
export function withData(annotation: NewAnnotation, item: Annotatable, modified: Date, rotation: number, w: number, h: number): NewAnnotation {
	return { ...annotation, data: savedData(item, modified, rotation, w, h) };
}

/** The item saved with an annotation, turned to the page's rotation now; null when it was changed elsewhere since */
function savedItem(a: ExistingAnnotation, rotation: number): PdfItem | null {
	if (!a.data) return null;
	try {
		const saved = JSON.parse(a.data) as Saved;
		if (saved.m !== a.modified || !saved.item || typeof saved.item !== 'object') return null;
		const raw = saved.item as PdfItem & { points?: number[] };
		const item = (Array.isArray(raw.points) ? { ...raw, points: Float32Array.from(raw.points) } : raw) as PdfItem;
		const quarters = Math.round((rotation - saved.r) / 90);
		return quarters % 4 ? rotatePdfItem(item, quarters, saved.w, saved.h) : item;
	} catch {
		return null;
	}
}

/**
 * The items of an annotation of the file (several for an ink annotation of several strokes); none when the editor
 * can't show it as it is. `id` gives each a unique id.
 */
export function itemsOf(a: ExistingAnnotation, toPage: ToPage, rotation: number, id: (wanted: string | undefined) => string): PdfItem[] {
	const saved = savedItem(a, rotation);
	// A stamp's picture is the file's: without it (changed elsewhere) the stamp stays as the file draws it
	if (saved && isStamp(saved) && saved.image && !a.image) return [];
	// So is an attachment's file
	if (saved && isNote(saved) && saved.file && !a.file) return [];
	if (a.subtype === 'FileAttachment' && !a.file) return [];
	// A link of ours: its box as saved, its target as the file says. Other programs' links stay the file's
	if (a.subtype === 'Link') return saved && isLink(saved) ? [{ id: id(saved.id), type: 'link', x: saved.x, y: saved.y, w: saved.w, h: saved.h, ...(a.uri ? { url: a.uri } : a.destPage !== undefined ? { page: String(a.destPage) } : {}) }] : [];
	if (saved) return [{ ...saved, id: id(saved.id) }];

	if (a.subtype === 'FreeText') {
		// Font size and color from `/DA` ("/Helv 12 Tf 0 0 1 rg"); the text upright in the PDF's own space
		const da = a.defaultAppearance ?? '';
		const size = Number(/([\d.]+)\s+Tf/.exec(da)?.[1]) || 12;
		const rgbColor = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/.exec(da);
		const gray = /([\d.]+)\s+g(?:\s|$)/.exec(da);
		const color: Rgb = rgbColor ? [Number(rgbColor[1]), Number(rgbColor[2]), Number(rgbColor[3])] : gray ? [Number(gray[1]), Number(gray[1]), Number(gray[1])] : [0, 0, 0];
		// The border: a stroke color in `/DA` (where PDF programs write it) and `/BS` width; the background `/C`
		const stroke = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+RG/.exec(da);
		// Opacities: each part's own from the appearance times `/CA` for the whole box
		const strokeHex = stroke && a.width > 0 ? hex([Number(stroke[1]), Number(stroke[2]), Number(stroke[3])]) : null;
		const border = strokeHex && withOpacity(strokeHex, opacityOf(a, a.paint?.stroke));
		const fill = a.color ? withOpacity(hex(a.color), opacityOf(a, a.paint?.fill)) : null;
		const style = { fill, border, borderWidth: border ? a.width : undefined };
		const [l, t, r, b] = a.inset ?? [0, 0, 0, 0];
		const [ax, ay] = toPage(a.rect[0] + l, a.rect[3] - t);
		const [bx, by] = toPage(a.rect[2] - r, a.rect[1] + b);
		const box = { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
		const text = a.contents ?? '';
		const along = rotation % 180 ? box.h : box.w;
		// A callout points at the first point of its line
		const callout = a.callout && a.callout.length >= 4 ? { callout: toPage(a.callout[0], a.callout[1]) } : {};
		const align = a.quadding === 1 ? ({ align: 'center' } as const) : a.quadding === 2 ? ({ align: 'right' } as const) : {};
		const item: TextItem = { id: id(a.name), type: 'text', ...align, ...callout, ...box, rot: ((rotation % 360) + 360) % 360, size, color: withOpacity(hex(color), opacityOf(a, a.paint?.text)), text, lines: layoutText(text, size, along, padOf(style)), ...style, sizing: 'fixed' };
		// Its text with formats, where the program that wrote it kept them (`/RC`): laid out anew in our fonts – the
		// lines may break elsewhere than there, the box keeps its size
		const rich = a.richContents ? richFromContents(a.richContents, a.defaultStyle, { font: 'sans', bold: false, italic: false, underline: false, size, color: item.color }) : null;
		return [rich ? withRich(item, rich) : item];
	}
	if (a.subtype === 'Text' || a.subtype === 'FileAttachment') {
		// Upright around its box's middle (its size is ours)
		const [ax, ay] = toPage(a.rect[0], a.rect[3]);
		const [bx, by] = toPage(a.rect[2], a.rect[1]);
		const x = (ax + bx - NOTE_SIZE) / 2;
		const y = (ay + by - NOTE_SIZE) / 2;
		const icon = NOTE_ICONS.includes(a.icon as NoteIcon) && a.icon !== 'Comment' ? (a.icon as NoteIcon) : undefined;
		return [{ id: id(a.name), type: 'note', x, y, color: withOpacity(hex(a.color ?? NOTE_YELLOW), opacityOf(a, a.paint?.fill)), text: a.contents ?? '', ...(icon && { icon }), ...(a.file && { file: { key: `file:${a.id}`, name: a.file.name, size: a.file.bytes.length } }) }];
	}
	if (a.subtype === 'Caret') {
		// Another program's mark: ours in its place, reading along the page as shown
		const [ax, ay] = toPage(a.rect[0], a.rect[3]);
		const [bx, by] = toPage(a.rect[2], a.rect[1]);
		const box = { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
		// A replacement of another program: the text its strike-outs mark
		const struck = (a.grouped ?? []).flatMap((part) => {
			const boxes: Box[] = [];
			for (let q = 0; q + 7 < part.quadPoints.length; q += 8) {
				const corners = [0, 2, 4, 6].map((k) => toPage(part.quadPoints[q + k], part.quadPoints[q + k + 1]));
				boxes.push({ x0: Math.min(...corners.map((c) => c[0])), y0: Math.min(...corners.map((c) => c[1])), x1: Math.max(...corners.map((c) => c[0])), y1: Math.max(...corners.map((c) => c[1])) });
			}
			return boxes;
		});
		const marked = (a.grouped ?? []).map((part) => part.contents ?? '').filter(Boolean).join(' ');
		return [
			{
				id: id(a.name),
				type: 'caret',
				...caretIn(box, ((rotation % 360) + 360) % 360),
				color: `${hex(a.color ?? [0.15, 0.39, 0.92])}${alphaHex(opacityOf(a, a.paint?.stroke ?? a.paint?.fill))}`,
				text: a.contents ?? '',
				...(struck.length && { replaces: struck, marked })
			}
		];
	}
	const color = a.color ?? (a.subtype === 'Square' || a.subtype === 'Circle' || a.subtype === 'Polygon' ? a.interior : undefined);
	if (!color) return [];
	// A line's opacity: its stroke's in the appearance (some draw ink as fills), times `/CA`
	const lineOpacity = opacityOf(a, a.color ? (a.paint?.stroke ?? a.paint?.fill) : a.paint?.fill);
	const points = (flat: readonly number[]) => {
		const out: number[] = [];
		for (let i = 0; i + 1 < flat.length; i += 2) out.push(...toPage(flat[i], flat[i + 1]));
		return out;
	};
	const shape = (fit: ShapeItem['fit']): ShapeItem => ({
		id: id(a.name),
		type: 'shape',
		fit,
		color: withOpacity(hex(color), lineOpacity),
		size: a.width || 1,
		...(a.interior && a.color && closed(fit) && { fill: `${hex(a.interior)}${alphaHex(opacityOf(a, a.paint?.fill))}` }),
		...(a.dash && { dash: a.dash[0] <= a.width ? ('dotted' as const) : ('dashed' as const) }),
		...(a.cloud && closed(fit) && { cloud: true as const })
	});
	/** The shape's box: `/Rect` less `/RD` and half the line (the line lies inside it) */
	const box = () => {
		const [l, t, r, b] = a.inset ?? [0, 0, 0, 0];
		const pad = (a.width || 0) / 2;
		const [x0, y0] = toPage(a.rect[0] + l + pad, a.rect[1] + b + pad);
		const [x1, y1] = toPage(a.rect[2] - r - pad, a.rect[3] - t - pad);
		return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
	};

	switch (a.subtype) {
		case 'Ink':
			return (a.inkList ?? [])
				.filter((path) => path.length >= 2)
				.map((path, k): Stroke => {
					const xy = points(path);
					const pts = new Float32Array((xy.length / 2) * 3);
					for (let i = 0; i < xy.length / 2; i++) pts.set([xy[i * 2], xy[i * 2 + 1], 0.5], i * 3);
					return { id: id(k ? undefined : a.name), tool: 'pen', color: withOpacity(hex(color), lineOpacity), size: a.width || 1, points: pts };
				});
		case 'Line': {
			if (!a.line) return [];
			const [x0, y0, x1, y1] = points(a.line);
			return [shape(withHeads({ kind: 'line', x0, y0, x1, y1 }, lineEnd(a.lineEndings?.[0]), lineEnd(a.lineEndings?.[1])))];
		}
		case 'PolyLine':
			return (a.vertices?.length ?? 0) >= 4 ? [shape(withHeads({ kind: 'polyline', points: points(a.vertices!) }, lineEnd(a.lineEndings?.[0]), lineEnd(a.lineEndings?.[1])))] : [];
		case 'Square':
			return [shape({ kind: 'roundedRect', ...box() })];
		case 'Circle':
			return [shape({ kind: 'ellipse', ...box() })];
		case 'Polygon':
			return (a.vertices?.length ?? 0) >= 6 ? [shape({ kind: 'polygon', points: points(a.vertices!) })] : [];
		case 'Highlight':
		case 'Underline':
		case 'Squiggly':
		case 'StrikeOut': {
			const quads = a.quadPoints ?? [];
			if (quads.length < 8) return [];
			const boxes: MarkupItem['boxes'] = [];
			let dir = 0;
			for (let q = 0; q + 7 < quads.length; q += 8) {
				const p = points(quads.slice(q, q + 8));
				const xs = [p[0], p[2], p[4], p[6]];
				const ys = [p[1], p[3], p[5], p[7]];
				boxes.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
				// Upper left → upper right: the reading direction on the page as shown
				if (q === 0) dir = (Math.round((Math.atan2(p[3] - p[1], p[2] - p[0]) * 180) / Math.PI / 90) * 90 + 360) % 360;
			}
			const kind = a.subtype === 'Highlight' ? 'highlight' : a.subtype === 'Underline' ? 'underline' : a.subtype === 'Squiggly' ? 'squiggly' : 'strikeout';
			// A highlight is a fill, underline and strike-out are a fill or a stroke
			const own = kind === 'highlight' ? (a.paint?.fill ?? a.paint?.stroke) : (a.paint?.stroke ?? a.paint?.fill);
			return [{ id: id(a.name), type: 'markup', kind, color: `${hex(color)}${alphaHex(opacityOf(a, own))}`, boxes, dir, text: a.contents ?? '' }];
		}
	}
	return [];
}
