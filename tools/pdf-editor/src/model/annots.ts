// Ink drawn on a page (strokes and shapes of the ink core) as real PDF annotations: pen and highlighter strokes are
// `/Ink`, lines and arrows `/Line`, open lines `/PolyLine`, boxes `/Square` and `/Circle`, other shapes `/Polygon`
// (clouds with `/BE`). The appearance is the
// same vector paint as on screen (`paintOf`), so every viewer shows exactly what was drawn; the other entries carry
// the meaning for viewers that edit annotations. Items live in page points as shown (y down, the page's rotation
// applied); annotations in the PDF's user space – `toUser` turns one into the other.

import { isShape, type Ink } from '@in-browser/ink/items.js';
import { inkAlpha } from '@in-browser/ink/outline.js';
import { paintOf } from '@in-browser/ink/paint.js';
import { endOf } from '@in-browser/ink/shapes.js';
import { inWinAnsi, num, winAnsi, type NewAnnotation, type Rgb } from '@in-browser/pdf/write/annotations.js';
import { UNICODE_FONT, unicodeText } from '@in-browser/pdf/write/unicode.js';
import { isMarkup, markLine, squiggle, type Annotatable, type MarkupItem } from '#lib/render/markup.js';
import { alignOf, ASCENT, baseStyle, borderOf, calloutColor, calloutHead, calloutLine, calloutWidth, isFormatted, isText, itemBounds, LINE_HEIGHT, lineRuns, padOf, richLines, richTextOf, textExtent, UNDERLINE, type TextItem } from '#lib/render/textbox.js';
import { asDocumentFont, type FullStyle } from '@in-browser/graphics/rich-text.js';
import { defaultStyleOf, richContentsOf } from './rich-pdf.js';
import { CARET_LINE, caretPoints, isCaret, type CaretItem } from '#lib/render/caret.js';
import { isLink, safeUrl, type LinkItem } from '#lib/render/link.js';
import { isMeasured, labelBox, measureLabel, unitsPerPoint, type Measured } from '#lib/render/measure.js';
import { isForm } from '@in-browser/pdf/write/form.js';
import { isStamp, STAMP_TINT, stampImages, stampLayout, type StampItem } from '#lib/render/stamp.js';
import { isNote, NOTE_INK, NOTE_SIZE, noteIconOf, type NoteItem, attachedFiles, noteShape } from '#lib/render/note.js';

/** Page points as shown → PDF user space (`toUserSpace` of `@in-browser/pdf/geometry.js`) */
export type ToUser = (x: number, y: number) => [number, number];

export function rgbOf(hex: string): Rgb {
	const v = (i: number) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000;
	return [v(1), v(3), v(5)];
}

/** Opacity of a `#rrggbbaa` color (1 for `#rrggbb`), rounded to hundredths */
export const alphaOf = (hex: string) => (hex.length === 9 ? Math.round((parseInt(hex.slice(7, 9), 16) / 255) * 100) / 100 : 1);

/** Ops drawn with an opacity: wrapped in a graphics state of its own (`A<percent>`), registered in `states` */
function withAlpha(states: NonNullable<NewAnnotation['appearance']['states']>, alpha: number, ops: string): string {
	if (alpha >= 1) return ops;
	const name = `A${Math.round(alpha * 100)}`;
	states[name] = { alpha };
	return `q /${name} gs ${ops} Q`;
}

const rgbOps = (c: Rgb, stroke: boolean) => `${c.map(num).join(' ')} ${stroke ? 'RG' : 'rg'}`;

/** Dash lengths for a pen size, like the dashes drawn (`shapes.ts`) */
const dashOf = (dash: string | undefined, size: number): number[] | undefined =>
	dash === 'dashed' ? [size * 4, size * 3] : dash === 'dotted' ? [0.01, size * 2.5] : undefined;

