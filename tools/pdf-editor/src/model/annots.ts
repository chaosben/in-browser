// Ink drawn on a page (strokes and shapes of the ink core) as real PDF annotations: pen and highlighter strokes are
// `/Ink`, lines and arrows `/Line`, boxes `/Square` and `/Circle`, other shapes `/Polygon`. The appearance is the
// same vector paint as on screen (`paintOf`), so every viewer shows exactly what was drawn; the other entries carry
// the meaning for viewers that edit annotations. Items live in page points as shown (y down, the page's rotation
// applied); annotations in the PDF's user space – `toUser` turns one into the other.

import { isShape, type Ink } from '@in-browser/ink/items.js';
import { inkAlpha } from '@in-browser/ink/outline.js';
import { paintOf } from '@in-browser/ink/paint.js';
import { inWinAnsi, num, winAnsi, type NewAnnotation, type Rgb } from '@in-browser/pdf/write/annotations.js';
import { UNICODE_FONT, unicodeText } from '@in-browser/pdf/write/unicode.js';
import { isMarkup, markLine, type Annotatable, type MarkupItem } from '#lib/render/markup.js';
import { ASCENT, borderOf, isText, LINE_HEIGHT, padOf, textBounds, textExtent, type TextItem } from '#lib/render/textbox.js';
import { isNote, NOTE_INK, NOTE_SHAPES, NOTE_SIZE, noteIconOf, type NoteItem } from '#lib/render/note.js';

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

/** The annotation of a stroke, shape, marked text or note */
export function annotationOf(item: Annotatable, toUser: ToUser, author: string | undefined, modified: Date): NewAnnotation {
	if (isMarkup(item)) return markupAnnotation(item, toUser, author, modified);
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
	switch (fit.kind) {
		case 'line':
			return finish({
				...base,
				...style,
				subtype: 'Line',
				rect: [0, 0, 0, 0],
				line: [...toUser(fit.x0, fit.y0), ...toUser(fit.x1, fit.y1)],
				lineEndings: [fit.start ? 'OpenArrow' : 'None', fit.end ? 'OpenArrow' : 'None']
			});
		case 'polygon':
			return finish({ ...base, ...style, subtype: 'Polygon', rect: [0, 0, 0, 0], vertices: flat(fit.points, 2) });
		case 'ellipse':
			return boxed({ ...base, ...style, subtype: 'Circle', rect: [0, 0, 0, 0] }, fit);
		case 'roundedRect':
			return boxed({ ...base, ...style, subtype: 'Square', rect: [0, 0, 0, 0] }, fit);
	}
}

const SUBTYPES = { highlight: 'Highlight', underline: 'Underline', strikeout: 'StrikeOut' } as const;

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
			const { line, width } = markLine(item.kind, b, item.dir);
			const [p, q] = [toUser(line[0], line[1]), toUser(line[2], line[3])];
			ops.push(`${num(width)} w ${num(p[0])} ${num(p[1])} m ${num(q[0])} ${num(q[1])} l S`);
			// The appearance's box holds the line (an underline lies below the text)
			x0 = Math.min(x0, p[0] - width, q[0] - width);
			y0 = Math.min(y0, p[1] - width, q[1] - width);
			x1 = Math.max(x1, p[0] + width, q[0] + width);
			y1 = Math.max(y1, p[1] + width, q[1] + width);
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
	const { bodies, marks, lines } = NOTE_SHAPES[icon];
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
		icon,
		open: false,
		appearance: { content: ops.join('\n'), states }
	};
}

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
	const outer = textBounds(item);
	const rect = userBox(outer.x0, outer.y0, outer.x1, outer.y1);
	const inset: NewAnnotation['inset'] = [rx0 - rect[0], rect[3] - ry1, rect[2] - rx1, ry0 - rect[1]].map((v) => Math.round(v * 100) / 100) as [number, number, number, number];
	const fill = item.fill ? rgbOf(item.fill) : undefined;
	const border = bw ? rgbOf(item.border!) : undefined;
	const ops: string[] = [];
	const states: NonNullable<NewAnnotation['appearance']['states']> = {};
	// Background, then the border inside the box (the box is upright in user space: pages turn by quarter turns), then
	// the text – each with its own opacity
	if (fill) ops.push(withAlpha(states, alphaOf(item.fill!), `${rgbOps(fill, false)} ${[rx0, ry0, rx1 - rx0, ry1 - ry0].map(num).join(' ')} re f`));
	if (border)
		ops.push(withAlpha(states, alphaOf(item.border!), `${rgbOps(border, true)} ${num(bw)} w [] 0 d ${[rx0 + bw / 2, ry0 + bw / 2, rx1 - rx0 - bw, ry1 - ry0 - bw].map(num).join(' ')} re S`));
	const text: string[] = [];
	// Lines with characters beyond WinAnsi in the embedded Liberation Sans (Helvetica's metrics), the rest in Helvetica
	let unicode = false;
	item.lines.forEach((line, i) => {
		if (!line) return;
		const off = pad + item.size * (ASCENT + i * LINE_HEIGHT);
		const [ex, ey] = toUser(cx + along[0] * pad + down[0] * off, cy + along[1] * pad + down[1] * off);
		const plain = [...line].every(inWinAnsi);
		unicode ||= !plain;
		const show = plain ? `/Helv ${num(item.size)} Tf ${winAnsi(line)}` : `/Uni ${num(item.size)} Tf ${unicodeText(line)}`;
		text.push(`BT ${rgbOps(color, false)} ${[a, b, c, d, ex, ey].map(num).join(' ')} Tm ${show} Tj ET`);
	});
	if (text.length) ops.push(withAlpha(states, alphaOf(item.color), text.join('\n')));
	return {
		subtype: 'FreeText',
		name: item.id,
		rect,
		...(inset.some((v) => v > 0) && { inset }),
		author,
		modified,
		contents: item.text || undefined,
		// Like Acrobat: the background is `/C`, the border's color a stroke color in `/DA`, its width `/BS`
		color: fill,
		width: bw,
		defaultAppearance: `${border ? `${rgbOps(border, true)} ` : ''}/Helv ${num(item.size)} Tf ${rgbOps(color, false)}`,
		appearance: { content: ops.join('\n'), fonts: unicode ? { Helv: 'Helvetica', Uni: UNICODE_FONT } : { Helv: 'Helvetica' }, states }
	};
}
