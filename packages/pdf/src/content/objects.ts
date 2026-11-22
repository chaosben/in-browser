// The objects of a page's content: pieces of text, images, vector paths and embedded forms, each with where it lies
// on the page and which operators draw it. Found by walking the operators with the graphics state (`q`/`Q`, `cm`,
// the text state). What can't be told apart safely (clipping paths, shadings) is no object and stays as it is.

import type { Matrix } from '../geometry.js';
import { isName, isString, type Op, type Value } from './tokens.js';

/** What the walk needs to know of the page's resources */
export interface ContentResources {
	/** An XObject by its name: an image, or a form with its `/BBox` and `/Matrix` */
	xobject(name: string): { kind: 'image' } | { kind: 'form'; bbox: readonly number[]; matrix: Matrix } | null;
	/** A font by its name; null: unknown (its glyphs count half an em) */
	font(name: string): ContentFont | null;
}

export interface ContentFont {
	/** Bytes per character code */
	bytes: 1 | 2;
	/** Width of a code in thousandths of the font size */
	width(code: number): number;
}

export type ContentKind = 'text' | 'image' | 'path' | 'form';

/** Operators `from`…`to` (indices, inclusive) drawing one piece of an object */
export interface ContentPart {
	from: number;
	to: number;
	/** The transformation in force there (user space) */
	ctm: Matrix;
	/** Text: the text matrix its first operator starts with */
	tm?: Matrix;
	/** A path built inside saved states that end before it is painted (`q` … points … `Q` `f`, as pdf-lib draws
	 * ellipses): the last operator that builds it; only `Q`s stand between it and the painting, and the state is
	 * the same at both. Programs differ in whether a path lies where it was built or where it is painted, so a
	 * changed one is written with both in one place. */
	built?: number;
}

export interface ContentObject {
	/** Its number in the page's content (stable while the file's content is the same) */
	id: number;
	kind: ContentKind;
	/** Its box in user space (the page's own coordinates: y up, as the file has them) */
	box: { x0: number; y0: number; x1: number; y1: number };
	parts: ContentPart[];
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `a` first, then `b` (row vectors, as PDF writes matrices) */
export function mul(a: Matrix, b: Matrix): Matrix {
	return [
		a[0] * b[0] + a[1] * b[2],
		a[0] * b[1] + a[1] * b[3],
		a[2] * b[0] + a[3] * b[2],
		a[2] * b[1] + a[3] * b[3],
		a[4] * b[0] + a[5] * b[2] + b[4],
		a[4] * b[1] + a[5] * b[3] + b[5]
	];
}

export function inverse(m: Matrix): Matrix | null {
	const det = m[0] * m[3] - m[1] * m[2];
	if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
	return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

export const apply = (m: Matrix, x: number, y: number): [number, number] => [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];

export const SHOWS = new Set(['Tj', 'TJ', "'", '"']);
const PAINTS = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);
const STROKES = new Set(['S', 's', 'B', 'B*', 'b', 'b*']);

interface State {
	ctm: Matrix;
	font: ContentFont | null;
	size: number;
	tc: number;
	tw: number;
	tz: number;
	tl: number;
	rise: number;
	lw: number;
}

const num = (v: Value | undefined) => (typeof v === 'number' ? v : 0);
const matrixOf = (a: Value[]): Matrix => [num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])];

class Box {
	x0 = Infinity;
	y0 = Infinity;
	x1 = -Infinity;
	y1 = -Infinity;
	add(x: number, y: number) {
		if (x < this.x0) this.x0 = x;
		if (x > this.x1) this.x1 = x;
		if (y < this.y0) this.y0 = y;
		if (y > this.y1) this.y1 = y;
	}
	get empty() {
		return !(this.x1 >= this.x0 && this.y1 >= this.y0);
	}
	get value() {
		return { x0: this.x0, y0: this.y0, x1: this.x1, y1: this.y1 };
	}
}