/** The annotation of a stroke, shape, marked text, note, text box or stamp */
export function annotationOf(item: Annotatable, toUser: ToUser, author: string | undefined, modified: Date, placeOf?: (pageId: string) => number): NewAnnotation {
	if (isMarkup(item)) return markupAnnotation(item, toUser, author, modified);
	if (isLink(item)) return linkAnnotation(item, toUser, modified, placeOf);
	if (isMeasured(item)) {
		const { measure: _, ...shape } = item;
		return measureAnnotation(item, annotationOf(shape, toUser, author, modified), toUser);
	}
	if (isStamp(item)) return stampAnnotation(item, toUser, author, modified);
	if (isCaret(item)) return caretAnnotation(item, toUser, author, modified);
	if (isNote(item)) return noteAnnotation(item, toUser, author, modified);
	if (isText(item)) return textAnnotation(item, toUser, author, modified);
	const ops: string[] = [];
	const states: NonNullable<NewAnnotation['appearance']['states']> = {};
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	const point = (x: number, y: number, pad: number) => {
		const [ux, uy] = toUser(x, y);
		x0 = Math.min(x0, ux - pad);
		y0 = Math.min(y0, uy - pad);
		x1 = Math.max(x1, ux + pad);
		y1 = Math.max(y1, uy + pad);
		return `${num(ux)} ${num(uy)}`;
	};
	const groups: string[] = [];
	for (const p of paintOf(item)) {
		if (p.kind === 'fill') {
			const alpha = p.alpha < 1 ? `F${Math.round(p.alpha * 100)}` : null;
			if (alpha) {
				states[alpha] = { alpha: p.alpha };
				ops.push(`q /${alpha} gs`);
			}
			ops.push(rgbOps(rgbOf(p.color), false));
			const o = p.outline;
			ops.push(`${point(o[0], o[1], 0)} m`);
			for (let i = 2; i < o.length; i += 2) ops.push(`${point(o[i], o[i + 1], 0)} l`);
			ops.push('h f');
			if (alpha) ops.push('Q');
		} else {
			const line = [`${rgbOps(rgbOf(p.color), true)} 1 J 1 j`];
			for (const run of p.runs) {
				const pad = run.width / 2 + 1;
				line.push(`${num(run.width)} w ${point(run.points[0], run.points[1], pad)} m`);
				for (let i = 2; i < run.points.length; i += 2) line.push(`${point(run.points[i], run.points[i + 1], pad)} l`);
				line.push('S');
			}
			if (p.alpha < 1 || p.highlighter) {
				// See-through or multiplied as a whole (a group): where its runs overlap it doesn't get darker
				const name = `L${groups.length}`;
				states[name] = { alpha: p.alpha < 1 ? p.alpha : undefined, multiply: p.highlighter || undefined };
				ops.push(`q /${name} gs /X${groups.length} Do Q`);
				groups.push(line.join('\n'));
			} else ops.push(...line);
		}
	}

	const base = {
		name: item.id,
		color: rgbOf(item.color),
		author,
		modified,
		width: item.size,
		// See-through ink only in the appearance, per part: `/CA` would apply to the whole annotation (its fill too) on
		// top of it in viewers that honor it
		appearance: { content: ops.join('\n'), states, groups }
	};
	const rect = () => [x0, y0, x1, y1].map((v) => Math.round(v * 100) / 100) as NewAnnotation['rect'];
	const finish = (a: NewAnnotation): NewAnnotation => ({ ...a, rect: rect() });
	/** A box or ellipse: where its line runs inside `/Rect` (`/RD`), so viewers drawing it anew draw it there */
	const boxed = (a: NewAnnotation, fit: { x: number; y: number; w: number; h: number }): NewAnnotation => {
		const r = rect();
		const [ax, ay] = toUser(fit.x, fit.y);
		const [bx, by] = toUser(fit.x + fit.w, fit.y + fit.h);
		const half = item.size / 2;
		const inset = [Math.min(ax, bx) - r[0], r[3] - Math.max(ay, by), r[2] - Math.max(ax, bx), Math.min(ay, by) - r[1]].map((v) => Math.round((v - half) * 100) / 100);
		return { ...a, rect: r, inset: inset as NewAnnotation['inset'] };
	};
	const flat = (pts: ArrayLike<number>, step: number) => {
		const out: number[] = [];
		for (let i = 0; i < pts.length; i += step) out.push(...toUser(pts[i], pts[i + 1]));
		return out;
	};
	if (!isShape(item)) return finish({ ...base, subtype: 'Ink', rect: [0, 0, 0, 0], inkList: [flat(item.points, 3)] });

	const fit = item.fit;
	const style = { dash: dashOf(item.dash, item.size), interior: item.fill ? rgbOf(item.fill) : undefined };
	const cloud = item.cloud ? { cloud: 1 } : {};
	switch (fit.kind) {
		case 'line':
			return finish({
				...base,
				...style,
				subtype: 'Line',
				rect: [0, 0, 0, 0],
				line: [...toUser(fit.x0, fit.y0), ...toUser(fit.x1, fit.y1)],
				lineEndings: [LINE_ENDINGS[endOf(fit.start) ?? 'none'], LINE_ENDINGS[endOf(fit.end) ?? 'none']]
			});
		case 'polyline':
			return finish({
				...base,
				...style,
				interior: undefined,
				subtype: 'PolyLine',
				rect: [0, 0, 0, 0],
				vertices: flat(fit.points, 2),
				lineEndings: [LINE_ENDINGS[endOf(fit.start) ?? 'none'], LINE_ENDINGS[endOf(fit.end) ?? 'none']]
			});
		case 'polygon':
			return finish({ ...base, ...style, ...cloud, subtype: 'Polygon', rect: [0, 0, 0, 0], vertices: flat(fit.points, 2) });
		case 'ellipse':
			return boxed({ ...base, ...style, ...cloud, subtype: 'Circle', rect: [0, 0, 0, 0] }, fit);
		case 'roundedRect':
			return boxed({ ...base, ...style, ...cloud, subtype: 'Square', rect: [0, 0, 0, 0] }, fit);
	}
}

