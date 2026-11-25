// What the editor page, its ribbon commands and its side panels share: the open PDF, the surface, where the view is.

import { walk } from './outline.js';
import type { BookmarkCommands } from './bookmark-commands.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
import { findAll, type SearchHit } from '@in-browser/pdf/text.js';
import type { PdfDocument } from './document.svelte.js';
import { pdfKit } from '#lib/render/markup.js';
import { MAX_STEP } from '#lib/render/steps.js';
import type { PdfSelection, PdfStage, PdfSuggestion } from '#lib/render/surface.js';
import { choose } from './tools.svelte.js';

/** Zoom steps of "Zoom in"/"Zoom out" (and Ctrl+/Ctrl−) */
const ZOOM_STEP = 1.25;

export class EditorState {
	doc = $state.raw<PdfDocument | null>(null);
	stage = $state.raw<PdfStage | null>(null);
	/** What the select tool picked, and the offer to turn a stroke into a shape */
	selection = $state.raw<PdfSelection | null>(null);
	suggestion = $state.raw<PdfSuggestion | null>(null);
	/** The text box being typed into (selected) */
	textEdit = $state<string | null>(null);
	/** The note whose comment is being written (selected) */
	noteEdit = $state<string | null>(null);
	/** The word stamp whose text is being written (selected) */
	stampEdit = $state<string | null>(null);
	/** The link whose target is being set (selected) */
	linkEdit = $state<string | null>(null);
	/** Index of the page in the middle of the view */
	current = $state(0);
	/** Pages picked in the panel "Pages" (ids); page commands act on them, else on the current page */
	readonly pagePick = new Picker<string>();

	/** Picks every page */
	pickAllPages() {
		this.pagePick.selectAll((this.doc?.pages ?? []).map((p) => p.id));
	}

	/** Clears the picked pages and leaves the selection mode */
	clearPagePick() {
		this.pagePick.clear();
	}

	/** Shows a form field's widget and focuses it (set when the surface is ready) */
	showField: (widget: string) => void = () => {};

	/** The page commands as menu entries (set by the editor page; the panel "Pages" shows them) */
	pageMenu: () => MenuEntry[] = () => [];

	/** The pages page commands act on (ids, in their order): the picked ones still there, else the current page */
	pagesToChange(): string[] {
		const pages = this.doc?.pages ?? [];
		const picked = pages.filter((p) => this.pagePick.has(p.id)).map((p) => p.id);
		if (picked.length) return picked;
		const current = pages[this.current];
		return current ? [current.id] : [];
	}
	/** Bookmarks picked in their panel (ids), the current one (the bookmark commands act on the picked ones, else on
	 * it) and the one whose name is being typed (`fresh`: just added – its name belongs to that step) */
	readonly bookmarkPick = new Picker<string>();
	bookmarkCurrent = $state<string | null>(null);
	bookmarkRename = $state<{ id: string; fresh: boolean } | null>(null);
	/** The bookmark commands (set by the editor page; the panel uses them for its menu and keys) */
	bookmarkCommands: BookmarkCommands | null = null;

	/** The bookmarks the commands act on: the picked ones still there, else the current one */
	bookmarksToChange(): Set<string> {
		const all = new Set([...walk(this.doc?.bookmarks ?? [])].map((w) => w.bookmark.id));
		const picked = [...this.bookmarkPick.selected].filter((id) => all.has(id));
		if (picked.length) return new Set(picked);
		return this.bookmarkCurrent && all.has(this.bookmarkCurrent) ? new Set([this.bookmarkCurrent]) : new Set();
	}

	zoom = $state(1);
	/** The open side panel */
	panel = $state<string | null>(null);
	/** Search: what is looked for, its hits and the one shown */
	search = $state({ query: '', matchCase: false, busy: false });
	hits = $state.raw<SearchHit[]>([]);
	hit = $state(-1);

	get currentHit(): SearchHit | null {
		return this.hits[this.hit] ?? null;
	}

	/** Finds the query in the whole PDF and shows the first hit from the current page on */
	async find() {
		const doc = this.doc;
		const { query, matchCase } = this.search;
		if (!doc || !query.trim()) {
			this.hits = [];
			this.hit = -1;
			return;
		}
		this.search.busy = true;
		try {
			const texts = await doc.texts();
			if (this.doc !== doc || this.search.query !== query || this.search.matchCase !== matchCase) return;
			this.hits = findAll(texts, query, matchCase);
			const next = this.hits.findIndex((h) => h.page >= this.current);
			this.showHit(next >= 0 ? next : 0);
		} finally {
			this.search.busy = false;
		}
	}

