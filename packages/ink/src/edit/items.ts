// Editing the items of a document's pages, one undo step per action: adding strokes and shapes, erasing (whole or
// pixels), turning a stroke into a shape, and what the selection does (lift/drop, reshape, change, recolor,
// duplicate, delete). Every edit is a list of `ReplaceOp`s – an item out at its place, its replacements in – that
// undo and redo run backwards and forwards. The document keeps the history and saves; it is the `EditorHost`.

import { union, type Box } from '../geometry.js';
import type { Rect } from '@in-browser/graphics/snap.js';
import type { SelectionDoc, Lifted } from '../input/selection.svelte.js';
import type { SuggestionDoc } from '../input/suggestion.svelte.js';
import { isStroke, type Ink, type InkTool, type ShapeItem, type Stroke } from '../items.js';
import { isIdentity, type Transform } from '../lasso.js';
import type { ItemKit, SceneItem, SurfacePage } from '../render/kit.js';
import type { PageScene } from '../render/scene.js';
import { inkStrokes, withStyle, type ShapeFit, type ShapeStyle } from '../shapes.js';
import { eraseFromStroke } from '../split.js';

/** One undo step */
export interface Command {
	undo(): void;
	redo(): void;
}

/** One item replaced by others (none: removed) at its place in the draw order */
interface ReplaceOp<I> {
	removed: I;
	at: number;
	added: I[];
}

/** Where `reorder` moves items in the draw order */
export type Order = 'front' | 'forward' | 'backward' | 'back';

