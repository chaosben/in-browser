// Selection (tool "Select", internally `lasso`): which items are selected, moving/scaling them by their frame, moving
// the points of a single shape, and the actions of the menu. The frame and the dragged items are drawn by the stage;
// `rect` (screen) places the menu and is reactive. What an item is comes from the stage's `ItemKit`; strokes and
// shapes of the ink core get their own options (size, shape style, arrowheads).

import { snapAspect, snapMove, snapPoint, type Guides, type Rect, type SnapTargets } from '@in-browser/graphics/snap.js';
import { SNAP_PX, unionBox } from '../align.js';
import { union, type Box } from '../geometry.js';
import { isInk, isShape } from '../items.js';
import { IDENTITY, type Transform } from '../lasso.js';
import type { HandleOptions, SceneItem, SurfacePage } from '../render/kit.js';
import type { PageScene } from '../render/scene.js';
import type { SelectionHandle, Stage } from '../render/stage.js';
import { closed, PLAIN, styleOf, withHeads, withStyle, type ShapeStyle } from '../shapes.js';
import type { AlignEdge, Order } from '../edit/items.js';

/** Items taken out of a page while they are dragged, with their places in the draw order */
export interface Lifted<I extends SceneItem> {
	page: string;
	items: { item: I; at: number }[];
}

/** What the selection needs of the document (each change one undo step) */
export interface SelectionDoc<I extends SceneItem> {
	readonly pages: readonly SurfacePage[];
	scene(id: string): PageScene<I> | null;
	lift(pageIndex: number, ids: ReadonlySet<string>): Lifted<I> | null;
	drop(lifted: Lifted<I>, t: Transform): void;
	reshape(lifted: Lifted<I>, changed: I): void;
	deleteItems(pageIndex: number, ids: ReadonlySet<string>): void;
	duplicate(pageIndex: number, ids: ReadonlySet<string>): Set<string>;
	recolor(pageIndex: number, ids: ReadonlySet<string>, color: string): void;
	change(pageIndex: number, ids: ReadonlySet<string>, change: (item: I) => I | null): void;
	reorder(pageIndex: number, ids: ReadonlySet<string>, to: Order): void;
	align(pageIndex: number, ids: ReadonlySet<string>, edge: AlignEdge): void;
	distribute(pageIndex: number, ids: ReadonlySet<string>, axis: 'x' | 'y'): void;
}

export class Selection<P extends SurfacePage, I extends SceneItem> {
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
	/** Some selected item can't move (`ItemKit.fixed`): no handles, no dragging, aligning or duplicating */
	fixed = $state(false);
	/** The selected items and their page (for menus of the tool's own items) */
	items = $state.raw<I[]>([]);
	pageIndex = $state(-1);
	/** Frame on screen (CSS pixels) while nothing is dragged; null hides the menu */
	rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	private page = -1;
	private ids = new Set<string>();
	private hidden = false;
	private drag: {
		handle: SelectionHandle;
		x: number;
		y: number;
		lifted: Lifted<I>;
		box: Box;
		/** A single item whose own handles are dragged (a shape's points, a text box's sides), and it changed */
		single: I | null;
		changed: I | null;
		/** Geometric box of the items (without pen widths), what snaps */
		content: Rect;
		targets: SnapTargets | null;
	} | null = null;
	/** Arrow keys: the movable items taken out and how far they went (dropped as one step when the keys are let go) */
	private nudging: { lifted: Lifted<I>; dx: number; dy: number } | null = null;

	constructor(
		private readonly stage: Stage<P, I>,
		private readonly doc: SelectionDoc<I>
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
		const ids = new Set<string>();
		if (poly.length >= 6) for (const item of scene.itemsIn(box!)) if (scene.kit.inLasso(item, poly)) ids.add(item.id);
		this.select(hit.index, ids);
	}

	/** Selects the item at a screen point, if any – a press with "Select" on it, so it can be dragged right away */
	grab(sx: number, sy: number, touch: boolean): boolean {
		const hit = this.stage.itemAt(sx, sy, touch ? 16 : 8);
		if (!hit) return false;
		this.select(hit.page, new Set([hit.id]));
		return true;
	}

