// The open notebook: page list, page contents (loaded when a page comes into view), undo/redo and saving.
// Saving is debounced and only writes what changed: the file of each changed page, `project.json` when the page
// list changed. Changes from elsewhere (sync, another device) reload a page unless it has unsaved changes.

import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { isInside } from '@in-browser/files/path.js';
import { itemBounds, union, type Box } from '#lib/ink/geometry.js';
import { isIdentity, transformItem, type Transform } from '#lib/ink/lasso.js';
import { inkStrokes, withStyle, type ShapeFit, type ShapeStyle } from '#lib/ink/shapes.js';
import { eraseFromStroke } from '#lib/ink/split.js';
import { m } from '#lib/i18n/index.js';
import { PdfBackgrounds } from '#lib/render/backgrounds.js';
import { PictureCache, pictureKey } from '#lib/render/pictures.js';
import { PageScene } from '#lib/render/scene.js';
import { addAsset, cleanupAssets, deletePageFile, manifestPath, pagePath, readAsset, readNotebook, readPage, writeNotebook, writePage } from './store.js';
import {
	backgroundAssets,
	isInk,
	isPicture,
	isStroke,
	newPage,
	type Ink,
	type InkTool,
	type Item,
	type Notebook,
	type PageMeta,
	type Paper,
	type Picture,
	type ShapeItem,
	type Stroke
} from './types.js';

/** What the drawing surface needs to know */
export interface NotebookListener {
	/** The page list changed (order, size, paper, added/removed) */
	pages(pages: PageMeta[]): void;
	/** A page's content arrived or was replaced */
	content(id: string): void;
	/** A finished stroke or shape was added */
	stroke(id: string, scene: PageScene, stroke: Ink): void;
	/** Items in a region of a page were added, removed, changed or restored */
	region(id: string, box: Box | null): void;
	/** A piece of a PDF page under the notes was rendered */
	background(): void;
}

interface Command {
	undo(): void;
	redo(): void;
}

/** One item replaced by others (none: removed) at its place in the draw order */
interface ReplaceOp {
	removed: Item;
	at: number;
	added: Item[];
}

/** Items taken out of a page while dragged, with their places */
export interface Lifted {
	page: string;
	items: { item: Item; at: number }[];
}

const SAVE_DELAY_MS = 800;
const HISTORY_LIMIT = 300;
/** Own writes come back as change notifications; those within this time are ignored */
const OWN_WRITE_MS = 3000;

export class NotebookDoc {
	path = $state('');
	pages = $state.raw<PageMeta[]>([]);
	saving = $state(false);
	dirty = $state(false);
	canUndo = $state(false);
	canRedo = $state(false);

	private meta: Notebook;
	private readonly scenes = new Map<string, PageScene>();
	private readonly loading = new Map<string, Promise<void>>();
	private readonly dirtyPages = new Set<string>();
	private readonly removedPages = new Set<string>();
	private metaDirty = false;
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private saveTimer: ReturnType<typeof setTimeout> | undefined;
	private readonly ownWrites = new Map<string, number>();
	private erasing: { page: string; ops: ReplaceOp[] } | null = null;
	listener: NotebookListener | null = null;
	/** Decoded images and icons of all pages */
	readonly pictures = new PictureCache(
		(name) => readAsset(this.path, name),
		(key) => this.pictureLoaded(key)
	);
	/** PDF pages under the notes (imported PDFs) */
	readonly backgrounds = new PdfBackgrounds(
		(name) => readAsset(this.path, name),
		() => this.listener?.background()
	);

	constructor(path: string, notebook: Notebook) {
		this.path = path;
		this.meta = notebook;
		this.pages = notebook.pages;
		// PDF.js takes a moment to start: alongside loading the pages, not after
		this.backgrounds.warm(backgroundAssets(notebook));
	}

	static async open(path: string): Promise<NotebookDoc> {
		return new NotebookDoc(path, await readNotebook(path));
	}

	/** Deletes assets no page uses any more (after opening, in the background; the caller holds the lock) */
	async cleanup(): Promise<void> {
		try {
			await cleanupAssets(this.path, this.meta);
		} catch (e) {
			console.error('[notes] cleanup', e);
		}
	}

