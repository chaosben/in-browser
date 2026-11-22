// An SVG as vectors in a PDF (`PdfForm`): paths and basic shapes with fills, strokes, opacities and transforms –
// what icons and most logos are made of. Anything it can't draw exactly (text, gradients, patterns, clipping, masks,
// filters, style sheets, embedded pictures, `use`) makes it give up, and the caller draws the SVG as pixels instead.

import { pdfLib } from '../pdf-lib.js';
import type { PdfForm } from './form.js';

class Unsupported extends Error {}

type Matrix = [number, number, number, number, number, number];

const num = (n: number) => (Math.round(n * 10000) / 10000).toString();

/** CSS pixels per unit */
const UNITS: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

function length(value: string | null | undefined, fallback?: number): number {
	if (value == null || value.trim() === '') {
		if (fallback === undefined) throw new Unsupported('length');
		return fallback;
	}
	const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value);
	const unit = m ? UNITS[m[2].toLowerCase()] : undefined;
	if (!m || unit === undefined) throw new Unsupported(`length ${value}`);
	return Number(m[1]) * unit;
}

// --- Path data ---

/** Path data as PDF path operators (absolute lines and cubic curves) */
export function pathOps(d: string): string {
	const out: string[] = [];
	let i = 0;
	const skip = () => {
		while (i < d.length && /[\s,]/.test(d[i])) i++;
	};
	const number = (): number => {
		skip();
		const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(d.slice(i, i + 40));
		if (!m) throw new Unsupported('path');
		i += m[0].length;
		return Number(m[0]);
	};
	const flag = (): number => {
		skip();
		const c = d[i++];
		if (c !== '0' && c !== '1') throw new Unsupported('path');
		return Number(c);
	};
	const more = () => {
		skip();
		return i < d.length && /[\d.+-]/.test(d[i]);
	};
	let [x, y, sx, sy] = [0, 0, 0, 0];
	// The last control point, for smooth curves
	let [cx, cy, last] = [0, 0, ''];
	const curve = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => out.push(`${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(ex)} ${num(ey)} c`);
	let command = '';
	for (skip(); i < d.length; skip()) {
		if (/[a-z]/i.test(d[i])) command = d[i++];
		else if (!command || !more()) throw new Unsupported('path');
		const rel = command === command.toLowerCase();
		const [ox, oy] = rel ? [x, y] : [0, 0];
		const c = command.toUpperCase();
		switch (c) {
			case 'M':
				[x, y] = [ox + number(), oy + number()];
				[sx, sy] = [x, y];
				out.push(`${num(x)} ${num(y)} m`);
				// Further pairs are lines
				command = rel ? 'l' : 'L';
				break;
			case 'L':
				[x, y] = [ox + number(), oy + number()];
				out.push(`${num(x)} ${num(y)} l`);
				break;
			case 'H':
				x = ox + number();
				out.push(`${num(x)} ${num(y)} l`);
				break;
			case 'V':
				y = oy + number();
				out.push(`${num(x)} ${num(y)} l`);
				break;
			case 'C':
			case 'S': {
				const smooth = last === 'C' || last === 'S';
				const [x1, y1] = c === 'C' ? [ox + number(), oy + number()] : smooth ? [2 * x - cx, 2 * y - cy] : [x, y];
				[cx, cy] = [ox + number(), oy + number()];
				const [ex, ey] = [ox + number(), oy + number()];
				curve(x1, y1, cx, cy, ex, ey);
				[x, y] = [ex, ey];
				break;
			}
			case 'Q':
			case 'T': {
				const smooth = last === 'Q' || last === 'T';
				[cx, cy] = c === 'Q' ? [ox + number(), oy + number()] : smooth ? [2 * x - cx, 2 * y - cy] : [x, y];
				const [ex, ey] = [ox + number(), oy + number()];
				curve(x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), ex + (2 / 3) * (cx - ex), ey + (2 / 3) * (cy - ey), ex, ey);
				[x, y] = [ex, ey];
				break;
			}
			case 'A': {
				const [rx, ry, turn, large, sweep] = [number(), number(), number(), flag(), flag()];
				const [ex, ey] = [ox + number(), oy + number()];
				for (const [x1, y1, x2, y2, px, py] of arc(x, y, rx, ry, turn, large, sweep, ex, ey)) curve(x1, y1, x2, y2, px, py);
				if (!(rx && ry)) out.push(`${num(ex)} ${num(ey)} l`);
				[x, y] = [ex, ey];
				break;
			}
			case 'Z':
				out.push('h');
				[x, y] = [sx, sy];
				break;
			default:
				throw new Unsupported('path');
		}
		last = c;
	}
	return out.join(' ');
}

