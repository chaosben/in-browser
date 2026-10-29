import { hasShadow, isDrawable, type Annotation, type BlurAnnotation, type DrawableAnnotation, type CalloutAnnotation, type SpotlightAnnotation, type Point, type Rect, type TextAnnotation } from '#lib/project/types.js';
import { fadeAlpha } from '#lib/timeline/ops.js';
import { parseColor } from '#lib/util/color.js';
import type { Ctx2D } from './compositor.js';
import { fontCss } from './fonts.svelte.js';
import { iconPicture, imagePicture } from './images.svelte.js';
import { arrowHead, partialStrokes, strokesOf } from './sketch.js';


const LINE_HEIGHT = 1.25;

/** Copies the already drawn image, blurred by `radius` (content pixels), into the current clip */
function blurCopy(ctx: Ctx2D, radius: number) {
	const scale = ctx.getTransform().a;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.filter = `blur(${Math.max(1, radius * scale)}px)`;
	ctx.drawImage(ctx.canvas as CanvasImageSource, 0, 0);
}

function fillArrowHead(ctx: Ctx2D, x: number, y: number, angle: number, head: number) {
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x - Math.cos(angle - 0.45) * head, y - Math.sin(angle - 0.45) * head);
	ctx.lineTo(x - Math.cos(angle + 0.45) * head, y - Math.sin(angle + 0.45) * head);
	ctx.closePath();
	ctx.fill();
}

/** Hand-drawn or partly drawn arrow, line, frame or ellipse, as one path of polylines */
function drawPen(ctx: Ctx2D, a: DrawableAnnotation, W: number, H: number, progress: number) {
	// An exact arrow draws its shaft first; its filled head appears at the end
	const exactArrow = a.kind === 'arrow' && !a.sketch;
	const strokes = partialStrokes(strokesOf(a, W, H), exactArrow ? progress / 0.85 : progress);
	const lw = a.width * H;
	if (a.shadow) shadow(ctx, H);
	ctx.strokeStyle = ctx.fillStyle = a.color;
	ctx.lineWidth = lw;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	if (a.kind === 'line' && a.dashed) ctx.setLineDash([2 * lw, 3 * lw]);
	ctx.beginPath();
	for (const stroke of strokes) {
		stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
	}
	ctx.stroke();
	if (exactArrow && progress >= 0.85) {
		const x1 = a.from.x * W;
		const y1 = a.from.y * H;
		const x2 = a.to.x * W;
		const y2 = a.to.y * H;
		const len = Math.hypot(x2 - x1, y2 - y1);
		if (len >= 1) fillArrowHead(ctx, x2, y2, Math.atan2(y2 - y1, x2 - x1), arrowHead(lw, len, H));
	}
}

/** Outline of a spotlight or blur area (adds to the current path) */
function areaPath(ctx: Ctx2D, a: SpotlightAnnotation | BlurAnnotation, x: number, y: number, w: number, h: number, H: number) {
	if (a.shape === 'ellipse') {
		ctx.moveTo(x + w, y + h / 2);
		ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
	} else ctx.roundRect(x, y, w, h, Math.min(a.radius * H, w / 2, h / 2));
}

export function overlayAlpha(a: Annotation, t: number): number {
	return fadeAlpha(t, a.start, a.end, a.fadeIn, a.fadeOut);
}

/**
 * Draws an annotation. `ctx` already has the zoom transform; coordinates are canvas pixels
 * (W × H) in content space.
 */