/** What a line carries at an end, as `/LE` names it */
export const LINE_ENDINGS = { none: 'None', arrow: 'OpenArrow', closed: 'ClosedArrow', circle: 'Circle', square: 'Square', diamond: 'Diamond', bar: 'Butt' } as const;

/** An insertion mark: `/Caret` with what to insert as its contents; the appearance is the mark as shown */
function caretAnnotation(item: CaretItem, toUser: ToUser, author: string | undefined, modified: Date): NewAnnotation {
	const p = caretPoints(item);
	const user = [toUser(p[0], p[1]), toUser(p[2], p[3]), toUser(p[4], p[5])];
	const width = item.h * CARET_LINE;
	// Around the line (half its width on every side), so the mark is found again from `/Rect`
	const pad = width / 2;
	const rect = [Math.min(...user.map((u) => u[0])) - pad, Math.min(...user.map((u) => u[1])) - pad, Math.max(...user.map((u) => u[0])) + pad, Math.max(...user.map((u) => u[1])) + pad].map(
		(v) => Math.round(v * 100) / 100
	) as NewAnnotation['rect'];
	const color = rgbOf(item.color);
	const states: NonNullable<NewAnnotation['appearance']['states']> = {};
	const line = `${rgbOps(color, true)} ${num(width)} w 1 J 1 j ${user.map((u, i) => `${num(u[0])} ${num(u[1])} ${i ? 'l' : 'm'}`).join(' ')} S`;
	return {
		subtype: 'Caret',
		name: item.id,
		rect,
		color,
		author,
		modified,
		contents: item.text || undefined,
		...(item.replaces && { intent: 'Replace' }),
		appearance: { content: withAlpha(states, alphaOf(item.color), line), states }
	};
}

/** A link: `/Link` over its box, to its web address or to its page (`placeOf`: where that page is now; a page that
 * is gone leaves a link leading nowhere). It draws nothing */
function linkAnnotation(item: LinkItem, toUser: ToUser, modified: Date, placeOf?: (pageId: string) => number): NewAnnotation {
	const corners = [toUser(item.x, item.y), toUser(item.x + item.w, item.y + item.h)];
	const rect = [Math.min(corners[0][0], corners[1][0]), Math.min(corners[0][1], corners[1][1]), Math.max(corners[0][0], corners[1][0]), Math.max(corners[0][1], corners[1][1])].map(
		(v) => Math.round(v * 100) / 100
	) as NewAnnotation['rect'];
	const place = item.page !== undefined ? (placeOf?.(item.page) ?? -1) : -1;
	const uri = item.url ? safeUrl(item.url) : null;
	return { subtype: 'Link', name: item.id, rect, modified, ...(uri ? { uri } : place >= 0 ? { destPage: place } : {}), appearance: { content: '' } };
}