/** Which edge (or middle) `align` lines items up with */
export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** The draw order with the items of `ids` moved (pure) */
export function reordered<I extends { readonly id: string }>(items: readonly I[], ids: ReadonlySet<string>, to: Order): I[] {
	const moved = items.filter((item) => ids.has(item.id));
	const rest = items.filter((item) => !ids.has(item.id));
	if (to === 'front') return [...rest, ...moved];
	if (to === 'back') return [...moved, ...rest];
	// One place: each moved item past its neighbour that isn't moved (the topmost first when going forward)
	const out = [...items];
	const step = to === 'forward' ? 1 : -1;
	for (let i = step > 0 ? out.length - 2 : 1; step > 0 ? i >= 0 : i < out.length; i -= step) {
		const j = i + step;
		if (ids.has(out[i].id) && !ids.has(out[j].id)) [out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** What the editor needs of the document */
export interface EditorHost<I extends SceneItem> {
	readonly pages: readonly SurfacePage[];
	/** Content of a loaded page, null while it is not loaded */
	scene(id: string): PageScene<I> | null;
	/** Records an undo step (already done) */
	push(command: Command): void;
	/** A page's content changed (to be saved) */
	touch(pageId: string): void;
	/** A finished stroke or shape was added on top (the surface draws it into its tiles) */
	committed(pageId: string, scene: PageScene<I>, item: I): void;
	/** Items in a region of a page were added, removed, changed or restored */
	region(pageId: string, box: Box | null): void;
}

// Strokes and shapes are items of every tool using the ink core: where the editor makes them, they are its `I`
const asItem = <I>(ink: Ink): I => ink as unknown as I;

export class ItemEditor<I extends SceneItem> implements SelectionDoc<I>, SuggestionDoc<I> {
	private erasing: { page: string; ops: ReplaceOp<I>[] } | null = null;

	constructor(
		private readonly host: EditorHost<I>,
		private readonly kit: ItemKit<I>
	) {}

	get pages(): readonly SurfacePage[] {
		return this.host.pages;
	}

	scene(id: string): PageScene<I> | null {
		return this.host.scene(id);
	}

	/** The page at an index with its loaded content, null if either is missing */
	private sceneAt(pageIndex: number): { page: SurfacePage; scene: PageScene<I> } | null {
		const page = this.host.pages[pageIndex];
		const scene = page && this.host.scene(page.id);
		return scene ? { page, scene } : null;
	}

	/** Adds a finished stroke on top (one undo step); its id */
	addStroke(pageIndex: number, data: { points: Float32Array; tool: InkTool; color: string; size: number }): string | null {
		if (data.points.length < 3) return null;
		return this.addItem(pageIndex, asItem<I>({ id: crypto.randomUUID(), ...data }));
	}

	/** Adds a shape drawn with the shape tool on top (one undo step); its id */
	addShape(pageIndex: number, fit: ShapeFit, color: string, size: number, style: ShapeStyle): string | null {
		return this.addItem(pageIndex, asItem<I>(withStyle({ id: crypto.randomUUID(), type: 'shape', fit, color, size }, style)));
	}

	/** Adds an item drawn on the surface on top (one undo step; drawn into the tiles, not re-rendered); its id */
	addItem(pageIndex: number, item: I): string | null {
		const found = this.sceneAt(pageIndex);
		if (!found) return null;
		const { page, scene } = found;
		const add = (at?: number) => {
			scene.add(item, at);
			this.host.committed(page.id, scene, item);
			this.host.touch(page.id);
		};
		add();
		this.host.push({
			undo: () => {
				const box = scene.bounds(item);
				scene.remove(item);
				this.host.region(page.id, box);
				this.host.touch(page.id);
			},
			redo: () => add()
		});
		return item.id;
	}

	/** Puts items on top of a page (one undo step), e.g. inserted pictures */
	addOnTop(pageIndex: number, items: I[]) {
		const page = this.sceneAt(pageIndex)?.page;
		if (page) this.applyOps(page.id, [], items);
	}

	/** Replaces a stroke by a shape (a recognized one, one undo step); the shape's id, null if the stroke is gone */
	toShape(pageIndex: number, strokeId: string, fit: ShapeFit): string | null {
		const found = this.sceneAt(pageIndex);
		const stroke = found?.scene.items.find((i) => i.id === strokeId);
		if (!found || !stroke || !isStroke(stroke)) return null;
		const { page, scene } = found;
		const shape: ShapeItem = { id: crypto.randomUUID(), type: 'shape', fit, color: stroke.color, size: stroke.size };
		this.applyOps(page.id, [{ removed: stroke, at: scene.items.indexOf(stroke), added: [asItem<I>(shape)] }]);
		return shape.id;
	}

	// --- Erasing ---

	/** Removes strokes during an erase gesture; `eraseEnd` makes the gesture one undo step */
	erase(pageIndex: number, items: I[]) {
		this.replace(pageIndex, items.map((stroke) => ({ stroke, pieces: [] })));
	}

	/**
	 * Pixel eraser: cuts the circle (page points) out of the strokes it touches, during an erase gesture. A shape
	 * becomes ordinary strokes then (the pieces of its outline).
	 */
	erasePixels(pageIndex: number, strokes: (I & Ink)[], x: number, y: number, r: number) {
		const cuts: { stroke: I & Ink; pieces: Float32Array[] }[] = [];
		for (const stroke of strokes) {
			// A shape is cut as a whole: touched strokes in pieces, the others (dashes, edges, arrowheads) as they are
			const own = inkStrokes(stroke);
			const cut = own.map((s) => eraseFromStroke(s, x, y, r));
			if (cut.some(Boolean)) cuts.push({ stroke, pieces: cut.flatMap((p, i) => p ?? [own[i].points]) });
		}
		if (cuts.length) this.replace(pageIndex, cuts);
	}

	/** Replaces strokes by pieces of them (none = removed) at their place in the draw order */
	/** Items out, each replaced by the pieces of its pen line (none: removed) */
	private replace(pageIndex: number, cuts: { stroke: I; pieces: Float32Array[] }[]) {
		const found = this.sceneAt(pageIndex);
		if (!found) return;
		const { page, scene } = found;
		if (this.erasing && this.erasing.page !== page.id) this.eraseEnd();
		this.erasing ??= { page: page.id, ops: [] };
		let box: Box | null = null;
		for (const { stroke, pieces } of cuts) {
			const bounds = scene.bounds(stroke);
			const at = scene.remove(stroke);
			if (at < 0) continue;
			const pen = pieces.length ? inkStrokes(stroke as I & Ink)[0] : null;
			const added = pieces.map((points) => asItem<I>({ id: crypto.randomUUID(), tool: pen!.tool, color: pen!.color, size: pen!.size, points } satisfies Stroke));
			added.forEach((piece, i) => scene.add(piece, at + i));
			this.erasing.ops.push({ removed: stroke, at, added });
			box = union(box, bounds);
		}
		if (box) {
			this.host.region(page.id, box);
			this.host.touch(page.id);
		}
	}

	eraseEnd() {
		const gesture = this.erasing;
		this.erasing = null;
		if (!gesture || !gesture.ops.length) return;
		this.host.push(this.opsCommand(gesture.page, gesture.ops));
	}

	// --- Selection ---

	/** Items of a page by id, in draw order */
	itemsById(pageIndex: number, ids: ReadonlySet<string>): I[] {
		return this.sceneAt(pageIndex)?.scene.items.filter((s) => ids.has(s.id)) ?? [];
	}

	/** Takes items out of the page while they are dragged (drawn by the stage meanwhile) */
	lift(pageIndex: number, ids: ReadonlySet<string>): Lifted<I> | null {
		const found = this.sceneAt(pageIndex);
		if (!found) return null;
		const { page, scene } = found;
		const items: { item: I; at: number }[] = [];
		let box: Box | null = null;
		// From the back, so the recorded places stay valid when put back from the front
		for (let i = scene.items.length - 1; i >= 0; i--) {
			const item = scene.items[i];
			if (!ids.has(item.id)) continue;
			box = union(box, scene.bounds(item));
			scene.remove(item);
			items.unshift({ item, at: i });
		}
		if (box) this.host.region(page.id, box);
		return { page: page.id, items };
	}

	/** Puts lifted items back, moved/scaled (one undo step); unchanged when the transform is none */
	drop(lifted: Lifted<I>, t: Transform) {
		this.putBack(lifted, (item) => this.kit.transform(item, t), isIdentity(t));
	}

	/** Puts a single lifted item back as `changed` (a shape with moved points; one undo step) */
	reshape(lifted: Lifted<I>, changed: I) {
		this.putBack(lifted, () => changed, false);
	}

	private putBack(lifted: Lifted<I>, change: (item: I) => I, unchanged: boolean) {
		const scene = this.host.scene(lifted.page);
		if (!scene) return;
		const ops: ReplaceOp<I>[] = lifted.items.map(({ item, at }) => ({ removed: item, at, added: [change(item)] }));
		for (const { item, at } of lifted.items) scene.add(item, at);
		if (unchanged) {
			this.host.region(lifted.page, ops.reduce<Box | null>((b, op) => union(b, this.kit.bounds(op.removed)), null));
			return;
		}
		const command = this.opsCommand(lifted.page, ops);
		command.redo();
		this.host.push(command);
	}

	/** Deletes items (one undo step) */
	deleteItems(pageIndex: number, ids: ReadonlySet<string>) {
		const found = this.sceneAt(pageIndex);
		if (!found) return;
		const { page, scene } = found;
		this.applyOps(page.id, this.itemsById(pageIndex, ids).map((item) => ({ removed: item, at: scene.items.indexOf(item), added: [] })));
	}

	/** Gives items that have a color (`ItemKit.color`) another one (one undo step); the others stay as they are */
	/**
	 * New color of items (one undo step), with the opacity it has (`#rrggbbaa`; color fields without an opacity
	 * hand back the one the item has).
	 */
	recolor(pageIndex: number, ids: ReadonlySet<string>, color: string) {
		this.change(pageIndex, ids, (item) => {
			const old = this.kit.color(item);
			if (old === null) return null;
			// `old` as it looks (`ItemKit.color`, a highlighter's with its opacity): a color chosen fully opaque for a
			// see-through item says so (`ff` – a highlighter without one would be see-through)
			return { ...item, color: color.length === 7 && old.length === 9 ? `${color}ff` : color };
		});
	}

	/** Changes items (one undo step): `change` gives the new version of an item, or null to leave it */
	change(pageIndex: number, ids: ReadonlySet<string>, change: (item: I) => I | null) {
		const found = this.sceneAt(pageIndex);
		if (!found) return;
		const { page, scene } = found;
		const ops = this.itemsById(pageIndex, ids).flatMap((item) => {
			const changed = change(item);
			return changed ? [{ removed: item, at: scene.items.indexOf(item), added: [changed] }] : [];
		});
		this.applyOps(page.id, ops);
	}

	/** Moves items in the draw order (one undo step): all the way to the front or back, or one place past the next
	 * item that isn't selected */
	reorder(pageIndex: number, ids: ReadonlySet<string>, to: Order) {
		const found = this.sceneAt(pageIndex);
		if (!found) return;
		const { page, scene } = found;
		const before = [...scene.items];
		const after = reordered(before, ids, to);
		if (after.every((item, i) => item === before[i])) return;
		const moved = before.filter((item) => ids.has(item.id));
		const region = moved.reduce<Box | null>((b, s) => union(b, this.kit.bounds(s)), null);
		// The others keep their order: take the moved ones out, put them in at their new places (front to back)
		const place = (order: readonly I[]) => {
			for (const item of moved) scene.remove(item);
			order.forEach((item, i) => ids.has(item.id) && scene.add(item, i));
			this.host.region(page.id, region);
			this.host.touch(page.id);
		};
		const command: Command = { undo: () => place(before), redo: () => place(after) };
		command.redo();
		this.host.push(command);
	}

	/** Lines items up with an edge or the middle of the box around all of them (one undo step) */
	align(pageIndex: number, ids: ReadonlySet<string>, edge: AlignEdge) {
		const items = this.itemsById(pageIndex, ids);
		if (items.length < 2) return;
		const boxes = new Map(items.map((item) => [item.id, this.kit.snapBox(item)]));
		const all = [...boxes.values()];
		const x0 = Math.min(...all.map((b) => b.x));
		const y0 = Math.min(...all.map((b) => b.y));
		const x1 = Math.max(...all.map((b) => b.x + b.w));
		const y1 = Math.max(...all.map((b) => b.y + b.h));
		this.moveEach(pageIndex, ids, (b) => {
			switch (edge) {
				case 'left':
					return [x0 - b.x, 0];
				case 'center':
					return [(x0 + x1) / 2 - (b.x + b.w / 2), 0];
				case 'right':
					return [x1 - (b.x + b.w), 0];
				case 'top':
					return [0, y0 - b.y];
				case 'middle':
					return [0, (y0 + y1) / 2 - (b.y + b.h / 2)];
				case 'bottom':
					return [0, y1 - (b.y + b.h)];
			}
		});
	}

	/** Spreads items with equal gaps between the outermost two, across or down (three or more; one undo step) */
	distribute(pageIndex: number, ids: ReadonlySet<string>, axis: 'x' | 'y') {
		const items = this.itemsById(pageIndex, ids);
		if (items.length < 3) return;
		const pos = (b: Rect) => (axis === 'x' ? b.x : b.y);
		const len = (b: Rect) => (axis === 'x' ? b.w : b.h);
		const sorted = items.map((item) => ({ id: item.id, box: this.kit.snapBox(item) })).sort((a, b) => pos(a.box) + len(a.box) / 2 - (pos(b.box) + len(b.box) / 2));
		const start = pos(sorted[0].box);
		const end = Math.max(...sorted.map((s) => pos(s.box) + len(s.box)));
		const gap = (end - start - sorted.reduce((sum, s) => sum + len(s.box), 0)) / (sorted.length - 1);
		const target = new Map<string, number>();
		let at = start;
		for (const s of sorted) {
			target.set(s.id, at);
			at += len(s.box) + gap;
		}
		this.moveEach(pageIndex, ids, (b, item) => {
			const d = target.get(item.id)! - pos(b);
			return axis === 'x' ? [d, 0] : [0, d];
		});
	}

	/** Moves each item by what `by` says for its box (one undo step) */
	private moveEach(pageIndex: number, ids: ReadonlySet<string>, by: (box: Rect, item: I) => [number, number]) {
		this.change(pageIndex, ids, (item) => {
			const [dx, dy] = by(this.kit.snapBox(item), item);
			return Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005 ? null : this.kit.transform(item, { dx, dy, scale: 1, ox: 0, oy: 0 });
		});
	}

	/** Copies items a little offset, on top; the ids of the copies */
	duplicate(pageIndex: number, ids: ReadonlySet<string>): Set<string> {
		const page = this.sceneAt(pageIndex)?.page;
		if (!page) return new Set();
		const copies = this.itemsById(pageIndex, ids).map((s) => this.kit.transform({ ...s, id: crypto.randomUUID() }, { dx: 12, dy: 12, scale: 1, ox: 0, oy: 0 }));
		this.applyOps(page.id, [], copies);
		return new Set(copies.map((c) => c.id));
	}

	// --- Steps ---

	/** Undo/redo of replacement steps (each: an item removed at `at`, replacements put in its place) */
	private opsCommand(pageId: string, ops: ReplaceOp<I>[]): Command {
		const scene = this.host.scene(pageId)!;
		// Old and new places together (from the items: a moved one keeps its id, so the index can't tell them apart)
		const region = ops.reduce<Box | null>(
			(box, op) => op.added.reduce<Box | null>((b, s) => union(b, this.kit.bounds(s)), union(box, this.kit.bounds(op.removed))),
			null
		);
		if (!ops.length) return { undo: () => this.host.touch(pageId), redo: () => this.host.touch(pageId) };
		return {
			undo: () => {
				for (let i = ops.length - 1; i >= 0; i--) {
					const op = ops[i];
					for (const piece of op.added) scene.remove(piece);
					scene.add(op.removed, op.at);
				}
				this.host.region(pageId, region);
				this.host.touch(pageId);
			},
			redo: () => {
				for (const op of ops) {
					scene.remove(op.removed);
					op.added.forEach((piece, i) => scene.add(piece, op.at + i));
				}
				this.host.region(pageId, region);
				this.host.touch(pageId);
			}
		};
	}

	/** Runs replacement steps and puts new items on top, as one undo step (indices are those before the steps) */
	private applyOps(pageId: string, ops: ReplaceOp<I>[], added: I[] = []) {
		if (!ops.length && !added.length) return;
		// Back to front, so each step's index is still right when it runs
		const sorted = [...ops].sort((a, b) => b.at - a.at);
		const replace = this.opsCommand(pageId, sorted);
		const scene = this.host.scene(pageId)!;
		const box = added.reduce<Box | null>((b, i) => union(b, this.kit.bounds(i)), null);
		const command: Command = {
			undo: () => {
				for (const item of added) scene.remove(item);
				if (box) this.host.region(pageId, box);
				replace.undo();
			},
			redo: () => {
				replace.redo();
				for (const item of added) scene.add(item);
				if (box) this.host.region(pageId, box);
			}
		};
		command.redo();
		this.host.push(command);
	}
}