/** `progress`: how far a self-drawing shape is drawn (0…1, see `drawProgress`) */
export function drawOverlay(ctx: Ctx2D, a: Annotation, W: number, H: number, alpha: number, progress = 1) {
	if (alpha <= 0) return;
	if (alpha < 1 && hasShadow(a) && a.shadow) {
		// Shape and shadow fade separately, so the shadow would shine through the translucent shape:
		// draw opaque into a layer and fade that as a whole
		const layer = fadeLayer(ctx.canvas.width, ctx.canvas.height);
		if (layer) {
			layer.setTransform(1, 0, 0, 1, 0, 0);
			layer.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
			layer.setTransform(ctx.getTransform());
			layer.imageSmoothingQuality = ctx.imageSmoothingQuality;
			drawOverlay(layer, a, W, H, 1, progress);
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = alpha;
			ctx.drawImage(layer.canvas, 0, 0);
			ctx.restore();
			return;
		}
	}
	ctx.save();
	ctx.globalAlpha = alpha;
	const px = (r: Rect) => [r.x * W, r.y * H, r.w * W, r.h * H] as const;
	if (isDrawable(a) && (a.sketch || progress < 1)) {
		drawPen(ctx, a, W, H, progress);
		ctx.restore();
		return;
	}

	switch (a.kind) {
		case 'blur': {
			ctx.beginPath();
			areaPath(ctx, a, ...px(a.rect), H);
			ctx.clip();
			blurCopy(ctx, a.strength * H);
			break;
		}
		case 'spotlight': {
			ctx.beginPath();
			ctx.rect(-W, -H, 3 * W, 3 * H);
			areaPath(ctx, a, ...px(a.rect), H);
			if (a.blur > 0) {
				ctx.save();
				ctx.clip('evenodd');
				blurCopy(ctx, a.blur * H);
				ctx.restore();
			}
			ctx.fillStyle = a.color;
			ctx.fill('evenodd');
			break;
		}
		case 'highlight': {
			const [x, y, w, h] = px(a.rect);
			ctx.fillStyle = a.color;
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, 0.004 * H);
			ctx.fill();
			break;
		}
		case 'rect': {
			const [x, y, w, h] = px(a.rect);
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = a.width * H;
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, a.radius * H);
			ctx.stroke();
			break;
		}
		case 'ellipse': {
			const [x, y, w, h] = px(a.rect);
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = a.width * H;
			ctx.beginPath();
			ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
			ctx.stroke();
			break;
		}
		case 'line': {
			const lw = a.width * H;
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = a.color;
			ctx.lineWidth = lw;
			ctx.lineCap = 'round';
			// Round caps lengthen each dash by one line width
			if (a.dashed) ctx.setLineDash([2 * lw, 3 * lw]);
			ctx.beginPath();
			ctx.moveTo(a.from.x * W, a.from.y * H);
			ctx.lineTo(a.to.x * W, a.to.y * H);
			ctx.stroke();
			break;
		}
		case 'step': {
			const r = (a.size * H) / 2;
			const cx = a.x * W;
			const cy = a.y * H;
			if (a.shadow) shadow(ctx, H);
			ctx.fillStyle = a.color;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, 2 * Math.PI);
			ctx.fill();
			noShadow(ctx);
			ctx.fillStyle = contrastText(a.color);
			ctx.font = `700 ${r * 1.1}px system-ui, "Segoe UI", Roboto, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			// Optical center: digits sit slightly high with "middle"
			ctx.fillText(String(a.number), cx, cy + r * 0.05);
			break;
		}		case 'arrow': {
			const x1 = a.from.x * W;
			const y1 = a.from.y * H;
			const x2 = a.to.x * W;
			const y2 = a.to.y * H;
			const lw = a.width * H;
			const len = Math.hypot(x2 - x1, y2 - y1);
			if (len < 1) break;
			const head = arrowHead(lw, len, H);
			const angle = Math.atan2(y2 - y1, x2 - x1);
			const bx = x2 - Math.cos(angle) * head * 0.8;
			const by = y2 - Math.sin(angle) * head * 0.8;
			if (a.shadow) shadow(ctx, H);
			ctx.strokeStyle = ctx.fillStyle = a.color;
			ctx.lineWidth = lw;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(bx, by);
			ctx.stroke();
			fillArrowHead(ctx, x2, y2, angle, head);
			break;
		}
		case 'image': {
			const picture = imagePicture(a.imageId);
			if (!picture) break;
			const [x, y, w, h] = px(a.rect);
			// The shadow follows the picture's own transparency (e.g. a logo), so round corners are cut first
			const scale = ctx.getTransform().a;
			const image = a.radius > 0 ? rounded(picture, w * scale, h * scale, a.radius * H * scale) : picture;
			if (a.shadow) shadow(ctx, H);
			ctx.drawImage(image, x, y, w, h);
			break;
		}
		case 'icon': {
			const picture = iconPicture(a.icon, a.color);
			if (!picture) break;
			const [x, y, w, h] = px(a.rect);
			ctx.globalAlpha = alpha * parseColor(a.color).alpha;
			if (a.shadow) shadow(ctx, H);
			ctx.drawImage(picture, x, y, w, h);
			break;
		}
		case 'text':
		case 'callout': {
			const box = textBox(ctx, a, W, H);
			if (a.shadow) shadow(ctx, H);
			if (a.background) {
				ctx.fillStyle = a.background;
				ctx.beginPath();
				ctx.roundRect(box.x, box.y, box.w, box.h, a.radius * H);
				const tail = a.kind === 'callout' ? calloutTail(box, { x: a.tip.x * W, y: a.tip.y * H }) : null;
				if (tail) {
					// Same path and winding as the box: no darker overlap with a translucent background
					ctx.moveTo(tail[0].x, tail[0].y);
					ctx.lineTo(tail[1].x, tail[1].y);
					ctx.lineTo(tail[2].x, tail[2].y);
					ctx.closePath();
				}
				ctx.fill('nonzero');
				// The box carries the shadow, not the text on it
				noShadow(ctx);
			}
			ctx.fillStyle = a.color;
			ctx.textBaseline = 'top';
			const { pad, inner, textX } = box;
			box.lines.forEach((line, i) => {
				const y = box.y + pad + i * box.font * LINE_HEIGHT + box.font * 0.1;
				const words = line.text.split(' ');
				if (a.align === 'justify' && !line.last && words.length > 1) {
					// Canvas has no justified text: spread the remaining space over the gaps between the words
					const widths = words.map((w) => ctx.measureText(w).width);
					const gap = (inner - widths.reduce((sum, w) => sum + w, 0)) / (words.length - 1);
					let x = textX;
					words.forEach((word, j) => {
						ctx.fillText(word, x, y);
						x += widths[j] + gap;
					});
					return;
				}
				const free = inner - ctx.measureText(line.text).width;
				const offset = a.align === 'center' ? free / 2 : a.align === 'right' ? free : 0;
				ctx.fillText(line.text, textX + offset, y);
			});
			break;
		}
	}
	ctx.restore();
}

/** Picture with round corners at the size it is drawn (pixels) */
function rounded(picture: CanvasImageSource, w: number, h: number, r: number): CanvasImageSource {
	const canvas = new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
	const c = canvas.getContext('2d');
	if (!c) return picture;
	c.beginPath();
	c.roundRect(0, 0, canvas.width, canvas.height, r);
	c.clip();
	c.drawImage(picture, 0, 0, canvas.width, canvas.height);
	return canvas;
}

let layerCtx: OffscreenCanvasRenderingContext2D | null = null;

/** Reused offscreen layer in the size of the target canvas */
function fadeLayer(width: number, height: number) {
	layerCtx ??= new OffscreenCanvas(width, height).getContext('2d');
	if (!layerCtx) return null;
	const canvas = layerCtx.canvas;
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
	return layerCtx;
}

function shadow(ctx: Ctx2D, H: number) {
	ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
	ctx.shadowBlur = 0.006 * H;
	ctx.shadowOffsetY = 0.002 * H;
}

function noShadow(ctx: Ctx2D) {
	ctx.shadowColor = 'transparent';
}

/** Black or white, whichever reads better on `fill` */
function contrastText(fill: string) {
	const { hex } = parseColor(fill);
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#000000' : '#ffffff';
}

/**
 * Pointer of a speech bubble: triangle from the box center to `tip`, base across the direction to the tip.
 * Winding matches `roundRect` (positive area in canvas coordinates), so both fill as one shape.
 * `null` if the tip lies within the box.
 */
export function calloutTail(box: Rect, tip: Point): [Point, Point, Point] | null {
	if (tip.x >= box.x && tip.x <= box.x + box.w && tip.y >= box.y && tip.y <= box.y + box.h) return null;
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const len = Math.hypot(tip.x - cx, tip.y - cy);
	const half = Math.min(box.w, box.h) * 0.25;
	const nx = (-(tip.y - cy) / len) * half;
	const ny = ((tip.x - cx) / len) * half;
	const a = { x: cx + nx, y: cy + ny };
	const b = { x: cx - nx, y: cy - ny };
	const area = (a.x * tip.y - tip.x * a.y) + (tip.x * b.y - b.x * tip.y) + (b.x * a.y - a.x * b.y);
	return area > 0 ? [a, tip, b] : [b, tip, a];
}

export interface TextLine {
	text: string;
	/** Ends a paragraph (stays left-aligned in justified text) */
	last: boolean;
}

/**
 * Breaks text into lines: paragraphs at `\n`, without `maxWidth` nothing else. With it, lines wrap between
 * words; a word that is too long on its own is split between characters.
 */
export function wrapText(text: string, measure: (s: string) => number, maxWidth?: number): TextLine[] {
	const lines: TextLine[] = [];
	for (const paragraph of text.split('\n')) {
		if (maxWidth === undefined) {
			lines.push({ text: paragraph, last: true });
			continue;
		}
		let line = '';
		for (const word of paragraph.split(' ').filter(Boolean)) {
			const candidate = line ? `${line} ${word}` : word;
			if (measure(candidate) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) lines.push({ text: line, last: false });
			line = word;
			// Too long on its own: split between characters (at least one per line)
			while (measure(line) > maxWidth && line.length > 1) {
				let n = line.length - 1;
				while (n > 1 && measure(line.slice(0, n)) > maxWidth) n--;
				lines.push({ text: line.slice(0, n), last: false });
				line = line.slice(n);
			}
		}
		lines.push({ text: line, last: true });
	}
	return lines;
}

/** How far the glyphs of the lines reach past their start and advance width (left-aligned) */
function inkOverhang(ctx: Ctx2D, lines: TextLine[]) {
	let left = 0;
	let right = 0;
	for (const line of lines) {
		const metrics = ctx.measureText(line.text);
		left = Math.max(left, metrics.actualBoundingBoxLeft);
		right = Math.max(right, metrics.actualBoundingBoxRight - metrics.width);
	}
	return { left, right };
}

/** Dimensions of a text box in canvas pixels. Sets `ctx.font` along the way. */
export function textBox(ctx: Ctx2D, a: TextAnnotation | CalloutAnnotation, W: number, H: number) {
	const font = a.size * H;
	ctx.font = fontCss(a.font, font);
	ctx.textAlign = 'left';
	const pad = a.background ? a.padding * H : 0;
	const fixed = a.boxWidth === undefined ? undefined : a.boxWidth * W;
	const measure = (s: string) => ctx.measureText(s).width;
	const wrap = (ink: number) => wrapText(a.text || ' ', measure, fixed === undefined ? undefined : Math.max(fixed - 2 * pad - ink, 1));
	let lines = wrap(0);
	let ink = inkOverhang(ctx, lines);
	if (fixed !== undefined && ink.left + ink.right > 0) {
		// Glyphs reaching past their advance (e.g. swashes in Caveat) must stay inside the fixed width too
		lines = wrap(ink.left + ink.right);
		const again = inkOverhang(ctx, lines);
		ink = { left: Math.max(ink.left, again.left), right: Math.max(ink.right, again.right) };
	}
	const width = fixed ?? Math.max(...lines.map((l) => measure(l.text))) + ink.left + ink.right + 2 * pad;
	return {
		x: a.x * W,
		y: a.y * H,
		w: width,
		h: lines.length * font * LINE_HEIGHT + 2 * pad,
		font,
		pad,
		/** Start of the text and the width available to a line */
		textX: a.x * W + pad + ink.left,
		inner: Math.max(width - 2 * pad - ink.left - ink.right, 0),
		lines
	};
}

/** Change that moves an annotation by an offset in content coordinates */
export function moveAnnotation(a: Annotation, dx: number, dy: number): Partial<Annotation> {
	const by = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
	switch (a.kind) {
		case 'arrow':
		case 'line':
			return { from: by(a.from), to: by(a.to) };
		case 'text':
		case 'step':
			return { x: a.x + dx, y: a.y + dy };
		case 'callout':
			// The pointer moves along
			return { x: a.x + dx, y: a.y + dy, tip: by(a.tip) };
		default:
			return { rect: { ...a.rect, x: a.rect.x + dx, y: a.rect.y + dy } };
	}
}

/** Smallest font size when shrinking a text to fit (share of the canvas height) */
const MIN_FIT_SIZE = 0.01;

/**
 * Keeps a text box within the canvas: wider than the canvas → fixed width of the canvas (the text wraps); still
 * taller → the largest smaller font size that fits; then moved inside. `bounds` is normalized like
 * `overlayBounds`. Returns only the changed fields (the pointer of a speech bubble stays where it is).
 */
export function fitTextToCanvas<T extends TextAnnotation | CalloutAnnotation>(a: T, bounds: (a: T) => Rect): Partial<T> {
	const patch: Partial<T> = {};
	let next = a;
	const set = (fields: Partial<T>) => {
		Object.assign(patch, fields);
		next = { ...next, ...fields };
	};
	if (bounds(next).w > 1) set({ boxWidth: 1 } as Partial<T>);
	if (bounds(next).h > 1) {
		let lo = Math.min(MIN_FIT_SIZE, next.size);
		let hi = next.size;
		// Corners and padding shrink along, so the box keeps its shape
		const scaled = (size: number) => ({ size, radius: next.radius * (size / next.size), padding: next.padding * (size / next.size) });
		for (let i = 0; i < 14; i++) {
			const mid = (lo + hi) / 2;
			if (bounds({ ...next, ...scaled(mid) }).h <= 1) lo = mid;
			else hi = mid;
		}
		set(scaled(lo) as Partial<T>);
	}
	const b = bounds(next);
	const x = Math.min(Math.max(next.x, 0), Math.max(1 - b.w, 0));
	const y = Math.min(Math.max(next.y, 0), Math.max(1 - b.h, 0));
	if (x !== next.x) set({ x } as Partial<T>);
	if (y !== next.y) set({ y } as Partial<T>);
	return patch;
}

let measureCtx: OffscreenCanvasRenderingContext2D | null = null;

/** Bounding box of an annotation, normalized (for selection and handles in the editor). */
export function overlayBounds(a: Annotation, W: number, H: number): Rect {
	switch (a.kind) {
		case 'arrow':
		case 'line':
			return {
				x: Math.min(a.from.x, a.to.x),
				y: Math.min(a.from.y, a.to.y),
				w: Math.abs(a.to.x - a.from.x),
				h: Math.abs(a.to.y - a.from.y)
			};
		case 'step':
			return { x: a.x - (a.size * H) / W / 2, y: a.y - a.size / 2, w: (a.size * H) / W, h: a.size };
		case 'text':
		case 'callout': {
			measureCtx ??= new OffscreenCanvas(1, 1).getContext('2d');
			const box = textBox(measureCtx!, a, W, H);
			return { x: a.x, y: a.y, w: box.w / W, h: box.h / H };
		}
		default:
			return a.rect;
	}
}
