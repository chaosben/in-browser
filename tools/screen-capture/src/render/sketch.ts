// Strokes of arrows, lines, frames and ellipses as polylines (canvas pixels): exact or hand-drawn, and cut to a
// part of their length so a shape can draw itself. Hand-drawn shapes get their irregularity from the element's
// id, so preview and export look the same and the shape does not change while it is moved or resized.
import type { DrawableAnnotation, Point } from '#lib/project/types.js';

export type Stroke = Point[];

/** Arrowhead size for a line width and shaft length (pixels) */
export function arrowHead(lineWidth: number, length: number, H: number): number {
	return Math.min(Math.max(lineWidth * 3.5, 0.02 * H), length * 0.6);
}

/** Pseudo-random numbers in [0, 1), always the same sequence for the same text */
export function seeded(text: string): () => number {
	let h = 1779033703 ^ text.length;
	for (let i = 0; i < text.length; i++) {
		h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return () => {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	};
}

/** Quadratic curve from `a` to `b`, its middle pushed sideways by `bow` (fraction of the length) */
function bowed(a: Point, b: Point, bow: number, steps = 16): Stroke {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	// Control point: middle, moved along the normal (twice the bow, since the curve reaches half of it)
	const cx = (a.x + b.x) / 2 - dy * bow * 2;
	const cy = (a.y + b.y) / 2 + dx * bow * 2;
	const points: Stroke = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const u = 1 - t;
		points.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y });
	}
	return points;
}

function ellipseStroke(cx: number, cy: number, rx: number, ry: number, from: number, turns: number, radius = (_: number) => 1) {
	const steps = Math.ceil(96 * turns);
	const points: Stroke = [];
	for (let i = 0; i <= steps; i++) {
		const angle = from + (i / steps) * turns * 2 * Math.PI;
		const k = radius(angle);
		points.push({ x: cx + Math.cos(angle) * rx * k, y: cy + Math.sin(angle) * ry * k });
	}
	return points;
}

/** Rounded rectangle, clockwise from the top left (after the corner), closed */
function roundRectStroke(x: number, y: number, w: number, h: number, r: number): Stroke {
	const corners = [
		[x + w - r, y + r, -Math.PI / 2],
		[x + w - r, y + h - r, 0],
		[x + r, y + h - r, Math.PI / 2],
		[x + r, y + r, Math.PI]
	] as const;
	const points: Stroke = [];
	for (const [cx, cy, start] of corners) {
		for (let i = 0; i <= 8; i++) {
			const angle = start + (i / 8) * (Math.PI / 2);
			points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
		}
	}
	points.push(points[0]);
	return points;
}

/** The shape's strokes in drawing order; for an exact arrow only the shaft (its filled head is drawn separately) */
export function strokesOf(a: DrawableAnnotation, W: number, H: number): Stroke[] {
	const random = seeded(a.id);
	const between = (lo: number, hi: number) => lo + random() * (hi - lo);
	switch (a.kind) {
		case 'line':
		case 'arrow': {
			const from = { x: a.from.x * W, y: a.from.y * H };
			const to = { x: a.to.x * W, y: a.to.y * H };
			const length = Math.hypot(to.x - from.x, to.y - from.y);
			if (a.kind === 'line') return [a.sketch ? bowed(from, to, between(-0.03, 0.03)) : [from, to]];
			const head = arrowHead(a.width * H, length, H);
			const angle = Math.atan2(to.y - from.y, to.x - from.x);
			if (!a.sketch) {
				const end = { x: to.x - Math.cos(angle) * head * 0.8, y: to.y - Math.sin(angle) * head * 0.8 };
				return [[from, end]];
			}
			// Pen: shaft to the tip, then the head as one open stroke from wing to wing
			const wing = (side: number) => {
				const spread = 0.5 + between(-0.08, 0.08);
				const size = head * between(0.85, 1.1);
				return { x: to.x - Math.cos(angle + side * spread) * size, y: to.y - Math.sin(angle + side * spread) * size };
			};
			return [bowed(from, to, between(-0.04, 0.04)), [wing(-1), to, wing(1)]];
		}
		case 'rect': {
			const x = a.rect.x * W;
			const y = a.rect.y * H;
			const w = a.rect.w * W;
			const h = a.rect.h * H;
			if (!a.sketch) return [roundRectStroke(x, y, w, h, Math.min(a.radius * H, w / 2, h / 2))];
			// Four strokes, each reaching a little over the corners
			const corners = [
				{ x, y },
				{ x: x + w, y },
				{ x: x + w, y: y + h },
				{ x, y: y + h }
			];
			const jitter = Math.min(w, h) * 0.02;
			return corners.map((a, i) => {
				const b = corners[(i + 1) % 4];
				const length = Math.hypot(b.x - a.x, b.y - a.y);
				const ux = (b.x - a.x) / length;
				const uy = (b.y - a.y) / length;
				const over = length * between(0.02, 0.06);
				const start = { x: a.x - ux * over * 0.5 + between(-jitter, jitter), y: a.y - uy * over * 0.5 + between(-jitter, jitter) };
				const end = { x: b.x + ux * over + between(-jitter, jitter), y: b.y + uy * over + between(-jitter, jitter) };
				return bowed(start, end, between(-0.015, 0.015));
			});
		}
		case 'ellipse': {
			const rx = (a.rect.w * W) / 2;
			const ry = (a.rect.h * H) / 2;
			const cx = a.rect.x * W + rx;
			const cy = a.rect.y * H + ry;
			if (!a.sketch) return [ellipseStroke(cx, cy, rx, ry, -Math.PI / 2, 1)];
			// Like circling with a pen: starts top left, a bit more than one turn, slightly wobbly and drifting
			// outwards, so the end overshoots next to the start
			const from = -Math.PI * between(0.6, 0.85);
			const turns = between(1.08, 1.16);
			const wobble = between(0.02, 0.04);
			const phase = between(0, 2 * Math.PI);
			const drift = between(0.04, 0.08);
			return [
				ellipseStroke(cx, cy, rx, ry, from, turns, (angle) => {
					const p = (angle - from) / (2 * Math.PI * turns);
					return 1 - drift / 2 + drift * p + wobble * Math.sin(2 * angle + phase);
				})
			];
		}
	}
}

const length = (stroke: Stroke) =>
	stroke.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - stroke[i - 1].x, p.y - stroke[i - 1].y) : 0), 0);

/** The strokes up to `progress` (0…1) of their total length, in order */
export function partialStrokes(strokes: readonly Stroke[], progress: number): Stroke[] {
	if (progress >= 1) return [...strokes];
	let left = Math.max(0, progress) * strokes.reduce((sum, s) => sum + length(s), 0);
	const result: Stroke[] = [];
	for (const stroke of strokes) {
		if (left <= 0) break;
		const part: Stroke = [stroke[0]];
		for (let i = 1; i < stroke.length && left > 0; i++) {
			const a = stroke[i - 1];
			const b = stroke[i];
			const d = Math.hypot(b.x - a.x, b.y - a.y);
			if (d <= left) {
				part.push(b);
				left -= d;
			} else {
				const t = left / d;
				part.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
				left = 0;
			}
		}
		result.push(part);
	}
	return result;
}

/** Total length of strokes (pixels) */
export const strokesLength = (strokes: readonly Stroke[]) => strokes.reduce((sum, s) => sum + length(s), 0);