	/** Selects every item of a page (Ctrl+A) */
	selectAll(page: number) {
		const scene = this.doc.scene(this.doc.pages[page]?.id ?? '');
		if (scene) this.select(page, new Set(scene.items.map((i) => i.id)));
	}

	select(page: number, ids: Set<string>) {
		this.endNudge();
		this.page = page;
		this.ids = ids;
		this.refresh();
	}

	clear() {
		if (this.drag) this.end();
		this.endNudge();
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
		this.items = items;
		this.pageIndex = items.length ? this.page : -1;
		const color = items.map((i) => scene!.kit.color(i)).find((c) => c !== null);
		this.colorable = color !== undefined;
		if (color) this.color = color;
		const ink = items.filter(isInk);
		this.size = ink[0]?.size ?? 0;
		const shapes = items.filter(isShape);
		const lines = shapes.flatMap((s) => (s.fit.kind === 'line' ? [s.fit] : []));
		this.shapes = { any: shapes.length > 0, fillable: shapes.some((s) => closed(s.fit)), lines: lines.length > 0 };
		this.style = shapes.length ? styleOf(shapes.find((s) => closed(s.fit)) ?? shapes[0]) : { ...PLAIN };
		this.heads = { start: !!lines[0]?.start, end: !!lines[0]?.end };
		this.fixed = !!scene && items.some((i) => scene.kit.fixed?.(i));
		if (!scene || !items.length) {
			this.stage.setSelection(null);
			this.rect = null;
			return;
		}
		const box = items.reduce<Box | null>((b, s) => union(b, scene.bounds(s)), null)!;
		const handles = items.length === 1 ? (scene.kit.handles?.(items[0]) ?? null) : null;
		// Fixed items: a frame without handles
		this.stage.setSelection({ page: this.page, box, t: IDENTITY, lifted: null, handles: this.fixed ? [] : handles, hidden: this.hidden });
		this.updateRect();
	}

	/** Hides the frame and handles while a tool's own editor shows the selection (a text box typed into) */
	hideFrame(hidden: boolean) {
		if (this.hidden === hidden) return;
		this.hidden = hidden;
		this.refresh();
	}

	/** Menu position follows the view */
	updateRect() {
		this.rect = this.drag || this.nudging ? null : this.stage.selectionRect();
	}

	/** Part of the selection at a screen point */
	handleAt(sx: number, sy: number, touch: boolean): SelectionHandle | null {
		return this.active ? this.stage.selectionHandle(sx, sy, touch) : null;
	}

	start(handle: SelectionHandle, sx: number, sy: number) {
		this.endNudge();
		if (this.fixed) return;
		const lifted = this.doc.lift(this.page, this.ids);
		const s = this.stage.selection;
		if (!lifted || !s) return;
		const first = lifted.items[0].item;
		const single = lifted.items.length === 1 && this.stage.kit.handles?.(first) ? first : null;
		const content = unionBox(lifted.items.map((l) => this.stage.kit.snapBox(l.item)));
		this.drag = { handle, x: sx, y: sy, lifted, box: s.box, single, changed: null, content, targets: this.stage.snapTargets(this.page, this.ids) };
		this.stage.setSelection({ ...s, lifted: lifted.items.map((l) => l.item) });
		this.rect = null;
	}