	// --- Page contents ---

	/** Content of a loaded page, null while it is not loaded */
	scene(id: string): PageScene | null {
		return this.scenes.get(id) ?? null;
	}

	/** Loads a page's content (once) */
	load(id: string): Promise<void> {
		let pending = this.loading.get(id);
		if (!pending) {
			pending = readPage(this.path, id)
				.then((content) => {
					this.scenes.set(id, new PageScene(content, this.pictures));
					this.listener?.content(id);
				})
				.catch((e) => {
					console.error('[notes] page', id, e);
					// Show an empty page instead of retrying forever; the toast says what went wrong
					this.scenes.set(id, new PageScene(undefined, this.pictures));
					this.listener?.content(id);
					toast(m.editor.pageFailed(filesErrorText(e)), 'error', 8000);
				});
			this.loading.set(id, pending);
		}
		return pending;
	}

	/** All pages' contents (e.g. for export) */
	async loadAll(): Promise<void> {
		await Promise.all(this.pages.map((p) => this.load(p.id)));
	}

	// --- Editing ---

	private push(command: Command) {
		this.undoStack.push(command);
		if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
		this.redoStack = [];
		this.updateHistory();
	}

	private updateHistory() {
		this.canUndo = this.undoStack.length > 0;
		this.canRedo = this.redoStack.length > 0;
	}

	undo() {
		const command = this.undoStack.pop();
		if (!command) return;
		command.undo();
		this.redoStack.push(command);
		this.updateHistory();
	}

	redo() {
		const command = this.redoStack.pop();
		if (!command) return;
		command.redo();
		this.undoStack.push(command);
		this.updateHistory();
	}

	/** Adds a finished stroke on top (one undo step); its id */
	addStroke(pageIndex: number, data: { points: Float32Array; tool: InkTool; color: string; size: number }): string | null {
		if (data.points.length < 3) return null;
		return this.addInk(pageIndex, { id: crypto.randomUUID(), ...data });
	}

	/** Adds a shape drawn with the shape tool on top (one undo step); its id */
	addShape(pageIndex: number, fit: ShapeFit, color: string, size: number, style: ShapeStyle): string | null {
		return this.addInk(pageIndex, withStyle({ id: crypto.randomUUID(), type: 'shape', fit, color, size }, style));
	}

	private addInk(pageIndex: number, stroke: Ink): string | null {
		const page = this.pages[pageIndex];
		const scene = page && this.scene(page.id);
		if (!scene) return null;
		const add = (at?: number) => {
			scene.add(stroke, at);
			this.listener?.stroke(page.id, scene, stroke);
			this.touch(page.id);
		};
		add();
		this.push({
			undo: () => {
				const box = scene.bounds(stroke);
				scene.remove(stroke);
				this.listener?.region(page.id, box);
				this.touch(page.id);
			},
			redo: () => add()
		});
		return stroke.id;
	}

	/** Replaces a stroke by a shape (a recognized one, one undo step); the shape's id, null if the stroke is gone */
	toShape(pageIndex: number, strokeId: string, fit: ShapeFit): string | null {
		const page = this.pages[pageIndex];
		const scene = page && this.scene(page.id);
		const stroke = scene?.items.find((i) => i.id === strokeId);
		if (!scene || !stroke || !isStroke(stroke)) return null;
		const shape: ShapeItem = { id: crypto.randomUUID(), type: 'shape', fit, color: stroke.color, size: stroke.size };
		this.applyOps(page.id, [{ removed: stroke, at: scene.items.indexOf(stroke), added: [shape] }]);
		return shape.id;
	}

	/** Removes strokes during an erase gesture; `eraseEnd` makes the gesture one undo step */
	erase(pageIndex: number, strokes: Ink[]) {
		this.replace(pageIndex, strokes.map((stroke) => ({ stroke, pieces: [] })));
	}

