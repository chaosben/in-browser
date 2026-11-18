// Selection (tool "Select", internally `lasso`): which items (strokes, shapes, pictures) are selected, moving/scaling
// them by their frame, moving the points of a single shape, and the actions of the menu. The frame and the dragged
// items are drawn by the stage; `rect` (screen) places the menu and is reactive.

import { snapAspect, snapMove, snapPoint, type Guides, type Rect, type SnapTargets } from '@in-browser/graphics/snap.js';
import { SNAP_PX, snapBox, unionBox } from '#lib/ink/align.js';
import { itemsInLasso, IDENTITY } from '#lib/ink/lasso.js';
import { itemBounds, union, type Box } from '#lib/ink/geometry.js';
import { closed, handlesOf, moveHandle, PLAIN, styleOf, withHeads, withStyle, type ShapeStyle } from '#lib/ink/shapes.js';
import type { Lifted, NotebookDoc } from '#lib/model/notebook.svelte.js';
import { isInk, isShape, type ShapeItem } from '#lib/model/types.js';
import type { SelectionHandle, Stage } from '#lib/render/stage.js';

export class Selection {
	/** Number of selected items (0: none) */
	count = $state(0);
	/** Some of them can take a color (strokes, icons) */
	colorable = $state(false);
	/** Color of the first colorable item (what the color field shows) */
	color = $state('#000000');
	/** Pen size of the first stroke or shape; 0: none selected */
	size = $state(0);
	/** Some selected shapes can be filled / are lines (arrowheads); style and arrowheads of the first of them */
	shapes = $state({ any: false, fillable: false, lines: false });
	style = $state<ShapeStyle>({ ...PLAIN });
	heads = $state({ start: false, end: false });
	/** Frame on screen (CSS pixels) while nothing is dragged; null hides the menu */
	rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	private page = -1;
	private ids = new Set<string>();
	private drag: {
		handle: SelectionHandle;
		x: number;
		y: number;
		lifted: Lifted;
		box: Box;
		shape: ShapeItem | null;
		/** Geometric box of the items (without pen widths), what snaps */
		content: Rect;
		targets: SnapTargets | null;
	} | null = null;

	constructor(
		private readonly stage: Stage,
		private readonly doc: NotebookDoc
	) {}

	get active() {
		return this.ids.size > 0;
	}

	/** Selects what a lasso loop (screen pixels) encloses on the page where it started; a tap selects the item there */
	lasso(points: number[], touch = false) {
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
			const hit = this.stage.itemAt(points[0], points[1], touch ? 16 : 8);
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
		const colored = items.find((i) => isInk(i) || i.type === 'icon');
		this.colorable = !!colored;
		if (colored && 'color' in colored) this.color = colored.color;
		const ink = items.filter(isInk);
		this.size = ink[0]?.size ?? 0;
		const shapes = items.filter(isShape);
		const lines = shapes.flatMap((s) => (s.fit.kind === 'line' ? [s.fit] : []));
		this.shapes = { any: shapes.length > 0, fillable: shapes.some((s) => closed(s.fit)), lines: lines.length > 0 };
		this.style = shapes.length ? styleOf(shapes.find((s) => closed(s.fit)) ?? shapes[0]) : { ...PLAIN };
		this.heads = { start: !!lines[0]?.start, end: !!lines[0]?.end };
		if (!scene || !items.length) {
			this.stage.setSelection(null);
			this.rect = null;
			return;
		}
		const box = items.reduce<Box | null>((b, s) => union(b, scene.bounds(s)), null)!;
		const shape = items.length === 1 && isShape(items[0]) ? items[0] : null;
		this.stage.setSelection({ page: this.page, box, t: IDENTITY, lifted: null, handles: shape && handlesOf(shape.fit) });
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
		const shape = lifted.items.length === 1 && isShape(lifted.items[0].item) ? lifted.items[0].item : null;
		const content = unionBox(lifted.items.map((l) => snapBox(l.item)));
		this.drag = { handle, x: sx, y: sy, lifted, box: s.box, shape, content, targets: this.stage.snapTargets(this.page, this.ids) };
		this.stage.setSelection({ ...s, lifted: lifted.items.map((l) => l.item) });
		this.rect = null;
	}