	/**
	 * `snap`: snap to the page, shapes and pictures (and line ends to 15° steps); `keys`: Shift keeps a corner's
	 * proportions, K scales what sizes itself (a text box's font)
	 */
	move(sx: number, sy: number, snap = false, keys: Partial<Pick<HandleOptions, 'keepAspect' | 'scaleText'>> & { axis?: boolean } = {}) {
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
			// A handle of the item itself: it is drawn anew, the frame follows it
			const kit = this.stage.kit;
			const from = d.single;
			if (!from || !kit.handles || !kit.moveHandle) return;
			const [hx, hy] = kit.handles(from)![d.handle.point];
			let p = { x: hx + x1 - x0, y: hy + y1 - y0 };
			if (targets) ({ point: p, guides } = snapPoint(p, targets, tolerance));
			// A point on a guide stays there; otherwise line ends snap to 15° steps
			const opts = { snap: snap && !guides?.x && !guides?.y, keepAspect: !!keys.keepAspect, scaleText: !!keys.scaleText };
			const changed = kit.moveHandle(from, d.handle.point, p.x, p.y, opts);
			d.changed = changed;
			this.stage.setSelection({ ...s, lifted: [changed], box: kit.bounds(changed), handles: kit.handles(changed) });
		} else if (d.handle === 'move') {
			let [dx, dy] = [x1 - x0, y1 - y0];
			// Shift keeps the axis moved most along
			if (keys.axis) {
				if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
				else dx = 0;
			}
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
			this.stage.setSelection({ ...s, t: { dx: 0, dy: 0, scale, ox, oy, scaleText: !!keys.scaleText } });
		}
		this.stage.setGuides(guides && d.targets ? { page: this.page, guides, targets: d.targets } : null);
	}

	end() {
		const d = this.drag;
		const s = this.stage.selection;
		this.drag = null;
		this.stage.setGuides(null);
		if (!d || !s) return;
		if (typeof d.handle === 'object') {
			if (d.changed && d.changed !== d.lifted.items[0].item) this.doc.reshape(d.lifted, d.changed);
			else this.doc.drop(d.lifted, IDENTITY);
		} else this.doc.drop(d.lifted, s.t);
		this.refresh();
	}

	/**
	 * Arrow keys: moves the selection by (dx, dy) page points more, without snapping; fixed items stay. The items stay
	 * lifted until `endNudge`, so a whole key sequence is one undo step.
	 */
	nudge(dx: number, dy: number) {
		if (this.drag) return;
		if (!this.nudging) {
			const s = this.stage.selection;
			const kit = this.stage.kit;
			const ids = new Set(this.items.filter((i) => !kit.fixed?.(i)).map((i) => i.id));
			const lifted = s && ids.size ? this.doc.lift(this.page, ids) : null;
			if (!s || !lifted) return;
			this.nudging = { lifted, dx: 0, dy: 0 };
			this.stage.setSelection({ ...s, lifted: lifted.items.map((l) => l.item) });
			this.rect = null;
		}
		const n = this.nudging;
		const s = this.stage.selection;
		n.dx += dx;
		n.dy += dy;
		if (s) this.stage.setSelection({ ...s, t: { dx: n.dx, dy: n.dy, scale: 1, ox: 0, oy: 0 } });
	}

	/** Puts the items moved by arrow keys down (one undo step) */
	endNudge() {
		const n = this.nudging;
		if (!n) return;
		this.nudging = null;
		this.doc.drop(n.lifted, { dx: n.dx, dy: n.dy, scale: 1, ox: 0, oy: 0 });
		this.refresh();
	}

	delete() {
		this.endNudge();
		this.doc.deleteItems(this.page, this.ids);
		this.clear();
	}

	duplicate() {
		if (this.fixed) return;
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
		this.doc.change(this.page, this.ids, (item) => (isShape(item) ? (withStyle(item, style) as typeof item) : null));
		this.refresh();
	}

	/** Moves the selection in the draw order (one undo step) */
	reorder(to: Order) {
		this.doc.reorder(this.page, this.ids, to);
		this.refresh();
	}

	/** Lines the selected items up (two or more; one undo step) */
	align(edge: AlignEdge) {
		if (this.fixed) return;
		this.doc.align(this.page, this.ids, edge);
		this.refresh();
	}

	/** Spreads the selected items evenly (three or more; one undo step) */
	distribute(axis: 'x' | 'y') {
		if (this.fixed) return;
		this.doc.distribute(this.page, this.ids, axis);
		this.refresh();
	}

	/** Arrowheads of the selected lines (one undo step) */
	setHeads(start: boolean, end: boolean) {
		this.doc.change(this.page, this.ids, (item) => (isShape(item) && item.fit.kind === 'line' ? { ...item, fit: withHeads(item.fit, start, end) } : null));
		this.refresh();
	}
}