	/**
	 * Pixel eraser: cuts the circle (page points) out of the strokes it touches, during an erase gesture. A shape
	 * becomes ordinary strokes then (the pieces of its outline).
	 */
	erasePixels(pageIndex: number, strokes: Ink[], x: number, y: number, r: number) {
		const cuts: { stroke: Ink; pieces: Float32Array[] }[] = [];
		for (const stroke of strokes) {
			// A shape is cut as a whole: touched strokes in pieces, the others (dashes, edges, arrowheads) as they are
			const own = inkStrokes(stroke);
			const cut = own.map((s) => eraseFromStroke(s, x, y, r));
			if (cut.some(Boolean)) cuts.push({ stroke, pieces: cut.flatMap((p, i) => p ?? [own[i].points]) });
		}
		if (cuts.length) this.replace(pageIndex, cuts);
	}

	/** Replaces strokes by pieces of them (none = removed) at their place in the draw order */
	private replace(pageIndex: number, cuts: { stroke: Ink; pieces: Float32Array[] }[]) {
		const page = this.pages[pageIndex];
		const scene = page && this.scene(page.id);
		if (!scene) return;
		if (this.erasing && this.erasing.page !== page.id) this.eraseEnd();
		this.erasing ??= { page: page.id, ops: [] };
		let box: Box | null = null;
		for (const { stroke, pieces } of cuts) {
			const bounds = scene.bounds(stroke);
			const at = scene.remove(stroke);
			if (at < 0) continue;
			const pen = inkStrokes(stroke)[0];
			const added = pieces.map((points): Stroke => ({ id: crypto.randomUUID(), tool: pen.tool, color: pen.color, size: pen.size, points }));
			added.forEach((piece, i) => scene.add(piece, at + i));
			this.erasing.ops.push({ removed: stroke, at, added });
			box = union(box, bounds);
		}
		if (box) {
			this.listener?.region(page.id, box);
			this.touch(page.id);
		}
	}

	eraseEnd() {
		const gesture = this.erasing;
		this.erasing = null;
		if (!gesture || !gesture.ops.length) return;
		this.push(this.opsCommand(gesture.page, gesture.ops));
	}

	/** Undo/redo of replacement steps (each: a stroke removed at `at`, pieces put in its place) */
	private opsCommand(pageId: string, ops: ReplaceOp[]): Command {
		const scene = this.scene(pageId)!;
		// Old and new places together (from the items: a moved one keeps its id, so the index can't tell them apart)
		const region = ops.reduce<Box | null>(
			(box, op) => op.added.reduce<Box | null>((b, s) => union(b, itemBounds(s)), union(box, itemBounds(op.removed))),
			null
		);
		if (!ops.length) return { undo: () => this.touch(pageId), redo: () => this.touch(pageId) };
		return {
			undo: () => {
				for (let i = ops.length - 1; i >= 0; i--) {
					const op = ops[i];
					for (const piece of op.added) scene.remove(piece);
					scene.add(op.removed, op.at);
				}
				this.listener?.region(pageId, region);
				this.touch(pageId);
			},
			redo: () => {
				for (const op of ops) {
					scene.remove(op.removed);
					op.added.forEach((piece, i) => scene.add(piece, op.at + i));
				}
				this.listener?.region(pageId, region);
				this.touch(pageId);
			}
		};
	}

	// --- Pictures ---

	/** Content of an asset file (exports) */
	readAsset(name: string): Promise<Blob> {
		return readAsset(this.path, name);
	}

	/** Stores an image file in the notebook's assets; its asset name */
	async addAsset(blob: Blob, ext: string): Promise<string> {
		return addAsset(this.path, blob, ext);
	}

	/** Puts a picture on top of a page (one undo step) */
	addPicture(pageIndex: number, picture: Picture) {
		const page = this.pages[pageIndex];
		const scene = page && this.scene(page.id);
		if (!scene) return;
		this.applyOps(page.id, [], [picture]);
	}

	/** A picture finished loading: redraw it wherever it is shown */
	private pictureLoaded(key: string) {
		for (const [id, scene] of this.scenes) {
			const box = scene.items.reduce<Box | null>((b, i) => (isPicture(i) && pictureKey(i) === key ? union(b, scene.bounds(i)) : b), null);
			if (box) this.listener?.region(id, box);
		}
	}

