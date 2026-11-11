// Click animations: each style runs once over the item's duration (phase 0…1) and fades out by itself.

import type { ClickAnnotation, ClickStyle } from '#lib/project/types.js';
import type { Ctx2D } from './compositor.js';

export const CLICK_STYLES: readonly ClickStyle[] = ['ripple', 'rings', 'dot', 'burst'];

/** Phase shown while stopped and in previews: the shape is clearly visible */
export const STILL_PHASE = 0.35;

/** Phase of the animation at timeline time `t` (0 at the start, 1 at the end) */
export function clickPhase(t: number, start: number, end: number): number {
	if (!(end > start)) return 1;
	return Math.min(1, Math.max(0, (t - start) / (end - start)));
}

const easeOut = (p: number) => 1 - (1 - p) ** 3;
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Draws `a` at `phase`; `cx`/`cy` center and `r` largest radius in canvas pixels */
export function drawClick(ctx: Ctx2D, a: ClickAnnotation, cx: number, cy: number, r: number, phase: number) {
	const p = clamp01(phase);
	const base = ctx.globalAlpha;
	ctx.strokeStyle = a.color;
	ctx.fillStyle = a.color;
	ctx.lineCap = 'round';
	// Soft shadow keeps light colors visible on light content
	ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
	ctx.shadowBlur = 0.12 * r;

	const ring = (q: number) => {
		if (q <= 0 || q >= 1) return;
		ctx.globalAlpha = base * (1 - q);
		ctx.lineWidth = r * (0.03 + 0.15 * (1 - q));
		ctx.beginPath();
		ctx.arc(cx, cy, r * (0.15 + 0.85 * easeOut(q)), 0, 2 * Math.PI);
		ctx.stroke();
	};

	switch (a.style) {
		case 'ripple': {
			// Faint fill under the ring, gone halfway through
			ctx.globalAlpha = base * 0.25 * Math.max(0, 1 - 2 * p);
			ctx.beginPath();
			ctx.arc(cx, cy, r * (0.15 + 0.85 * easeOut(p)), 0, 2 * Math.PI);
			ctx.fill();
			ring(p);
			break;
		}
		case 'rings':
			ring(p / 0.7);
			ring((p - 0.3) / 0.7);
			break;
		case 'dot': {
			// Pops up with a slight overshoot within the first quarter, then shrinks and fades
			const pop = p < 0.25 ? Math.sin((p / 0.25) * (Math.PI / 2)) * 1.15 : 1.15 - 0.55 * ((p - 0.25) / 0.75);
			ctx.globalAlpha = base * 0.85 * (p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5);
			ctx.beginPath();
			ctx.arc(cx, cy, Math.max(0, r * 0.45 * pop), 0, 2 * Math.PI);
			ctx.fill();
			break;
		}
		case 'burst': {
			const e = easeOut(p);
			const inner = r * (0.25 + 0.6 * e);
			const length = r * (0.35 * (1 - p) + 0.05);
			ctx.globalAlpha = base * (1 - p * p);
			ctx.lineWidth = r * 0.09;
			ctx.beginPath();
			for (let i = 0; i < 8; i++) {
				const angle = (i * Math.PI) / 4 - Math.PI / 8;
				const dx = Math.cos(angle);
				const dy = Math.sin(angle);
				ctx.moveTo(cx + dx * inner, cy + dy * inner);
				ctx.lineTo(cx + dx * (inner + length), cy + dy * (inner + length));
			}
			ctx.stroke();
			// Center point that is gone quickly
			ctx.globalAlpha = base * Math.max(0, 1 - 3 * p);
			ctx.beginPath();
			ctx.arc(cx, cy, r * 0.14, 0, 2 * Math.PI);
			ctx.fill();
			break;
		}
	}
	ctx.globalAlpha = base;
	ctx.shadowColor = 'transparent';
}
