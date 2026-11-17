// Paper of a page: white with lines, a grid or dots. Drawn in page points; the paper is a document color and does
// not follow the theme (like a printed page).

import type { Paper } from '#lib/model/types.js';

export const PAPER_COLOR = '#ffffff';
/** 1 cm lines, 5 mm grid and dots */
export const LINE_SPACING = 28.35;
export const GRID_SPACING = 14.17;
export const PAPER_INK = { lined: '#c7d2e0', grid: '#dde3ec', dotted: '#9aa7b8' } as const;

/** Draws the paper of a `w`×`h` page into the region `box` (page points; only that part is drawn) */
export function drawPaper(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	paper: Paper,
	w: number,
	h: number,
	box: { x0: number; y0: number; x1: number; y1: number },
	scale: number
) {
	ctx.fillStyle = PAPER_COLOR;
	ctx.fillRect(Math.max(0, box.x0), Math.max(0, box.y0), Math.min(w, box.x1) - Math.max(0, box.x0), Math.min(h, box.y1) - Math.max(0, box.y0));
	if (paper === 'blank') return;
	// At least one device pixel, so lines don't vanish when zoomed out
	const hair = Math.max(0.5, 1 / scale);
	if (paper === 'lined') {
		ctx.fillStyle = PAPER_INK.lined;
		const first = Math.max(1, Math.ceil(box.y0 / LINE_SPACING)) * LINE_SPACING;
		for (let y = first; y < Math.min(h, box.y1); y += LINE_SPACING) ctx.fillRect(0, y, w, hair);
	} else if (paper === 'grid') {
		ctx.fillStyle = PAPER_INK.grid;
		for (let y = Math.ceil(box.y0 / GRID_SPACING) * GRID_SPACING; y < Math.min(h, box.y1); y += GRID_SPACING) ctx.fillRect(0, y, w, hair);
		for (let x = Math.ceil(box.x0 / GRID_SPACING) * GRID_SPACING; x < Math.min(w, box.x1); x += GRID_SPACING) ctx.fillRect(x, 0, hair, h);
	} else {
		ctx.fillStyle = PAPER_INK.dotted;
		const r = Math.max(0.7, 1.2 / scale);
		for (let y = Math.max(1, Math.ceil(box.y0 / GRID_SPACING)) * GRID_SPACING; y < Math.min(h, box.y1); y += GRID_SPACING) {
			for (let x = Math.max(1, Math.ceil(box.x0 / GRID_SPACING)) * GRID_SPACING; x < Math.min(w, box.x1); x += GRID_SPACING) {
				ctx.fillRect(x - r / 2, y - r / 2, r, r);
			}
		}
	}
}