const MEASURE_INTENT = { distance: 'LineDimension', perimeter: 'PolyLineDimension', area: 'PolygonDimension' } as const;

/** A measured shape: its shape's annotation with the number drawn at it as shown (upright on the page as shown),
 * the number as its contents, what it measures (`/IT`) and the scale (`/Measure`), so other programs measure alike */
function measureAnnotation(item: Measured, shape: NewAnnotation, toUser: ToUser): NewAnnotation {
	const l = measureLabel(item);
	const [ox, oy] = toUser(l.x, l.y);
	const [ax, ay] = toUser(l.x + 1, l.y);
	const [bx, by] = toUser(l.x, l.y + 1);
	// Along the line: the shown x axis; up: against the shown y axis
	const matrix = [ax - ox, ay - oy, ox - bx, oy - by, ox, oy].map(num).join(' ');
	const color = rgbOf(item.color);
	const text = `BT /Helv ${num(l.size)} Tf ${matrix} Tm 1 1 1 RG 2 w 1 j 1 Tr ${winAnsi(l.text)} Tj ET\nBT /Helv ${num(l.size)} Tf ${matrix} Tm ${rgbOps(color, false)} 0 Tr ${winAnsi(l.text)} Tj ET`;
	const box = labelBox(item);
	const edges = [toUser(box.x0, box.y0), toUser(box.x1, box.y0), toUser(box.x0, box.y1), toUser(box.x1, box.y1)];
	const rect = [
		Math.min(shape.rect[0], ...edges.map((e) => e[0])),
		Math.min(shape.rect[1], ...edges.map((e) => e[1])),
		Math.max(shape.rect[2], ...edges.map((e) => e[0])),
		Math.max(shape.rect[3], ...edges.map((e) => e[1]))
	].map((v) => Math.round(v * 100) / 100) as NewAnnotation['rect'];
	const { scale, unit, kind } = item.measure;
	const factor = unitsPerPoint(scale, unit);
	return {
		...shape,
		rect,
		// The box grew: where the shape lies in it is no longer what `/RD` said
		inset: undefined,
		contents: l.text.replace('²', '2'),
		intent: MEASURE_INTENT[kind],
		measure: { ratio: `1 mm = ${num(unitsPerPoint(scale, unit) / unitsPerPoint(1, 'mm'))} ${unit}`, unit, factor },
		appearance: { ...shape.appearance, content: `${shape.appearance.content}\nq\n${text}\nQ`, fonts: { ...shape.appearance.fonts, Helv: 'Helvetica' } }
	};
}

/** Name of the strike-out that belongs to a replacement */
export const struckName = (id: string) => `${id}-struck`;

/**
 * What an item is written as besides its own annotation: the text a replacement strikes out – a `/StrikeOut` that
 * is a part of the mark (`/IRT` to `whole`, `/RT /Group`, how PDF programs write a replacement, so they
 * show the two as one). `whole`: the mark's ref in the file, else its name.
 */
export function partsOf(item: Annotatable, toUser: ToUser, author: string | undefined, modified: Date, whole: string = item.id): NewAnnotation[] {
	if (!isCaret(item) || !item.replaces?.length) return [];
	const struck: MarkupItem = { id: struckName(item.id), type: 'markup', kind: 'strikeout', color: item.color, boxes: item.replaces, dir: item.dir, text: item.marked ?? '' };
	return [{ ...markupAnnotation(struck, toUser, author, modified), intent: 'StrikeOutTextEdit', replyTo: whole, group: true }];
}

/** A stamp: `/Stamp` with what it says (`/Name`); its appearance is the framed word as shown, or its picture –
 * drawn in the stamp's own space (x right, y down from its top left corner), upright on the page as shown */