/** The objects the operators draw, in drawing order */
export function contentObjects(ops: readonly Op[], resources: ContentResources): ContentObject[] {
	const out: ContentObject[] = [];
	const stack: State[] = [];
	let g: State = { ctm: IDENTITY, font: null, size: 0, tc: 0, tw: 0, tz: 1, tl: 0, rise: 0, lw: 1 };
	let tm: Matrix = IDENTITY;
	let tlm: Matrix = IDENTITY;
	let inText = false;
	/** Counts text objects (`BT`), so pieces of different ones never join */
	let block = 0;
	/** The run of show operators being read */
	let run: { from: number; to: number; tm: Matrix; ctm: Matrix; width: number; size: number; rise: number } | null = null;
	/** The last text object's end, to join what continues its line */
	let line: { object: ContentObject; block: number; end: [number, number]; dir: [number, number]; height: number } | null = null;
	/** The path being built: `last` its last building operator, `ctm` what it is built with; `broken`: the
	 * transformation changed between its points – no object */
	let path = null as { from: number; last: number; ctm: Matrix; box: Box; clip: boolean; turned: boolean; broken: boolean } | null;

	const add = (kind: ContentKind, box: Box, part: ContentPart) => {
		if (box.empty || !inverseOk(part.ctm)) return null;
		const object: ContentObject = { id: out.length, kind, box: box.value, parts: [part] };
		out.push(object);
		return object;
	};
	const endRun = () => {
		const r = run;
		run = null;
		if (!r || !r.size) return;
		// The run's box in text space: from the baseline's start along its width, a line high
		const m = mul(r.tm, r.ctm);
		const box = new Box();
		const lo = r.rise - 0.25 * r.size;
		const hi = r.rise + 0.9 * r.size;
		for (const [x, y] of [[0, lo], [r.width, lo], [0, hi], [r.width, hi]]) box.add(...apply(m, x, y));
		const start = apply(m, 0, r.rise);
		const end = apply(m, r.width, r.rise);
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		const up = apply(m, 0, r.rise + r.size);
		const height = Math.hypot(up[0] - start[0], up[1] - start[1]);
		const dir: [number, number] = length > 1e-6 ? [(end[0] - start[0]) / length, (end[1] - start[1]) / length] : [1, 0];
		const part: ContentPart = { from: r.from, to: r.to, ctm: r.ctm, tm: r.tm };
		if (box.empty || !inverseOk(r.ctm)) return;
		// Continues the line before it (same text object, same baseline, close by): one object
		const l = line;
		if (l && l.block === block && height > 0) {
			const dx = start[0] - l.end[0];
			const dy = start[1] - l.end[1];
			const along = dx * l.dir[0] + dy * l.dir[1];
			const off = Math.abs(dx * l.dir[1] - dy * l.dir[0]);
			const same = Math.abs(dir[0] * l.dir[0] + dir[1] * l.dir[1]) > 0.999 && Math.abs(height - l.height) < 0.05 * height;
			if (same && off < 0.1 * height && along > -0.5 * height && along < 1.5 * height) {
				const b = l.object.box;
				l.object.box = { x0: Math.min(b.x0, box.x0), y0: Math.min(b.y0, box.y0), x1: Math.max(b.x1, box.x1), y1: Math.max(b.y1, box.y1) };
				l.object.parts.push(part);
				l.end = end;
				return;
			}
		}
		const object = add('text', box, part);
		line = object && { object, block, end, dir, height };
	};
	/** Width of a shown string in text space */
	const stringWidth = (s: Uint8Array) => {
		const font = g.font;
		const step = font?.bytes ?? 1;
		let w = 0;
		for (let i = 0; i + step <= s.length; i += step) {
			const code = step === 2 ? (s[i] << 8) | s[i + 1] : s[i];
			w += ((font ? font.width(code) : 500) / 1000) * g.size + g.tc + (step === 1 && code === 32 ? g.tw : 0);
		}
		return w * g.tz;
	};
	const show = (i: number, text: Value | undefined) => {
		if (!run) run = { from: i, to: i, tm, ctm: g.ctm, width: 0, size: g.size, rise: g.rise };
		run.to = i;
		if (isString(text)) run.width += stringWidth(text.s);
		else if (Array.isArray(text)) {
			for (const v of text) {
				if (isString(v)) run.width += stringWidth(v.s);
				else if (typeof v === 'number') run.width -= (v / 1000) * g.size * g.tz;
			}
		}
	};
	const moveLine = (tx: number, ty: number) => {
		endRun();
		tlm = mul([1, 0, 0, 1, tx, ty], tlm);
		tm = tlm;
	};
	const point = (x: number, y: number) => path?.box.add(...apply(g.ctm, x, y));
	/** A building operator: starts the path or goes on with it */
	const build = (i: number) => {
		if (!path) path = { from: i, last: i, ctm: g.ctm, box: new Box(), clip: false, turned: false, broken: false };
		if (path.turned) path.broken = true;
		path.last = i;
	};

	for (let i = 0; i < ops.length; i++) {
		const { op, args } = ops[i];
		switch (op) {
			case 'q':
				stack.push({ ...g });
				if (path) path.turned = true;
				break;
			case 'Q':
				g = stack.pop() ?? g;
				if (path) path.turned = true;
				break;
			case 'cm':
				g.ctm = mul(matrixOf(args), g.ctm);
				if (path) path.turned = true;
				break;
			case 'w':
				g.lw = num(args[0]);
				break;
			case 'BT':
				inText = true;
				block++;
				tm = tlm = IDENTITY;
				break;
			case 'ET':
				endRun();
				inText = false;
				break;
			case 'Tf': {
				const name = args[0];
				g.font = isName(name) ? resources.font(name.n) : null;
				g.size = num(args[1]);
				break;
			}
			case 'Tc':
				g.tc = num(args[0]);
				break;
			case 'Tw':
				g.tw = num(args[0]);
				break;
			case 'Tz':
				g.tz = num(args[0]) / 100;
				break;
			case 'TL':
				g.tl = num(args[0]);
				break;
			case 'Ts':
				g.rise = num(args[0]);
				break;
			case 'Td':
				moveLine(num(args[0]), num(args[1]));
				break;
			case 'TD':
				g.tl = -num(args[1]);
				moveLine(num(args[0]), num(args[1]));
				break;
			case 'T*':
				moveLine(0, -g.tl);
				break;
			case 'Tm':
				endRun();
				tm = tlm = matrixOf(args);
				break;
			case 'Tj':
			case 'TJ':
				if (inText) show(i, args[0]);
				break;
			case "'":
				if (!inText) break;
				moveLine(0, -g.tl);
				show(i, args[0]);
				break;
			case '"':
				if (!inText) break;
				g.tw = num(args[0]);
				g.tc = num(args[1]);
				moveLine(0, -g.tl);
				show(i, args[2]);
				break;
			case 'm':
				build(i);
				point(num(args[0]), num(args[1]));
				break;
			case 'h':
				if (path) build(i);
				break;
			case 're': {
				build(i);
				const [x, y, w, h] = [num(args[0]), num(args[1]), num(args[2]), num(args[3])];
				point(x, y);
				point(x + w, y);
				point(x, y + h);
				point(x + w, y + h);
				break;
			}
			case 'l':
				if (path) build(i);
				point(num(args[0]), num(args[1]));
				break;
			case 'c':
				if (path) build(i);
				point(num(args[0]), num(args[1]));
				point(num(args[2]), num(args[3]));
				point(num(args[4]), num(args[5]));
				break;
			case 'v':
			case 'y':
				if (path) build(i);
				point(num(args[0]), num(args[1]));
				point(num(args[2]), num(args[3]));
				break;
			case 'W':
			case 'W*':
				if (path) path.clip = true;
				break;
			case 'n':
				path = null;
				break;
			case 'Do': {
				const name = args[0];
				const found = isName(name) ? resources.xobject(name.n) : null;
				if (!found) break;
				const box = new Box();
				const m = found.kind === 'form' ? mul(found.matrix, g.ctm) : g.ctm;
				const [x0, y0, x1, y1] = found.kind === 'form' ? found.bbox : [0, 0, 1, 1];
				for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) box.add(...apply(m, x, y));
				add(found.kind, box, { from: i, to: i, ctm: g.ctm });
				break;
			}
			case 'BI': {
				const box = new Box();
				for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) box.add(...apply(g.ctm, x, y));
				add('image', box, { from: i, to: i, ctm: g.ctm });
				break;
			}
			default:
				if (PAINTS.has(op)) {
					const p = path;
					path = null;
					// A path that also clips sets the state for what follows: left alone
					if (!p || p.clip || p.broken || p.box.empty) break;
					if (STROKES.has(op)) {
						const grow = (g.lw / 2) * Math.sqrt(Math.abs(g.ctm[0] * g.ctm[3] - g.ctm[1] * g.ctm[2]));
						p.box.add(p.box.x0 - grow, p.box.y0 - grow);
						p.box.add(p.box.x1 + grow, p.box.y1 + grow);
					}
					const between = i - 1 - p.last;
					if (between > 0) {
						// Only states ending that began right before the path (nothing else set in them)
						let plain = true;
						for (let k = 1; k <= between && plain; k++) plain = ops[p.last + k].op === 'Q' && ops[p.from - k]?.op === 'q';
						if (!plain) break;
					}
					add('path', p.box, { from: p.from, to: i, ctm: p.ctm, ...(between > 0 && { built: p.last }) });
				}
		}
	}
	endRun();
	return out;
}

const inverseOk = (m: Matrix) => inverse(m) !== null;