/** An elliptical arc as cubic curves (SVG's endpoint form; none for a radius of zero or no way to go) */
function arc(x0: number, y0: number, rx: number, ry: number, turn: number, large: number, sweep: number, x: number, y: number): number[][] {
	rx = Math.abs(rx);
	ry = Math.abs(ry);
	if (!rx || !ry || (x0 === x && y0 === y)) return [];
	const phi = (turn * Math.PI) / 180;
	const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
	const [dx, dy] = [(x0 - x) / 2, (y0 - y) / 2];
	const [x1, y1] = [cos * dx + sin * dy, -sin * dx + cos * dy];
	const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
	if (lambda > 1) {
		rx *= Math.sqrt(lambda);
		ry *= Math.sqrt(lambda);
	}
	const sign = large === sweep ? -1 : 1;
	const k = sign * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
	const [cx1, cy1] = [(k * rx * y1) / ry, (-k * ry * x1) / rx];
	const [cx, cy] = [cos * cx1 - sin * cy1 + (x0 + x) / 2, sin * cx1 + cos * cy1 + (y0 + y) / 2];
	const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
	const start = angle((x1 - cx1) / rx, (y1 - cy1) / ry);
	let delta = angle((-x1 - cx1) / rx, (-y1 - cy1) / ry) - start;
	if (sweep && delta < 0) delta += 2 * Math.PI;
	if (!sweep && delta > 0) delta -= 2 * Math.PI;
	const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
	const step = delta / pieces;
	const t = (4 / 3) * Math.tan(step / 4);
	const point = (a: number, da: number): [number, number] => {
		// A point of the ellipse, moved by `da` times its tangent
		const [px, py] = [rx * (Math.cos(a) - da * Math.sin(a)), ry * (Math.sin(a) + da * Math.cos(a))];
		return [cos * px - sin * py + cx, sin * px + cos * py + cy];
	};
	const curves: number[][] = [];
	for (let n = 0; n < pieces; n++) {
		const [a, b] = [start + n * step, start + (n + 1) * step];
		curves.push([...point(a, t), ...point(b, -t), ...point(b, 0)]);
	}
	return curves;
}

// --- Elements ---

function transformOf(value: string | null): Matrix[] {
	if (!value?.trim()) return [];
	const out: Matrix[] = [];
	const pattern = /\s*,?\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gy;
	let end = 0;
	for (let m = pattern.exec(value); m; m = pattern.exec(value)) {
		end = pattern.lastIndex;
		const v = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
		if (v.some((n) => !Number.isFinite(n))) throw new Unsupported('transform');
		const rad = (deg: number) => (deg * Math.PI) / 180;
		if (m[1] === 'matrix' && v.length === 6) out.push(v as Matrix);
		else if (m[1] === 'translate' && v.length >= 1) out.push([1, 0, 0, 1, v[0], v[1] ?? 0]);
		else if (m[1] === 'scale' && v.length >= 1) out.push([v[0], 0, 0, v[1] ?? v[0], 0, 0]);
		else if (m[1] === 'rotate' && (v.length === 1 || v.length === 3)) {
			const [c, s] = [Math.cos(rad(v[0])), Math.sin(rad(v[0]))];
			if (v.length === 3) out.push([1, 0, 0, 1, v[1], v[2]]);
			out.push([c, s, -s, c, 0, 0]);
			if (v.length === 3) out.push([1, 0, 0, 1, -v[1], -v[2]]);
		} else if (m[1] === 'skewX' && v.length === 1) out.push([1, 0, Math.tan(rad(v[0])), 1, 0, 0]);
		else if (m[1] === 'skewY' && v.length === 1) out.push([1, Math.tan(rad(v[0])), 0, 1, 0, 0]);
		else throw new Unsupported('transform');
	}
	if (value.slice(end).trim()) throw new Unsupported('transform');
	return out;
}