	// --- Selection ---

	/** Items of a page by id, in draw order */
	itemsById(pageIndex: number, ids: ReadonlySet<string>): Item[] {
		const scene = this.scene(this.pages[pageIndex]?.id ?? '');
		return scene ? scene.items.filter((s) => ids.has(s.id)) : [];
	}

	/** Takes items out of the page while they are dragged (drawn by the stage meanwhile) */
	lift(pageIndex: number, ids: ReadonlySet<string>): Lifted | null {
		const page = this.pages[pageIndex];
		const scene = page && this.scene(page.id);
		if (!scene) return null;
		const items: { item: Item; at: number }[] = [];
		let box: Box | null = null;
		// From the back, so the recorded places stay valid when put back from the front
		for (let i = scene.items.length - 1; i >= 0; i--) {
			const item = scene.items[i];
			if (!ids.has(item.id)) continue;
			box = union(box, scene.bounds(item));
			scene.remove(item);
			items.unshift({ item, at: i });
		}
		if (box) this.listener?.region(page.id, box);
		return { page: page.id, items };
	}

	/** Puts lifted items back, moved/scaled (one undo step); unchanged when the transform is none */
	drop(lifted: Lifted, t: Transform) {
		this.putBack(lifted, (item) => transformItem(item, t), isIdentity(t));
	}

	/** Puts a single lifted item back as `changed` (a shape with moved points; one undo step) */
	reshape(lifted: Lifted, changed: Item) {
		this.putBack(lifted, () => changed, false);
	}

	private putBack(lifted: Lifted, change: (item: Item) => Item, unchanged: boolean) {
		const scene = this.scene(lifted.page);
		if (!scene) return;
		const ops: ReplaceOp[] = lifted.items.map(({ item, at }) => ({ removed: item, at, added: [change(item)] }));
		for (const { item, at } of lifted.items) scene.add(item, at);
		if (unchanged) {
			this.listener?.region(lifted.page, ops.reduce<Box | null>((b, op) => union(b, itemBounds(op.removed)), null));
			return;
		}
		const command = this.opsCommand(lifted.page, ops);
		command.redo();
		this.push(command);
	}

	/** Deletes items (one undo step) */
	deleteItems(pageIndex: number, ids: ReadonlySet<string>) {
		const page = this.pages[pageIndex];
		if (!page) return;
		const scene = this.scene(page.id)!;
		this.applyOps(page.id, this.itemsById(pageIndex, ids).map((item) => ({ removed: item, at: scene.items.indexOf(item), added: [] })));
	}

	/** Gives strokes, shapes and icons another color (one undo step); images stay as they are */
	recolor(pageIndex: number, ids: ReadonlySet<string>, color: string) {
		this.change(pageIndex, ids, (item) => (isInk(item) || item.type === 'icon' ? { ...item, color } : null));
	}

	/** Changes items (one undo step): `change` gives the new version of an item, or null to leave it */
	change(pageIndex: number, ids: ReadonlySet<string>, change: (item: Item) => Item | null) {
		const page = this.pages[pageIndex];
		if (!page) return;
		const scene = this.scene(page.id)!;
		const ops = this.itemsById(pageIndex, ids).flatMap((item) => {
			const changed = change(item);
			return changed ? [{ removed: item, at: scene.items.indexOf(item), added: [changed] }] : [];
		});
		this.applyOps(page.id, ops);
	}

	/** Copies items a little offset, on top; the ids of the copies */
	duplicate(pageIndex: number, ids: ReadonlySet<string>): Set<string> {
		const page = this.pages[pageIndex];
		if (!page || !this.scene(page.id)) return new Set();
		const copies = this.itemsById(pageIndex, ids).map((s) => transformItem({ ...s, id: crypto.randomUUID() }, { dx: 12, dy: 12, scale: 1, ox: 0, oy: 0 }));
		this.applyOps(page.id, [], copies);
		return new Set(copies.map((c) => c.id));
	}

