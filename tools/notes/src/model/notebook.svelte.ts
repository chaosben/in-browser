// The open notebook: page list, page contents (loaded when a page comes into view), undo/redo and saving.
// Saving is debounced and only writes what changed: the file of each changed page, `project.json` when the page
// list changed. Changes from elsewhere (sync, another device) reload a page unless it has unsaved changes.

import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { ExternalVersions, reportSaveFailure } from '@in-browser/files/documents.js';
import { stat } from '@in-browser/files/fs.js';
import { basename, isInside, stem } from '@in-browser/files/path.js';
import { ItemEditor, type Command } from '@in-browser/ink/edit/items.js';
import { union, type Box } from '@in-browser/ink/geometry.js';
import { inkKit } from '@in-browser/ink/render/ink-kit.js';
import { m } from '#lib/i18n/index.js';
import { PdfPages } from '@in-browser/pdf/pages.js';
import { PictureCache, pictureKey } from '@in-browser/ink/render/pictures.js';
import type { PageScene } from '@in-browser/ink/render/scene.js';
import { pageScene } from '#lib/render/surface.js';
import { addAsset, cleanupAssets, deletePageFile, manifestPath, pagePath, readAsset, readNotebook, readPage, writeNotebook, writePage } from './store.js';
import { backgroundAssets, isPicture, newPage, type Item, type Notebook, type PageMeta, type Paper } from './types.js';

/** What the drawing surface needs to know */
export interface NotebookListener {
	/** The page list changed (order, size, paper, added/removed) */
	pages(pages: PageMeta[]): void;
	/** A page's content arrived or was replaced */
	content(id: string): void;
	/** A finished stroke or shape was added */
	stroke(id: string, scene: PageScene<Item>, stroke: Item): void;
	/** Items in a region of a page were added, removed, changed or restored */
	region(id: string, box: Box | null): void;
	/** A piece of a PDF page under the notes was rendered */
	background(): void;
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
	/** The last save failed (e.g. a connected folder without access); shown until a save works */
	saveError = $state<string | null>(null);
	canUndo = $state(false);
	canRedo = $state(false);

	private meta: Notebook;
	private readonly scenes = new Map<string, PageScene<Item>>();
	private readonly loading = new Map<string, Promise<void>>();
	private readonly dirtyPages = new Set<string>();
	private readonly removedPages = new Set<string>();
	private metaDirty = false;
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private saveTimer: ReturnType<typeof setTimeout> | undefined;
	private readonly ownWrites = new Map<string, number>();
	listener: NotebookListener | null = null;
	/** Editing the items of the pages (`@in-browser/ink`: each action one undo step of this notebook) */
	readonly items: ItemEditor<Item>;
	/** Decoded images and icons of all pages */
	readonly pictures = new PictureCache(
		(name) => readAsset(this.path, name),
		(key) => this.pictureLoaded(key)
	);
	/** PDF pages under the notes (imported PDFs) */
	readonly backgrounds = new PdfPages(
		(name) => readAsset(this.path, name),
		() => this.listener?.background(),
		{ label: '[notes]' }
	);

