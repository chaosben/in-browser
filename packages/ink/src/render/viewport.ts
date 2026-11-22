// Where the document is on screen. The pages are stacked vertically (document coordinates in points, pages
// centered on a common axis); the view shows the document from (x, y) at `zoom` CSS pixels per point.
// Plain numbers, no reactivity: it changes with every pan/zoom event.

export const PAGE_GAP = 24;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export interface PageRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Page positions in document coordinates; `width`/`height` of the whole document */
export function layoutPages(pages: readonly { w: number; h: number }[]): { rects: PageRect[]; width: number; height: number } {
	const width = Math.max(1, ...pages.map((p) => p.w));
	let y = PAGE_GAP;
	const rects = pages.map((p) => {
		const rect = { x: (width - p.w) / 2, y, w: p.w, h: p.h };
		y += p.h + PAGE_GAP;
		return rect;
	});
	return { rects, width, height: y };
}

export class Viewport {
	/** CSS pixels per point */
	zoom = 1;
	/** Document point at the top left of the view */
	x = 0;
	y = 0;
	/** Size of the view in CSS pixels */
	width = 1;
	height = 1;

	toScreenX = (x: number) => (x - this.x) * this.zoom;
	toScreenY = (y: number) => (y - this.y) * this.zoom;
	toDocX = (sx: number) => sx / this.zoom + this.x;
	toDocY = (sy: number) => sy / this.zoom + this.y;

	/** Zoom so `width` (of the document or a page) fills the view with a small margin, at most `max` × */
	fitWidth(width: number, max = MAX_ZOOM) {
		this.zoom = clampZoom(Math.min(max, (this.width - 16) / width));
		this.x = 0;
	}

	/** Zooms by `factor` keeping the document point under (sx, sy) in place */
	zoomAt(factor: number, sx: number, sy: number) {
		const dx = this.toDocX(sx);
		const dy = this.toDocY(sy);
		this.zoom = clampZoom(this.zoom * factor);
		this.x = dx - sx / this.zoom;
		this.y = dy - sy / this.zoom;
	}

	/** Moves the content by (dx, dy) screen pixels */
	panBy(dx: number, dy: number) {
		this.x -= dx / this.zoom;
		this.y -= dy / this.zoom;
	}

	/**
	 * Keeps the document in view: a narrower document is centered, otherwise the view may go a little past
	 * its edges, never further.
	 */
	clamp(docWidth: number, docHeight: number) {
		const viewW = this.width / this.zoom;
		const viewH = this.height / this.zoom;
		const margin = 48 / this.zoom;
		if (docWidth <= viewW) this.x = (docWidth - viewW) / 2;
		else this.x = Math.min(Math.max(this.x, -margin), docWidth - viewW + margin);
		if (docHeight <= viewH) this.y = Math.min(Math.max(this.y, docHeight - viewH), 0);
		else this.y = Math.min(Math.max(this.y, -margin), docHeight - viewH + margin);
	}

	/** Indices of the pages that are (partly) visible, plus `extra` on each side */
	visiblePages(rects: readonly PageRect[], extra = 0): number[] {
		const top = this.y;
		const bottom = this.y + this.height / this.zoom;
		let first = -1;
		let last = -1;
		for (let i = 0; i < rects.length; i++) {
			if (rects[i].y + rects[i].h >= top && rects[i].y <= bottom) {
				if (first < 0) first = i;
				last = i;
			}
		}
		if (first < 0) return [];
		const from = Math.max(0, first - extra);
		const to = Math.min(rects.length - 1, last + extra);
		return Array.from({ length: to - from + 1 }, (_, i) => from + i);
	}

	/** Page at a screen point, with the point in page coordinates; null between pages */
	pageAt(rects: readonly PageRect[], sx: number, sy: number): { index: number; x: number; y: number } | null {
		const x = this.toDocX(sx);
		const y = this.toDocY(sy);
		for (let i = 0; i < rects.length; i++) {
			const r = rects[i];
			if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { index: i, x: x - r.x, y: y - r.y };
		}
		return null;
	}

	/** The page nearest to the middle of the view (the "current" page) */
	centerPage(rects: readonly PageRect[]): number {
		const mid = this.y + this.height / this.zoom / 2;
		let best = 0;
		let bestDist = Infinity;
		rects.forEach((r, i) => {
			const d = mid < r.y ? r.y - mid : mid > r.y + r.h ? mid - r.y - r.h : 0;
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		});
		return best;
	}
}

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