	/**
	 * Runs replacement steps and puts new items on top, as one undo step (indices are those before the steps).
	 */
	private applyOps(pageId: string, ops: ReplaceOp[], added: Item[] = []) {
		if (!ops.length && !added.length) return;
		// Back to front, so each step's index is still right when it runs
		const sorted = [...ops].sort((a, b) => b.at - a.at);
		const replace = this.opsCommand(pageId, sorted);
		const scene = this.scene(pageId)!;
		const box = added.reduce<Box | null>((b, i) => union(b, itemBounds(i)), null);
		const command: Command = {
			undo: () => {
				for (const item of added) scene.remove(item);
				if (box) this.listener?.region(pageId, box);
				replace.undo();
			},
			redo: () => {
				replace.redo();
				for (const item of added) scene.add(item);
				if (box) this.listener?.region(pageId, box);
			}
		};
		command.redo();
		this.push(command);
	}

	// --- Pages ---

	private setPages(pages: PageMeta[]) {
		this.pages = pages;
		this.metaDirty = true;
		this.listener?.pages(pages);
		this.schedule();
	}

	/** Inserts a new page after `index` (same size and paper); its index */
	addPage(index: number, paper?: Paper): number {
		const like = this.pages[index] ?? this.pages[this.pages.length - 1];
		const page = newPage(paper ?? like?.paper ?? 'lined', like ?? undefined);
		const at = Math.min(index + 1, this.pages.length);
		this.scenes.set(page.id, new PageScene(undefined, this.pictures));
		const insert = () => {
			this.removedPages.delete(page.id);
			this.setPages(this.pages.toSpliced(at, 0, page));
		};
		insert();
		this.push({ undo: () => this.dropPage(page.id), redo: insert });
		return at;
	}

	/** Inserts the pages of a PDF (already in the assets) after `index`, one undo step; the index of the first */
	insertPdf(index: number, asset: string, sizes: { w: number; h: number }[]): number {
		const pages = sizes.map((size, i): PageMeta => ({ ...newPage('blank', size), background: { asset, page: i + 1 } }));
		const at = Math.min(index + 1, this.pages.length);
		for (const page of pages) this.scenes.set(page.id, new PageScene(undefined, this.pictures));
		const ids = new Set(pages.map((p) => p.id));
		const insert = () => {
			for (const id of ids) this.removedPages.delete(id);
			this.setPages(this.pages.toSpliced(at, 0, ...pages));
		};
		insert();
		this.push({
			undo: () => {
				for (const id of ids) {
					this.removedPages.add(id);
					this.dirtyPages.delete(id);
				}
				this.setPages(this.pages.filter((p) => !ids.has(p.id)));
			},
			redo: insert
		});
		return at;
	}

	/** Removes a page from the list; its file is deleted on the next save (undo puts it back before that) */
	deletePage(index: number) {
		const page = this.pages[index];
		if (!page || this.pages.length <= 1) return;
		this.load(page.id);
		this.dropPage(page.id);
		this.push({
			undo: () => {
				this.removedPages.delete(page.id);
				// Its file may already be gone: write it again
				if (this.scenes.has(page.id)) this.dirtyPages.add(page.id);
				this.setPages(this.pages.toSpliced(index, 0, page));
			},
			redo: () => this.dropPage(page.id)
		});
	}

	private dropPage(id: string) {
		this.removedPages.add(id);
		this.dirtyPages.delete(id);
		this.setPages(this.pages.filter((p) => p.id !== id));
	}

	movePage(from: number, to: number) {
		if (from === to || to < 0 || to >= this.pages.length) return;
		const move = (a: number, b: number) => {
			const pages = [...this.pages];
			const [page] = pages.splice(a, 1);
			pages.splice(b, 0, page);
			this.setPages(pages);
		};
		move(from, to);
		this.push({ undo: () => move(to, from), redo: () => move(from, to) });
	}

	/** Gives a page another size (content stays where it is, measured from the top left) */
	setSize(index: number, size: { w: number; h: number }) {
		const page = this.pages[index];
		if (!page || page.background || (page.w === size.w && page.h === size.h)) return;
		const before = { w: page.w, h: page.h };
		const set = (s: { w: number; h: number }) => this.setPages(this.pages.map((x) => (x.id === page.id ? { ...x, ...s } : x)));
		set(size);
		this.push({ undo: () => set(before), redo: () => set(size) });
	}