	constructor(path: string, notebook: Notebook) {
		const doc = this;
		this.items = new ItemEditor<Item>(
			{
				get pages() {
					return doc.pages;
				},
				scene: (id) => this.scene(id),
				push: (command) => this.push(command),
				touch: (id) => this.touch(id),
				committed: (id, scene, item) => this.listener?.stroke(id, scene, item),
				region: (id, box) => this.listener?.region(id, box)
			},
			inkKit
		);
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
	scene(id: string): PageScene<Item> | null {
		return this.scenes.get(id) ?? null;
	}

	/** Loads a page's content (once) */
	load(id: string): Promise<void> {
		let pending = this.loading.get(id);
		if (!pending) {
			pending = readPage(this.path, id)
				.then((content) => {
					this.scenes.set(id, pageScene(content, this.pictures));
					this.listener?.content(id);
				})
				.catch((e) => {
					console.error('[notes] page', id, e);
					// Show an empty page instead of retrying forever; the toast says what went wrong
					this.scenes.set(id, pageScene(undefined, this.pictures));
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

	// --- Pictures ---

	/** Content of an asset file (exports) */
	readAsset(name: string): Promise<Blob> {
		return readAsset(this.path, name);
	}

	/** Stores an image file in the notebook's assets; its asset name */
	async addAsset(blob: Blob, ext: string): Promise<string> {
		return addAsset(this.path, blob, ext);
	}

	/** A picture finished loading: redraw it wherever it is shown */
	private pictureLoaded(key: string) {
		for (const [id, scene] of this.scenes) {
			const box = scene.items.reduce<Box | null>((b, i) => (isPicture(i) && pictureKey(i) === key ? union(b, scene.bounds(i)) : b), null);
			if (box) this.listener?.region(id, box);
		}
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
		this.scenes.set(page.id, pageScene(undefined, this.pictures));
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
		for (const page of pages) this.scenes.set(page.id, pageScene(undefined, this.pictures));
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

	/** Removes a page from the list; its file is deleted on the next save (undo puts it back before that). Returns
	 * what the message's "Undo" does: undo this step while it is still the last one */
	deletePage(index: number): (() => void) | null {
		const page = this.pages[index];
		if (!page || this.pages.length <= 1) return null;
		this.load(page.id);
		this.dropPage(page.id);
		const command: Command = {
			undo: () => {
				this.removedPages.delete(page.id);
				// Its file may already be gone: write it again
				if (this.scenes.has(page.id)) this.dirtyPages.add(page.id);
				this.setPages(this.pages.toSpliced(index, 0, page));
			},
			redo: () => this.dropPage(page.id)
		};
		this.push(command);
		return () => {
			if (this.undoStack.at(-1) === command) this.undo();
		};
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
			this.saveError = null;
		} catch (e) {
			// Keep the changes for the next attempt
			for (const id of pages) this.dirtyPages.add(id);
			for (const id of removed) this.removedPages.add(id);
			this.metaDirty ||= meta;
			console.error('[notes] save', e);
			reportSaveFailure(this, e, () => void this.save());
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
	/** Whether versions of its files saved elsewhere are taken (asked, the answer kept while it is open) */
	private readonly versions = new ExternalVersions();

	async external(paths: string[]) {
		const now = performance.now();
		let meta = false;
		const pages: string[] = [];
		for (const path of paths) {
			if (!isInside(path, this.path) || path === this.path) continue;
			const own = this.ownWrites.get(path);
			if (own !== undefined && now - own < OWN_WRITE_MS) continue;
			if (path === manifestPath(this.path)) meta = true;
			else {
				const page = this.pages.find((p) => pagePath(this.path, p.id) === path);
				if (page && this.scenes.has(page.id)) pages.push(page.id);
			}
		}
		// Changed here too: ours are kept (written over the other version)
		const mine = (meta && this.metaDirty) || pages.some((id) => this.dirtyPages.has(id));
		if (mine) toast(m.editor.changedElsewhere, 'warning', 8000);
		meta &&= !this.metaDirty;
		const theirs = pages.filter((id) => !this.dirtyPages.has(id));
		if (!meta && !theirs.length) return;
		// Asked first (once per version of these files; the answer may be kept while the notebook is open)
		const files = [...(meta ? [manifestPath(this.path)] : []), ...theirs.map((id) => pagePath(this.path, id))];
		const version = (await Promise.all(files.map(async (f) => `${f}:${(await stat(f).catch(() => null))?.modified ?? 0}`))).join('|');
		if (!(await this.versions.shouldReload(stem(basename(this.path)), version))) return;
		if (meta) await this.reloadMeta();
		for (const id of theirs) await this.reloadPage(id);
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
			this.scenes.set(id, pageScene(await readPage(this.path, id), this.pictures));
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