function stampAnnotation(item: StampItem, toUser: ToUser, author: string | undefined, modified: Date): NewAnnotation {
	const [ox, oy] = toUser(item.x, item.y);
	const [ax, ay] = toUser(item.x + 1, item.y);
	const [bx, by] = toUser(item.x, item.y + 1);
	const corners = [toUser(item.x, item.y), toUser(item.x + item.w, item.y), toUser(item.x, item.y + item.h), toUser(item.x + item.w, item.y + item.h)];
	const rect = [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))].map(
		(v) => Math.round(v * 100) / 100
	) as NewAnnotation['rect'];
	const ops = [`q ${[ax - ox, ay - oy, bx - ox, by - oy, ox, oy].map(num).join(' ')} cm`];
	const states: NonNullable<NewAnnotation['appearance']['states']> = {};
	const image = item.image ? stampImages.get(item.image) : undefined;
	const base = { subtype: 'Stamp' as const, name: item.id, rect, author, modified, icon: item.name };
	if (image && isForm(image)) {
		// Its vectors, scaled into the box (form space: its own size, y up)
		ops.push(`${num(item.w / image.width)} 0 0 ${num(-item.h / image.height)} 0 ${num(item.h)} cm /Fm0 Do Q`);
		return { ...base, appearance: { content: ops.join('\n'), forms: [image] } };
	}
	if (image) {
		// The picture fills the box (image space: y up)
		ops.push(`${num(item.w)} 0 0 ${num(-item.h)} 0 ${num(item.h)} cm /Im0 Do Q`);
		return { ...base, appearance: { content: ops.join('\n'), images: [image] } };
	}
	const { frame, main, sub } = stampLayout(item);
	const color = rgbOf(item.color);
	const alpha = alphaOf(item.color);
	const drawn = [
		`${rgbOps(color, true)} ${num(frame)} w 1 j ${[frame / 2, frame / 2, item.w - frame, item.h - frame].map(num).join(' ')} re S`,
		...(sub ? [main, sub] : [main]).map((line) => `BT ${rgbOps(color, false)} /Helv ${num(line.size)} Tf 1 0 0 -1 ${num(line.x)} ${num(line.y)} Tm ${winAnsi(line.text)} Tj ET`)
	];
	ops.push(withAlpha(states, alpha * STAMP_TINT, `${rgbOps(color, false)} 0 0 ${num(item.w)} ${num(item.h)} re f`), withAlpha(states, alpha, drawn.join('\n')), 'Q');
	return { ...base, color, contents: [item.text, item.sub].filter(Boolean).join('\n') || undefined, appearance: { content: ops.join('\n'), states, fonts: { Helv: 'Helvetica' } } };
}

const SUBTYPES = { highlight: 'Highlight', underline: 'Underline', strikeout: 'StrikeOut', squiggly: 'Squiggly' } as const;

/** Marked text: one quadrilateral per box (upper left, upper right, lower left, lower right in user space – text is
 * upright there), drawn as filled boxes (highlight, multiplied) or lines */
function markupAnnotation(item: MarkupItem, toUser: ToUser, author: string | undefined, modified: Date): NewAnnotation {
	const color = rgbOf(item.color);
	const alpha = item.color.length > 7 ? Math.round((parseInt(item.color.slice(7, 9), 16) / 255) * 100) / 100 : 1;
	const quads: number[] = [];
	const ops: string[] = ['q /M gs', item.kind === 'highlight' ? rgbOps(color, false) : `${rgbOps(color, true)} 0 J`];
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (const b of item.boxes) {
		const [ax, ay] = toUser(b.x0, b.y0);
		const [bx, by] = toUser(b.x1, b.y1);
		const [ux0, uy0, ux1, uy1] = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
		quads.push(ux0, uy1, ux1, uy1, ux0, uy0, ux1, uy0);
		x0 = Math.min(x0, ux0);
		y0 = Math.min(y0, uy0);
		x1 = Math.max(x1, ux1);
		y1 = Math.max(y1, uy1);
		if (item.kind === 'highlight') ops.push(`${num(ux0)} ${num(uy0)} ${num(ux1 - ux0)} ${num(uy1 - uy0)} re f`);
		else {
			// A straight line, or the zigzag of a wavy underline
			const { points, width } = item.kind === 'squiggly' ? squiggle(b, item.dir) : { points: markLine(item.kind, b, item.dir).line, width: markLine(item.kind, b, item.dir).width };
			const path: string[] = [];
			for (let i = 0; i < points.length; i += 2) {
				const [ux, uy] = toUser(points[i], points[i + 1]);
				path.push(`${num(ux)} ${num(uy)} ${i ? 'l' : 'm'}`);
				// The appearance's box holds the line (an underline lies below the text)
				x0 = Math.min(x0, ux - width);
				y0 = Math.min(y0, uy - width);
				x1 = Math.max(x1, ux + width);
				y1 = Math.max(y1, uy + width);
			}
			ops.push(`${num(width)} w 1 j ${path.join(' ')} S`);
		}
	}
	ops.push('Q');
	return {
		subtype: SUBTYPES[item.kind],
		name: item.id,
		rect: [x0, y0, x1, y1].map((v) => Math.round(v * 100) / 100) as NewAnnotation['rect'],
		color,
		author,
		modified,
		contents: item.text || undefined,
		// The opacity only in the appearance (`/CA` would apply on top of it in viewers that honor it)
		quadPoints: quads,
		appearance: { content: ops.join('\n'), states: { M: { alpha: alpha < 1 ? alpha : undefined, multiply: item.kind === 'highlight' } } }
	};
}