	/** `snap`: snap to the page, shapes and pictures (and line ends to 15° steps) */
	move(sx: number, sy: number, snap = false) {
		const d = this.drag;
		const s = this.stage.selection;
		if (!d || !s) return;
		const [x0, y0] = this.stage.toPage(this.page, d.x, d.y);
		const [x1, y1] = this.stage.toPage(this.page, sx, sy);
		const targets = snap ? d.targets : null;
		const tol = SNAP_PX / this.stage.view.zoom;
		const tolerance = { x: tol, y: tol };
		let guides: Guides | null = null;
		if (typeof d.handle === 'object') {
			// A point of a shape: the shape is drawn anew, the frame follows it
			const from = d.lifted.items[0].item as ShapeItem;
			const [hx, hy] = handlesOf(from.fit)[d.handle.point];
			let p = { x: hx + x1 - x0, y: hy + y1 - y0 };
			if (targets) ({ point: p, guides } = snapPoint(p, targets, tolerance));
			// A point on a guide stays there; otherwise line ends snap to 15° steps
			const fit = moveHandle(from.fit, d.handle.point, p.x, p.y, snap && !guides?.x && !guides?.y);
			d.shape = { ...from, fit };
			this.stage.setSelection({ ...s, lifted: [d.shape], box: itemBounds(d.shape), handles: handlesOf(fit) });
		} else if (d.handle === 'move') {
			let [dx, dy] = [x1 - x0, y1 - y0];
			if (targets) {
				const snapped = snapMove({ ...d.content, x: d.content.x + dx, y: d.content.y + dy }, targets, tolerance);
				dx += snapped.dx;
				dy += snapped.dy;
				guides = snapped.guides;
			}
			this.stage.setSelection({ ...s, t: { dx, dy, scale: 1, ox: 0, oy: 0 } });
		} else {
			// Scale around the opposite corner, keeping the proportions
			const b = d.box;
			const west = d.handle === 'nw' || d.handle === 'sw';
			const north = d.handle === 'nw' || d.handle === 'ne';
			const ox = west ? b.x1 : b.x0;
			const oy = north ? b.y1 : b.y0;
			const from = Math.hypot(x0 - ox, y0 - oy);
			const to = Math.hypot(x1 - ox, y1 - oy);
			let scale = from > 0 ? Math.max(0.05, to / from) : 1;
			if (targets) {
				// The moved edges of the items' box snap; the scale follows
				const c = d.content;
				const rect = { x: ox + (c.x - ox) * scale, y: oy + (c.y - oy) * scale, w: c.w * scale, h: c.h * scale };
				const snapped = snapAspect(rect, west ? -1 : 1, north ? -1 : 1, targets, tolerance, 1);
				if (rect.w > 0 || rect.h > 0) scale *= rect.w > 0 ? snapped.rect.w / rect.w : snapped.rect.h / rect.h;
				guides = snapped.guides;
			}
			this.stage.setSelection({ ...s, t: { dx: 0, dy: 0, scale, ox, oy } });
		}
		this.stage.setGuides(guides && d.targets ? { page: this.page, guides, boxes: d.targets.boxes } : null);
	}

	end() {
		const d = this.drag;
		const s = this.stage.selection;
		this.drag = null;
		this.stage.setGuides(null);
		if (!d || !s) return;
		if (typeof d.handle === 'object') {
			if (d.shape && d.shape !== d.lifted.items[0].item) this.doc.reshape(d.lifted, d.shape);
			else this.doc.drop(d.lifted, IDENTITY);
		} else this.doc.drop(d.lifted, s.t);
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

	/** Pen size of the selected strokes and shapes (one undo step) */
	resize(size: number) {
		this.doc.change(this.page, this.ids, (item) => (isInk(item) && item.size !== size ? { ...item, size } : null));
		this.refresh();
	}

	/** Fill, dashes or hand-drawn look of the selected shapes (one undo step) */
	restyle(style: Partial<ShapeStyle>) {
		this.doc.change(this.page, this.ids, (item) => (isShape(item) ? withStyle(item, style) : null));
		this.refresh();
	}

	/** Arrowheads of the selected lines (one undo step) */
	setHeads(start: boolean, end: boolean) {
		this.doc.change(this.page, this.ids, (item) => (isShape(item) && item.fit.kind === 'line' ? { ...item, fit: withHeads(item.fit, start, end) } : null));
		this.refresh();
	}
}