/** What an element inherits */
interface Style {
	fill: string;
	stroke: string;
	color: string;
	opacity: number;
	'fill-opacity': string;
	'stroke-opacity': string;
	'fill-rule': string;
	'stroke-width': string;
	'stroke-linecap': string;
	'stroke-linejoin': string;
	'stroke-miterlimit': string;
	'stroke-dasharray': string;
	'stroke-dashoffset': string;
}
const INHERITED = ['fill', 'stroke', 'color', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset'] as const;
const INITIAL: Style = {
	fill: 'black',
	stroke: 'none',
	color: 'black',
	opacity: 1,
	'fill-opacity': '1',
	'stroke-opacity': '1',
	'fill-rule': 'nonzero',
	'stroke-width': '1',
	'stroke-linecap': 'butt',
	'stroke-linejoin': 'miter',
	'stroke-miterlimit': '4',
	'stroke-dasharray': 'none',
	'stroke-dashoffset': '0'
};
/** What it can't draw, when set to anything but its initial value */
const REFUSED = { 'clip-path': 'none', mask: 'none', filter: 'none', 'mix-blend-mode': 'normal', 'paint-order': 'normal', 'vector-effect': 'none', 'stroke-dashoffset': '0' };
const SKIPPED = new Set(['title', 'desc', 'metadata', 'defs']);

/** A property of an element: its `style` before its attribute */
const prop = (el: Element, name: string): string | null => (el as SVGElement).style?.getPropertyValue(name).trim() || el.getAttribute(name)?.trim() || null;

class Writer {
	readonly ops: string[] = [];
	readonly states = new Map<string, string>();
	private readonly ctx = document.createElement('canvas').getContext('2d')!;

	/** `r g b` (0…1) and the color's own opacity; null for none */
	private color(value: string, current: string): { rgb: string; alpha: number } | null {
		const v = value.trim();
		if (v === 'none' || v === 'transparent') return null;
		if (/^currentcolor$/i.test(v)) return this.color(current, 'black');
		if (/^(url|var|context-)/i.test(v)) throw new Unsupported(`paint ${v}`);
		// The browser reads the color; an unknown one leaves the marker
		this.ctx.fillStyle = '#010203';
		this.ctx.fillStyle = v;
		const read = this.ctx.fillStyle;
		if (read === '#010203' && v.toLowerCase() !== '#010203') throw new Unsupported(`color ${v}`);
		const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(read);
		if (hex) return { rgb: hex.slice(1).map((h) => num(parseInt(h, 16) / 255)).join(' '), alpha: 1 };
		const rgba = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(read);
		if (!rgba) throw new Unsupported(`color ${v}`);
		return { rgb: [rgba[1], rgba[2], rgba[3]].map((c) => num(Number(c) / 255)).join(' '), alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
	}

	private state(fill: number, stroke: number): string {
		const key = `${num(fill)} ${num(stroke)}`;
		let name = this.states.get(key);
		if (!name) this.states.set(key, (name = `G${this.states.size}`));
		return name;
	}

	element(el: Element, inherited: Style) {
		const tag = el.localName;
		if (SKIPPED.has(tag)) return;
		if (prop(el, 'display') === 'none' || /^(hidden|collapse)$/.test(prop(el, 'visibility') ?? '')) return;
		for (const [name, initial] of Object.entries(REFUSED)) {
			const value = prop(el, name);
			if (value && value !== initial && value !== `${initial}px`) throw new Unsupported(name);
		}
		const style = { ...inherited };
		for (const name of INHERITED) {
			const value = prop(el, name);
			if (value && value !== 'inherit') style[name] = value;
		}
		const opacity = prop(el, 'opacity');
		if (opacity) style.opacity *= Math.min(1, Math.max(0, opacity.endsWith('%') ? Number(opacity.slice(0, -1)) / 100 : Number(opacity)));
		if (!Number.isFinite(style.opacity)) throw new Unsupported('opacity');
		const matrices = transformOf(el.getAttribute('transform'));
		const open = () => this.ops.push('q', ...matrices.map((m) => `${m.map(num).join(' ')} cm`));

		if (tag === 'g' || tag === 'svg' || tag === 'a') {
			// A nested drawing would need its own frame
			if (tag === 'svg' && el.parentElement) throw new Unsupported('nested svg');
			open();
			for (const child of el.children) this.element(child, style);
			this.ops.push('Q');
			return;
		}
		const n = (name: string, fallback = 0) => length(el.getAttribute(name), fallback);
		let d: string;
		let closed = true;
		switch (tag) {
			case 'path':
				d = el.getAttribute('d') ?? '';
				break;
			case 'rect': {
				const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
				if (!(w > 0 && h > 0)) return;
				const [ax, ay] = [el.getAttribute('rx'), el.getAttribute('ry')];
				const rx = Math.min(w / 2, length(ax ?? ay, 0));
				const ry = Math.min(h / 2, length(ay ?? ax, 0));
				d = rx && ry
					? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
					: `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
				break;
			}
			case 'circle':
			case 'ellipse': {
				const [cx, cy] = [n('cx'), n('cy')];
				const [rx, ry] = tag === 'circle' ? [n('r'), n('r')] : [n('rx'), n('ry')];
				if (!(rx > 0 && ry > 0)) return;
				d = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
				break;
			}
			case 'line':
				d = `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
				closed = false;
				break;
			case 'polyline':
			case 'polygon': {
				const points = (el.getAttribute('points') ?? '').trim();
				if (!points) return;
				d = `M${points}${tag === 'polygon' ? 'Z' : ''}`;
				break;
			}
			default:
				throw new Unsupported(tag);
		}
		const path = pathOps(d);
		if (!path) return;
		const fill = closed || tag !== 'line' ? this.color(style.fill, style.color) : null;
		const width = length(style['stroke-width']);
		const stroke = width > 0 ? this.color(style.stroke, style.color) : null;
		if (!fill && !stroke) return;
		const alpha = (own: string, color: { alpha: number } | null) => (color ? style.opacity * color.alpha * Math.min(1, Math.max(0, own.endsWith('%') ? Number(own.slice(0, -1)) / 100 : Number(own))) : 1);
		const [fa, sa] = [alpha(style['fill-opacity'], fill), alpha(style['stroke-opacity'], stroke)];
		if (!Number.isFinite(fa) || !Number.isFinite(sa)) throw new Unsupported('opacity');
		open();
		if (fa < 1 || sa < 1) this.ops.push(`/${this.state(fa, sa)} gs`);
		if (fill) this.ops.push(`${fill.rgb} rg`);
		if (stroke) {
			const cap = { butt: 0, round: 1, square: 2 }[style['stroke-linecap']];
			const join = { miter: 0, round: 1, bevel: 2 }[style['stroke-linejoin']];
			if (cap === undefined || join === undefined) throw new Unsupported('stroke');
			this.ops.push(`${stroke.rgb} RG ${num(width)} w ${cap} J ${join} j ${num(Math.max(1, Number(style['stroke-miterlimit']) || 4))} M`);
			if (style['stroke-dasharray'] !== 'none') {
				const dashes = style['stroke-dasharray'].split(/[\s,]+/).filter(Boolean).map((v) => length(v));
				if (dashes.some((v) => v < 0)) throw new Unsupported('dash');
				if (dashes.some((v) => v > 0)) this.ops.push(`[${(dashes.length % 2 ? [...dashes, ...dashes] : dashes).map(num).join(' ')}] 0 d`);
			}
		}
		const even = style['fill-rule'] === 'evenodd';
		this.ops.push(path, fill && stroke ? (even ? 'B*' : 'B') : fill ? (even ? 'f*' : 'f') : 'S', 'Q');
	}
}

/** The SVG as vectors, 1 CSS pixel = 0.75 points; null when it holds something this can't draw (or isn't an SVG) */
export async function svgForm(svg: string): Promise<PdfForm | null> {
	try {
		const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
		if (root.localName !== 'svg' || root.querySelector('parsererror, style, script')) return null;
		const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
		if (viewBox && (viewBox.length !== 4 || viewBox.some((v) => !Number.isFinite(v)) || !(viewBox[2] > 0 && viewBox[3] > 0))) return null;
		const size = (name: 'width' | 'height', own: number | undefined) => {
			const value = root.getAttribute(name);
			return value && !value.trim().endsWith('%') ? length(value) : own;
		};
		const width = size('width', viewBox?.[2]);
		const height = size('height', viewBox?.[3]);
		if (!width || !height || !(width > 0 && height > 0)) return null;
		const [vx, vy, vw, vh] = viewBox ?? [0, 0, width, height];
		// The view box fitted into the size: stretched only when asked for, else centered ("meet")
		const fit = root.getAttribute('preserveAspectRatio')?.trim() ?? '';
		let [sx, sy] = [width / vw, height / vh];
		if (fit !== 'none') {
			if (fit && !/^xMidYMid(\s+meet)?$/.test(fit)) return null;
			sx = sy = Math.min(sx, sy);
		}
		const [tx, ty] = [(width - vw * sx) / 2 - vx * sx, (height - vh * sy) / 2 - vy * sy];
		const k = 0.75;
		const writer = new Writer();
		// Points with y up; clipped to the picture's frame
		writer.ops.push(`0 0 ${num(width * k)} ${num(height * k)} re W n`, `${num(k * sx)} 0 0 ${num(-k * sy)} ${num(k * tx)} ${num(k * (height - ty))} cm`);
		writer.element(root, INITIAL);
		const { PDFDocument, PDFName } = await pdfLib();
		const doc = await PDFDocument.create();
		const page = doc.addPage([width * k, height * k]);
		const states = Object.fromEntries([...writer.states].map(([key, name]) => [name, { Type: 'ExtGState', ca: Number(key.split(' ')[0]), CA: Number(key.split(' ')[1]) }]));
		page.node.set(PDFName.of('Resources'), doc.context.obj({ ExtGState: states }));
		page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(writer.ops.join('\n'))));
		return { width: width * k, height: height * k, pdf: await doc.save() };
	} catch (e) {
		if (e instanceof Unsupported) return null;
		throw e;
	}
}