/** A note: `/Text` with its icon (`/Name`) and the comment; its appearance is the icon as shown (upright on the page
 * as it was shown when saved) */
function noteAnnotation(item: NoteItem, toUser: ToUser, author: string | undefined, modified: Date): NewAnnotation {
	const k = NOTE_SIZE / 20;
	const at = (x: number, y: number) => {
		const [ux, uy] = toUser(item.x + x * k, item.y + y * k);
		return `${num(ux)} ${num(uy)}`;
	};
	// Half the outline's width more on every side
	const [ax, ay] = toUser(item.x - 0.5, item.y - 0.5);
	const [bx, by] = toUser(item.x + NOTE_SIZE + 0.5, item.y + NOTE_SIZE + 0.5);
	// The icon's bodies filled in its color (see-through when it says so), then outlines, marks and lines opaque
	const states: NonNullable<NewAnnotation['appearance']['states']> = {};
	const icon = noteIconOf(item);
	const file = item.file && attachedFiles.get(item.file.key);
	const { bodies, marks, lines } = noteShape(item);
	const path = (p: number[], close: boolean) => {
		const out = [`${at(p[0], p[1])} m`];
		for (let i = 2; i < p.length; i += 2) out.push(`${at(p[i], p[i + 1])} l`);
		if (close) out.push('h');
		return out.join(' ');
	};
	const ops: string[] = [];
	if (bodies.length) ops.push(withAlpha(states, alphaOf(item.color), `${rgbOps(rgbOf(item.color), false)} ${bodies.map((b) => path(b, true)).join(' ')} f`));
	ops.push(rgbOps(rgbOf(NOTE_INK), true), rgbOps(rgbOf(NOTE_INK), false), '0.75 w 1 j 1 J');
	if (bodies.length) ops.push(`${bodies.map((b) => path(b, true)).join(' ')} S`);
	if (marks.length) ops.push(`${marks.map((b) => path(b, true)).join(' ')} f`);
	if (lines.length) ops.push(`${lines.map((l) => path(l, false)).join(' ')} S`);
	return {
		subtype: 'Text',
		name: item.id,
		rect: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)].map((v) => Math.round(v * 100) / 100) as NewAnnotation['rect'],
		color: rgbOf(item.color),
		author,
		modified,
		contents: item.text || undefined,
		// A file attachment: the standard's paper clip, with the file
		...(file ? { subtype: 'FileAttachment' as const, icon: 'Paperclip', file: { name: item.file!.name, bytes: file } } : { icon, open: false }),
		appearance: { content: ops.join('\n'), states }
	};
}

/** The standard fonts of a PDF the three families are written in – regular, bold, italic, bold italic (the fonts
 * on screen have their metrics, `@in-browser/graphics/fonts.js`) */
const STANDARD_FONTS = {
	sans: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
	serif: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
	mono: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique']
} as const;
const faceIndex = (style: Pick<FullStyle, 'bold' | 'italic'>) => (style.bold ? 1 : 0) + (style.italic ? 2 : 0);
/** The name a style's font has in an appearance's resources (`Helv` as ever for the plain sans-serif one) */
const fontName = (style: Pick<FullStyle, 'font' | 'bold' | 'italic'>) => (asDocumentFont(style.font) === 'sans' && !faceIndex(style) ? 'Helv' : `F${asDocumentFont(style.font)}${faceIndex(style)}`);