	/** The pages changed (rotated): the hits are looked for again where they are now, the view stays */
	async refind() {
		const doc = this.doc;
		const { query, matchCase } = this.search;
		if (!doc || !query.trim()) return;
		const texts = await doc.texts();
		if (this.doc !== doc || this.search.query !== query || this.search.matchCase !== matchCase) return;
		const hits = findAll(texts, query, matchCase);
		this.hit = hits.length ? Math.min(Math.max(this.hit, 0), hits.length - 1) : -1;
		this.hits = hits;
	}

	/** Shows hit `i` (wraps around) */
	showHit(i: number) {
		if (!this.hits.length) {
			this.hit = -1;
			return;
		}
		this.hit = ((i % this.hits.length) + this.hits.length) % this.hits.length;
		const hit = this.hits[this.hit];
		const top = Math.min(...hit.boxes.map((b) => b.y0));
		const stage = this.stage;
		// A third down the window, so the hit has context above it
		this.goTo(hit.page, Math.max(0, top - (stage ? stage.view.height / stage.view.zoom / 3 : 0)));
	}

	/** The view moved or zoomed */
	updateView() {
		const stage = this.stage;
		if (!stage) return;
		this.current = Math.min(stage.currentPage(), Math.max(0, stage.pages.length - 1));
		this.zoom = stage.view.zoom;
	}

	/** Shows a comment and selects it (with "Select"), a little room above it */
	showItem(index: number, id: string) {
		const item = this.doc?.scene(this.doc.pages[index]?.id ?? '')?.items.find((i) => i.id === id);
		if (!item) return;
		this.goTo(index, Math.max(0, pdfKit.bounds(item).y0 - 40));
		choose('lasso');
		this.selection?.select(index, new Set([id]));
	}

	/** Steps asked for with “Another step” (page id → how many the page has in the editor): a step exists in the file
	 * only once something comes or goes at it, so one after the last change is the editor's until it is used */
	private wantedSteps = $state<Record<string, number>>({});

	/** The steps of a page as the editor lists them: up to its last change, and those added after it */
	stepsOf(index: number): number {
		const id = this.doc?.pages[index]?.id ?? '';
		return Math.min(MAX_STEP, Math.max(this.doc?.stepsOf(id) ?? 0, this.wantedSteps[id] ?? 0));
	}

	private wantSteps(index: number, steps: number) {
		const id = this.doc?.pages[index]?.id;
		if (id) this.wantedSteps[id] = Math.max(0, Math.min(MAX_STEP, steps));
	}

	/** Another step after the last one of a page */
	addStep(index: number) {
		this.wantSteps(index, this.stepsOf(index) + 1);
	}

	/** Deletes, inserts before or moves a step of a page (`PdfDocument.removeStep` …), also one nothing changes at yet */
	removeStep(index: number, step: number) {
		const steps = this.stepsOf(index);
		this.doc?.removeStep(index, step, steps);
		this.wantSteps(index, steps - 1);
	}

	insertStep(index: number, step: number) {
		const steps = this.stepsOf(index);
		if (steps >= MAX_STEP) return;
		this.doc?.insertStep(index, step, steps);
		this.wantSteps(index, steps + 1);
	}

	moveStep(index: number, from: number, to: number) {
		const steps = this.stepsOf(index);
		this.doc?.moveStep(index, from, to, steps);
		this.wantSteps(index, steps);
	}

	/** Selects comments of a page (with "Select") */
	selectItems(index: number, ids: ReadonlySet<string>) {
		choose('lasso');
		this.selection?.select(index, new Set(ids));
	}

	/** Shows a page (index), optionally scrolled to `y` page points from its top */
	goTo(index: number, y = 0) {
		const stage = this.stage;
		if (!stage || index < 0 || index >= stage.pages.length) return;
		stage.scrollToPage(index, y);
	}

	get pageCount(): number {
		return this.doc?.pages.length ?? 0;
	}

	zoomIn() {
		this.stage?.setZoom(this.zoom * ZOOM_STEP);
	}

	zoomOut() {
		this.stage?.setZoom(this.zoom / ZOOM_STEP);
	}

	fitWidth() {
		this.stage?.fitWidth();
	}

	/** The whole current page in the window */
	fitPage() {
		const stage = this.stage;
		const page = stage?.pages[this.current];
		if (!stage || !page) return;
		const margin = 32;
		stage.setZoom(Math.min((stage.view.width - margin) / page.w, (stage.view.height - margin) / page.h));
		stage.scrollToPage(this.current);
	}

	actualSize() {
		this.stage?.setZoom(1);
	}
}