	setPaper(index: number, paper: Paper) {
		const page = this.pages[index];
		if (!page || page.paper === paper) return;
		const before = page.paper;
		const set = (p: Paper) => this.setPages(this.pages.map((x) => (x.id === page.id ? { ...x, paper: p } : x)));
		set(paper);
		this.push({ undo: () => set(before), redo: () => set(paper) });
	}

	// --- Saving ---

	private touch(id: string) {
		this.dirtyPages.add(id);
		this.schedule();
	}

	private schedule() {
		this.dirty = true;
		clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY_MS);
	}

	private own(path: string) {
		this.ownWrites.set(path, performance.now());
	}

	async save(): Promise<void> {
		clearTimeout(this.saveTimer);
		if (this.saving) {
			// Another save is running: try again right after it
			this.schedule();
			return;
		}
		const pages = [...this.dirtyPages];
		const removed = [...this.removedPages];
		const meta = this.metaDirty;
		this.dirtyPages.clear();
		this.removedPages.clear();
		this.metaDirty = false;
		if (!pages.length && !removed.length && !meta) {
			this.dirty = false;
			return;
		}
		this.saving = true;
		try {
			for (const id of pages) {
				const scene = this.scenes.get(id);
				if (!scene) continue;
				this.own(pagePath(this.path, id));
				await writePage(this.path, id, { items: scene.items });
			}
			for (const id of removed) {
				this.own(pagePath(this.path, id));
				await deletePageFile(this.path, id);
			}
			if (meta || pages.length) {
				this.meta = { ...this.meta, pages: this.pages, updatedAt: Date.now() };
				this.own(manifestPath(this.path));
				await writeNotebook(this.path, this.meta);
			}
			this.dirty = this.dirtyPages.size > 0 || this.removedPages.size > 0 || this.metaDirty;
		} catch (e) {
			// Keep the changes for the next attempt
			for (const id of pages) this.dirtyPages.add(id);
			for (const id of removed) this.removedPages.add(id);
			this.metaDirty ||= meta;
			console.error('[notes] save', e);
			toast(m.editor.saveFailed(filesErrorText(e)), 'error', 8000);
		} finally {
			this.saving = false;
		}
	}

	/** Saves right away if something is waiting (closing the tab, leaving) */
	flush() {
		if (this.dirty) void this.save();
	}

	destroy() {
		clearTimeout(this.saveTimer);
		this.listener = null;
		this.pictures.destroy();
		this.backgrounds.destroy();
	}

	// --- Changes from elsewhere ---

	/** Paths changed somewhere (watch of the file system): reload what is not ours and not edited here */
	async external(paths: string[]) {
		const now = performance.now();
		for (const path of paths) {
			if (!isInside(path, this.path) || path === this.path) continue;
			const own = this.ownWrites.get(path);
			if (own !== undefined && now - own < OWN_WRITE_MS) continue;
			if (path === manifestPath(this.path)) await this.reloadMeta();
			else {
				const page = this.pages.find((p) => pagePath(this.path, p.id) === path);
				if (page) await this.reloadPage(page.id);
			}
		}
	}

	private async reloadMeta() {
		if (this.metaDirty) return toast(m.editor.changedElsewhere, 'warning', 8000);
		try {
			const meta = await readNotebook(this.path);
			this.meta = meta;
			this.pages = meta.pages;
			this.listener?.pages(meta.pages);
		} catch (e) {
			console.error('[notes] reload', e);
		}
	}

	private async reloadPage(id: string) {
		if (!this.scenes.has(id)) return;
		if (this.dirtyPages.has(id)) return toast(m.editor.changedElsewhere, 'warning', 8000);
		try {
			this.scenes.set(id, new PageScene(await readPage(this.path, id), this.pictures));
			// Undo steps of this page point to strokes that are gone now
			this.undoStack = [];
			this.redoStack = [];
			this.updateHistory();
			this.listener?.content(id);
		} catch (e) {
			console.error('[notes] reload page', e);
		}
	}
}