/** A text box: `/FreeText` with the text (`/Contents`), font and color (`/DA`) and no border; the appearance writes
 * the stored lines in Helvetica (characters it lacks become `?` there – `/Contents` keeps them) */
function textAnnotation(item: TextItem, toUser: ToUser, author: string | undefined, modified: Date): NewAnnotation {
	const [ox, oy] = toUser(0, 0);
	const linear = (x: number, y: number): [number, number] => {
		const [ux, uy] = toUser(x, y);
		return [ux - ox, uy - oy];
	};
	const turn = (item.rot * Math.PI) / 180;
	const along: [number, number] = [Math.round(Math.cos(turn)), Math.round(Math.sin(turn))];
	const down: [number, number] = [-along[1], along[0]];
	const { w, h } = textExtent(item);
	// The text's own top left corner on the page as shown
	const cx = item.x + item.w / 2 - (along[0] * w + down[0] * h) / 2;
	const cy = item.y + item.h / 2 - (along[1] * w + down[1] * h) / 2;
	const [a, b] = linear(along[0], along[1]);
	const [c, d] = linear(-down[0], -down[1]);
	const color = rgbOf(item.color);
	const pad = padOf(item);
	const bw = borderOf(item);
	const userBox = (x0: number, y0: number, x1: number, y1: number) => {
		const [ax, ay] = toUser(x0, y0);
		const [bx, by] = toUser(x1, y1);
		return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)].map((v) => Math.round(v * 100) / 100) as NewAnnotation['rect'];
	};
	// The box, and `/Rect` around it and the text running out of a fixed size (`/RD` says where the box is, so
	// viewers don't cut that text off)
	const [rx0, ry0, rx1, ry1] = userBox(item.x, item.y, item.x + item.w, item.y + item.h);
	const outer = itemBounds(item);
	const rect = userBox(outer.x0, outer.y0, outer.x1, outer.y1);
	const inset: NewAnnotation['inset'] = [rx0 - rect[0], rect[3] - ry1, rect[2] - rx1, ry0 - rect[1]].map((v) => Math.round(v * 100) / 100) as [number, number, number, number];
	const fill = item.fill ? rgbOf(item.fill) : undefined;
	const border = bw ? rgbOf(item.border!) : undefined;
	const ops: string[] = [];
	const states: NonNullable<NewAnnotation['appearance']['states']> = {};
	// A callout's line with its arrow, below the box
	const line = calloutLine(item);
	const user = line && Array.from({ length: line.length / 2 }, (_, i) => toUser(line[2 * i], line[2 * i + 1]));
	if (line && user) {
		const head = calloutHead(line, calloutWidth(item));
		const path = (points: [number, number][]) => points.map((p, i) => `${num(p[0])} ${num(p[1])} ${i ? 'l' : 'm'}`).join(' ');
		const drawn = `${rgbOps(rgbOf(calloutColor(item)), true)} ${num(calloutWidth(item))} w [] 0 d 0 J 0 j ${path(user)} ${path([toUser(head[0], head[1]), toUser(head[2], head[3]), toUser(head[4], head[5])])} S`;
		ops.push(withAlpha(states, alphaOf(calloutColor(item)), drawn));
	}
	// Background, then the border inside the box (the box is upright in user space: pages turn by quarter turns), then
	// the text – each with its own opacity
	if (fill) ops.push(withAlpha(states, alphaOf(item.fill!), `${rgbOps(fill, false)} ${[rx0, ry0, rx1 - rx0, ry1 - ry0].map(num).join(' ')} re f`));
	if (border)
		ops.push(withAlpha(states, alphaOf(item.border!), `${rgbOps(border, true)} ${num(bw)} w [] 0 d ${[rx0 + bw / 2, ry0 + bw / 2, rx1 - rx0 - bw, ry1 - ry0 - bw].map(num).join(' ')} re S`));
	const text: string[] = [];
	// Lines with characters beyond WinAnsi in the embedded Liberation Sans (Helvetica's metrics), the rest in Helvetica
	let unicode = false;
	const fonts: Record<string, string> = { Helv: 'Helvetica' };
	const formatted = isFormatted(item);
	if (formatted) {
		// Each run of the laid-out lines in its own font, size and color, where it is on screen; an underline as a
		// bar. Colors with an opacity are drawn in a state of their own
		const byAlpha = new Map<number, string[]>();
		const at = (start: number, off: number) => toUser(cx + along[0] * start + down[0] * off, cy + along[1] * start + down[1] * off);
		for (const line of richLines(item)) {
			for (const run of line.runs) {
				if (!run.text) continue;
				const start = pad + run.x;
				const off = pad + line.y + line.baseline;
				const [ex, ey] = at(start, off);
				const plain = [...run.text].every(inWinAnsi);
				unicode ||= !plain;
				const name = fontName(run.style);
				fonts[name] = STANDARD_FONTS[asDocumentFont(run.style.font)][faceIndex(run.style)];
				const show = plain ? `/${name} ${num(run.style.size)} Tf ${winAnsi(run.text)}` : `/Uni ${num(run.style.size)} Tf ${unicodeText(run.text)}`;
				const ink = rgbOps(rgbOf(run.style.color), false);
				const drawn = [`BT ${ink} ${[a, b, c, d, ex, ey].map(num).join(' ')} Tm ${show} Tj ET`];
				if (run.style.underline && !run.marker) {
					const top = off + run.style.size * UNDERLINE.offset;
					const corners = [at(start, top), at(start + run.width, top), at(start + run.width, top + run.style.size * UNDERLINE.width), at(start, top + run.style.size * UNDERLINE.width)];
					drawn.push(`${ink} ${corners.map((p, i) => `${num(p[0])} ${num(p[1])} ${i ? 'l' : 'm'}`).join(' ')} h f`);
				}
				const alpha = alphaOf(run.style.color);
				byAlpha.set(alpha, [...(byAlpha.get(alpha) ?? []), ...drawn]);
			}
		}
		for (const [alpha, drawn] of byAlpha) ops.push(withAlpha(states, alpha, drawn.join('\n')));
	}
	(formatted ? [] : item.lines).forEach((line, i) => {
		if (!line) return;
		const off = pad + item.size * (ASCENT + i * LINE_HEIGHT);
		const plain = [...line].every(inWinAnsi);
		unicode ||= !plain;
		// Each run where it is on screen (aligned or justified word by word – the same in every viewer)
		for (const run of lineRuns(item, i)) {
			const start = pad + run.at;
			const [ex, ey] = toUser(cx + along[0] * start + down[0] * off, cy + along[1] * start + down[1] * off);
			const show = plain ? `/Helv ${num(item.size)} Tf ${winAnsi(run.text)}` : `/Uni ${num(item.size)} Tf ${unicodeText(run.text)}`;
			text.push(`BT ${rgbOps(color, false)} ${[a, b, c, d, ex, ey].map(num).join(' ')} Tm ${show} Tj ET`);
		}
	});
	if (text.length) ops.push(withAlpha(states, alphaOf(item.color), text.join('\n')));
	return {
		subtype: 'FreeText',
		name: item.id,
		rect,
		// Text without a box is what other programs call typewriter text
		...(user ? { intent: 'FreeTextCallout', callout: user.flat().map((v) => Math.round(v * 100) / 100) } : !fill && !border && { intent: 'FreeTextTypeWriter' }),
		...(inset.some((v) => v > 0) && { inset }),
		author,
		modified,
		contents: item.text || undefined,
		// As PDF programs read it: the background is `/C`, the border's color a stroke color in `/DA`, its width `/BS`
		color: fill,
		width: bw,
		// `/Q` knows no justified text: other programs editing it see it left-aligned (the appearance stays justified)
		...((item.align === 'center' || item.align === 'right') && { quadding: item.align === 'center' ? 1 : 2 }),
		defaultAppearance: `${border ? `${rgbOps(border, true)} ` : ''}/Helv ${num(item.size)} Tf ${rgbOps(color, false)}`,
		// The formats as other programs read them when they edit the box (the appearance is what they show)
		...(formatted && { richContents: richContentsOf(richTextOf(item), baseStyle(item)), defaultStyle: defaultStyleOf(baseStyle(item), alignOf(item)) }),
		appearance: { content: ops.join('\n'), fonts: unicode ? { ...fonts, Uni: UNICODE_FONT } : fonts, states }
	};
}
