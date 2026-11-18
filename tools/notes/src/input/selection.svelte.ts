// Lasso selection: which items (strokes, pictures) are selected, moving/scaling them by their frame, and the actions of the menu.
// The frame and the dragged strokes are drawn by the stage; `rect` (screen) places the menu and is reactive.

import { itemsInLasso, IDENTITY, type Transform } from '#lib/ink/lasso.js';
import { union, type Box } from '#lib/ink/geometry.js';
import type { Lifted, NotebookDoc } from '#lib/model/notebook.svelte.js';
import { isStroke } from '#lib/model/types.js';
import type { SelectionHandle, Stage } from '#lib/render/stage.js';

export class Selection {
	/** Number of selected items (0: none) */
	count = $state(0);
	/** Some of them can take a color (strokes, icons) */
	colorable = $state(false);
	/** Color of the first colorable item (what the color field shows) */
	color = $state('#000000');
	/** Frame on screen (CSS pixels) while nothing is dragged; null hides the menu */
	rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	private page = -1;
	private ids = new Set<string>();
	private drag: { handle: SelectionHandle; x: number; y: number; lifted: Lifted; box: Box } | null = null;

	constructor(
		private readonly stage: Stage,
		private readonly doc: NotebookDoc
	) {}

	get active() {
		return this.ids.size > 0;
	}

	/** Selects what a lasso loop (screen pixels) encloses on the page where it started; a tap selects a picture */
	lasso(points: number[]) {
		this.clear();
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		for (let i = 0; i < points.length; i += 2) {
			x0 = Math.min(x0, points[i]);
			x1 = Math.max(x1, points[i]);
			y0 = Math.min(y0, points[i + 1]);
			y1 = Math.max(y1, points[i + 1]);
		}
		if (x1 - x0 < 8 && y1 - y0 < 8) {
			const hit = this.stage.pictureAt(points[0], points[1]);
			if (hit) this.select(hit.page, new Set([hit.id]));
			return;
		}
		if (points.length < 6) return;
		const hit = this.stage.pageAt(points[0], points[1]);
		const scene = hit && this.doc.scene(this.doc.pages[hit.index].id);
		if (!hit || !scene) return;
		const poly: number[] = [];
		let box: Box | null = null;
		for (let i = 0; i < points.length; i += 2) {
			const [x, y] = this.stage.toPage(hit.index, points[i], points[i + 1]);
			poly.push(x, y);
			box = union(box, { x0: x, y0: y, x1: x, y1: y });
		}
		const items = itemsInLasso(scene.itemsIn(box!), poly);
		this.select(hit.index, new Set(items.map((s) => s.id)));
	}

	select(page: number, ids: Set<string>) {
		this.page = page;
		this.ids = ids;
		this.refresh();
	}

	clear() {
		if (this.drag) this.end();
		this.ids = new Set();
		this.page = -1;
		this.refresh();
	}

	/** After undo/redo, changes from elsewhere or view changes: frame from what is still there */
	refresh() {
		const scene = this.page >= 0 ? this.doc.scene(this.doc.pages[this.page]?.id ?? '') : null;
		const items = scene ? scene.items.filter((s) => this.ids.has(s.id)) : [];
		this.ids = new Set(items.map((s) => s.id));
		this.count = items.length;
		const colored = items.find((i) => isStroke(i) || i.type === 'icon');
		this.colorable = !!colored;
		if (colored && 'color' in colored) this.color = colored.color;
		if (!scene || !items.length) {
			this.stage.setSelection(null);
			this.rect = null;
			return;
		}
		const box = items.reduce<Box | null>((b, s) => union(b, scene.bounds(s)), null)!;
		this.stage.setSelection({ page: this.page, box, t: IDENTITY, lifted: null });
		this.updateRect();
	}

	/** Menu position follows the view */
	updateRect() {
		this.rect = this.drag ? null : this.stage.selectionRect();
	}

	/** Part of the selection at a screen point */
	handleAt(sx: number, sy: number, touch: boolean): SelectionHandle | null {
		return this.active ? this.stage.selectionHandle(sx, sy, touch) : null;
	}

	start(handle: SelectionHandle, sx: number, sy: number) {
		const lifted = this.doc.lift(this.page, this.ids);
		const s = this.stage.selection;
		if (!lifted || !s) return;
		this.drag = { handle, x: sx, y: sy, lifted, box: s.box };
		this.stage.setSelection({ ...s, lifted: lifted.items.map((l) => l.item) });
		this.rect = null;
	}

	move(sx: number, sy: number) {
		const d = this.drag;
		const s = this.stage.selection;
		if (!d || !s) return;
		const [x0, y0] = this.stage.toPage(this.page, d.x, d.y);
		const [x1, y1] = this.stage.toPage(this.page, sx, sy);
		let t: Transform;
		if (d.handle === 'move') t = { dx: x1 - x0, dy: y1 - y0, scale: 1, ox: 0, oy: 0 };
		else {
			// Scale around the opposite corner, keeping the proportions
			const b = d.box;
			const ox = d.handle === 'nw' || d.handle === 'sw' ? b.x1 : b.x0;
			const oy = d.handle === 'nw' || d.handle === 'ne' ? b.y1 : b.y0;
			const from = Math.hypot(x0 - ox, y0 - oy);
			const to = Math.hypot(x1 - ox, y1 - oy);
			t = { dx: 0, dy: 0, scale: from > 0 ? Math.max(0.05, to / from) : 1, ox, oy };
		}
		this.stage.setSelection({ ...s, t });
	}

	end() {
		const d = this.drag;
		const s = this.stage.selection;
		this.drag = null;
		if (!d || !s) return;
		this.doc.drop(d.lifted, s.t);
		this.refresh();
	}

	delete() {
		this.doc.deleteItems(this.page, this.ids);
		this.clear();
	}

	duplicate() {
		this.select(this.page, this.doc.duplicate(this.page, this.ids));
	}

	recolor(color: string) {
		this.doc.recolor(this.page, this.ids, color);
		this.refresh();
	}
}
