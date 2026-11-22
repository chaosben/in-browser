// Editing the pages' own content: the switch that allows it and what is picked of a page's objects. Kept apart from
// the selection of comments (`PdfSelection`) – content and comments never mix.

import type { Box } from '@in-browser/ink/geometry.js';
import type { Matrix } from '@in-browser/pdf/geometry.js';
import type { ContentItem } from './document.svelte.js';

class ContentEditing {
	/** The switch "Edit content": off for every opened PDF, never remembered – content is never changed by accident */
	on = $state(false);
	/** The page (its index) whose objects are picked, and which */
	page = $state<number | null>(null);
	ids = $state.raw<ReadonlySet<number>>(new Set());
	/** While the picked objects are dragged or scaled: the change shown (in the page as shown) */
	drag = $state.raw<Matrix | null>(null);
	/** A frame being dragged open to pick what it holds */
	band = $state.raw<{ page: number; box: Box } | null>(null);
	/** The object under the pointer */
	hover = $state.raw<{ page: number; id: number } | null>(null);
	/** A picture of the picked objects shown moving with a drag (`at`: where it stays after the drop, until the
	 * page itself shows the change) */
	lifted = $state.raw<{ page: number; canvas: HTMLCanvasElement; at: Matrix | null } | null>(null);

	select(page: number, ids: Iterable<number>) {
		const set = new Set(ids);
		this.page = set.size ? page : null;
		this.ids = set;
	}

	clear() {
		this.page = null;
		this.ids = new Set();
		this.drag = this.band = this.hover = null;
		this.lifted = null;
	}

	/** Ends editing (another PDF, the switch turned off) */
	stop() {
		this.on = false;
		this.clear();
	}
}

export const contentEdit = new ContentEditing();

/** The box around several */
export function unionBox(boxes: readonly Box[]): Box | null {
	if (!boxes.length) return null;
	return { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
}

/** A box as a transformation of the page as shown leaves it */
export function movedBox(box: Box, m: Matrix | null): Box {
	if (!m) return box;
	const xs: number[] = [];
	const ys: number[] = [];
	for (const [x, y] of [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]]) {
		xs.push(x * m[0] + y * m[2] + m[4]);
		ys.push(x * m[1] + y * m[3] + m[5]);
	}
	return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** The object to pick at a point: of those there the smallest (a background never hides what lies on it) */
export function contentAt(items: readonly ContentItem[], x: number, y: number, tolerance: number): ContentItem | null {
	let found: ContentItem | null = null;
	let size = Infinity;
	for (const item of items) {
		const b = item.box;
		if (x < b.x0 - tolerance || x > b.x1 + tolerance || y < b.y0 - tolerance || y > b.y1 + tolerance) continue;
		const area = (b.x1 - b.x0) * (b.y1 - b.y0);
		if (area <= size) {
			found = item;
			size = area;
		}
	}
	return found;
}

/** The corner of a box at a point (0 top left, 1 top right, 2 bottom right, 3 bottom left), or -1 */
export function cornerAt(box: Box, x: number, y: number, tolerance: number): number {
	const corners = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
	return corners.findIndex(([cx, cy]) => Math.abs(x - cx) <= tolerance && Math.abs(y - cy) <= tolerance);
}
