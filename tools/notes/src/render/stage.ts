// The drawing surface. Stacked canvases:
// - base: the visible pages, composed from cached tiles each frame (cheap copies, never stroke rendering)
// - live: a pen stroke being drawn, painted segment by segment right in the input event. Low-latency canvas
//   (`desynchronized`), which is opaque on many devices (no alpha – a transparent one shows black): so it starts as
//   a copy of `base`, is only shown while drawing and hidden once the stroke is in the tiles
// - marker: a highlighter stroke (transparent, normal canvas; painted opaque, opacity + multiply on the layer)
// - ghost: predicted points, cleared every frame
// - overlay: lasso loop, selection frame (with the points of a selected shape) and the selection while it is
//   dragged, laser pointer (redrawn per frame)
// Everything here is plain objects and numbers – no Svelte reactivity on the hot path.

import { debug } from '@in-browser/brand/debug.js';
import { PointBuffer } from '#lib/ink/buffer.js';
import { Smoother } from '#lib/ink/smooth.js';
import { hitsStroke, intersects, type Box } from '#lib/ink/geometry.js';
import { diameter, inkAlpha } from '#lib/ink/outline.js';
import { pointInPolygon, type Transform } from '#lib/ink/lasso.js';
import { fillOutline, inkStrokes } from '#lib/ink/shapes.js';
import { pageTargets } from '#lib/ink/align.js';
import type { Guides, Rect, SnapTargets } from '@in-browser/graphics/snap.js';
import { isInk, isShape, type Ink, type InkTool, type Item, type PageMeta } from '#lib/model/types.js';
import type { PdfBackgrounds } from './backgrounds.js';
import { PAPER_COLOR } from './paper.js';
import { drawGuides, drawLaser, drawLasso, drawLifted, drawSelectionFrame, type LaserPoint } from './overlay.js';
import type { PageScene } from './scene.js';
import { TILE, TileCache, tileRange, type Tile, type TilePage } from './tiles.js';
import { layoutPages, Viewport, type PageRect } from './viewport.js';

export interface StageElements {
	root: HTMLElement;
	base: HTMLCanvasElement;
	live: HTMLCanvasElement;
	marker: HTMLCanvasElement;
	overlay: HTMLCanvasElement;
	ghost: HTMLCanvasElement;
	cursor: HTMLElement;
}

interface LiveStroke {
	page: number;
	rect: PageRect;
	tool: InkTool;
	color: string;
	size: number;
	buf: PointBuffer;
	/** Last point in screen pixels (CSS) */
	sx: number;
	sy: number;
	/** Replaced by a shape: no catching up with the pen at the end */
	shaped: boolean;
}

/** A selection: items of one page, their bounds (page points) and how they are being moved/scaled */
export interface StageSelection {
	page: number;
	box: Box;
	t: Transform;
	/** Items taken out of the page while dragged (drawn here instead) */
	lifted: Item[] | null;
	/** Points of a single selected shape that can be dragged (page points), instead of the corner handles */
	handles: [number, number][] | null;
}

/** Corner handles scale the selection, `{ point }` moves a point of a shape (index into `handles`) */
export type SelectionHandle = 'move' | 'nw' | 'ne' | 'se' | 'sw' | { point: number };

/** Lines and equal gaps snapped to while dragging; `boxes`: the targets' boxes (`SnapLine.box` indexes them) */
export interface StageGuides {
	page: number;
	guides: Guides;
	boxes: Rect[];
}

/** Ink trail drawn by the operating system ahead of the page (Chromium) – see `navigator.ink` */
interface InkPresenter {
	updateInkTrailStartPoint(event: PointerEvent, style: { color: string; diameter: number }): void;
}

export interface StageStats {
	/** Average time to compose a frame (ms) */
	frame: number;
	/** Average time from an input event to its pixels being drawn (ms) */
	latency: number;
	/** Input points per second of the current/last stroke */
	rate: number;
	tiles: number;
}

const SETTLE_MS = 160;

export class Stage {
	readonly view = new Viewport();
	readonly tiles = new TileCache();
	dpr = 1;
	pages: PageMeta[] = [];
	rects: PageRect[] = [];
	docWidth = 1;
	docHeight = 1;
	/** Scale of the tiles in use (device pixels per point); follows the zoom once it settles */
	private scale = 1;
	private settleTimer: ReturnType<typeof setTimeout> | undefined;
	private raf = 0;
	private clearLiveOnFrame = false;
	/** PDF pieces arrived: tiles with a preview are waiting to be rendered sharp */
	private upgrade = false;
	private live: LiveStroke | null = null;
	private readonly buf = new PointBuffer();
	private readonly smoother = new Smoother();
	/** Reused output of the smoother (no allocation per point) */
	private readonly smoothed = { x: 0, y: 0 };
	/** Last pen position (page points), where the smoothed line catches up at the end */
	private penX = 0;
	private penY = 0;
	private penP = 0.5;
	private presenter: InkPresenter | null = null;
	private desk = '#e5e7eb';
	private shadow = 'rgba(0,0,0,0.12)';
	private readonly baseCtx: CanvasRenderingContext2D;
	private readonly liveCtx: CanvasRenderingContext2D;
	private readonly markerCtx: CanvasRenderingContext2D;
	private readonly overlayCtx: CanvasRenderingContext2D;
	private selectionColor = '#3b82f6';
	private guideColor = '#4f46e5';
	private guideText = '#ffffff';
	/** Guides of the running drag (page points of `page`), with the boxes they come from */
	private guides: StageGuides | null = null;
	/** Lasso loop being drawn (screen pixels, x/y pairs) */
	private lasso: number[] | null = null;
	selection: StageSelection | null = null;
	/** Outlines of dragged strokes (computed once per lift) */
	private readonly liftedPaths = new WeakMap<Ink, Path2D>();
	/** Laser trail: document points with time */
	private laser: LaserPoint[] = [];
	private readonly ghostCtx: CanvasRenderingContext2D;
	/** Context the current stroke is painted on (live or marker) */
	private inkCtx: CanvasRenderingContext2D;
	private originX = 0;
	private originY = 0;
	private statsAcc = { frames: 0, frameMs: 0, events: 0, latencyMs: 0, points: 0, start: 0, last: 0 };
	/** Measurements of the current stroke (for the debug log after it) */
	private strokeAcc = { events: 0, latencyMs: 0, latencyMax: 0, frames: 0, frameMs: 0 };
	readonly stats: StageStats = { frame: 0, latency: 0, rate: 0, tiles: 0 };
	/** Called (at most once per frame) when the view moved or zoomed */
	onview: (() => void) | null = null;

	constructor(
		private readonly el: StageElements,
		/** Content of a page; null while it loads (the stage asks for it via `load`) */
		private readonly sceneOf: (id: string) => PageScene | null,
		private readonly load: (id: string) => void,
		/** PDF pages under the notes */
		private readonly backgrounds: PdfBackgrounds | null = null
	) {
		this.baseCtx = el.base.getContext('2d', { alpha: false })!;
		// Low-latency path where supported (Chromium, Safari; ignored elsewhere) – opaque, see above
		this.liveCtx = el.live.getContext('2d', { desynchronized: true, alpha: false } as CanvasRenderingContext2DSettings)!;
		this.markerCtx = el.marker.getContext('2d')!;
		this.overlayCtx = el.overlay.getContext('2d')!;
		this.ghostCtx = el.ghost.getContext('2d')!;
		this.inkCtx = this.liveCtx;
		const ink = (navigator as Navigator & { ink?: { requestPresenter(o: object): Promise<InkPresenter> } }).ink;
		ink?.requestPresenter({ presentationArea: el.live })
			.then((p) => (this.presenter = p))
			.catch(() => {})
			.finally(() => {
				const attrs = this.liveCtx.getContextAttributes?.() as { desynchronized?: boolean } | undefined;
				debug(
					`[notes] surface: pointerrawupdate ${'onpointerrawupdate' in window}, desynchronized ${attrs?.desynchronized ?? '?'},` +
						` ink presenter ${!!this.presenter}, predicted events ${'getPredictedEvents' in PointerEvent.prototype}`
				);
			});
	}

	destroy() {
		cancelAnimationFrame(this.raf);
		clearTimeout(this.settleTimer);
		this.tiles.clear();
	}

	// --- Layout and view ---

	setPages(pages: PageMeta[]) {
		// Tiles of pages that are gone or look different now (paper, size, PDF page)
		const before = new Map(this.pages.map((p) => [p.id, p]));
		for (const p of pages) {
			const old = before.get(p.id);
			before.delete(p.id);
			if (old && old !== p && (old.paper !== p.paper || old.w !== p.w || old.h !== p.h || old.background?.asset !== p.background?.asset || old.background?.page !== p.background?.page)) {
				this.tiles.clear(p.id);
			}
		}
		for (const id of before.keys()) this.tiles.clear(id);
		this.pages = pages;
		const layout = layoutPages(pages);
		this.rects = layout.rects;
		this.docWidth = layout.width;
		this.docHeight = layout.height;
		this.view.clamp(this.docWidth, this.docHeight);
		this.request();
		// The current page may be another one now
		this.onview?.();
	}

	/** Content of a page arrived or changed from elsewhere */
	contentChanged(id: string) {
		this.tiles.clear(id);
		this.request();
	}

	resize(width: number, height: number, dpr: number) {
		const first = this.view.width <= 1;
		this.dpr = dpr;
		this.view.width = width;
		this.view.height = height;
		for (const canvas of [this.el.base, this.el.live, this.el.marker, this.el.ghost, this.el.overlay]) {
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
		}
		const rect = this.el.root.getBoundingClientRect();
		this.originX = rect.left;
		this.originY = rect.top;
		const style = getComputedStyle(this.el.root);
		this.desk = style.backgroundColor || this.desk;
		this.readColors(style);
		if (first) this.view.fitWidth(this.docWidth);
		this.view.clamp(this.docWidth, this.docHeight);
		this.scale = this.targetScale();
		this.request();
	}

	/** Re-reads colors of the theme (desk around the pages) */
	themeChanged() {
		const style = getComputedStyle(this.el.root);
		this.desk = style.backgroundColor || this.desk;
		this.readColors(style);
		this.request();
	}

	/** Role colors of the theme drawn on the overlay */
	private readColors(style: CSSStyleDeclaration) {
		const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
		this.selectionColor = get('--color-selection', this.selectionColor);
		this.guideColor = get('--color-guide', this.guideColor);
		this.guideText = get('--color-guide-content', this.guideText);
	}

	/** Screen position (CSS pixels relative to the stage) of a client point */
	local(clientX: number, clientY: number): [number, number] {
		return [clientX - this.originX, clientY - this.originY];
	}

	updateOrigin() {
		const rect = this.el.root.getBoundingClientRect();
		this.originX = rect.left;
		this.originY = rect.top;
	}

	panBy(dx: number, dy: number) {
		this.view.panBy(dx, dy);
		this.viewChanged();
	}

	zoomAt(factor: number, sx: number, sy: number) {
		this.view.zoomAt(factor, sx, sy);
		this.viewChanged();
	}

	scrollToPage(index: number) {
		const rect = this.rects[index];
		if (!rect) return;
		this.view.y = rect.y - 16 / this.view.zoom;
		this.viewChanged();
	}

	setZoom(zoom: number) {
		this.view.zoomAt(zoom / this.view.zoom, this.view.width / 2, this.view.height / 2);
		this.viewChanged();
	}

	fitWidth() {
		const page = this.view.centerPage(this.rects);
		this.view.fitWidth(this.docWidth);
		this.scrollToPage(page);
	}

	private viewChanged() {
		this.view.clamp(this.docWidth, this.docHeight);
		// Far off the tile scale (strong zoom): switch at once, stretched tiles would get too blurry or too many
		const ratio = this.targetScale() / this.scale;
		if (ratio > 2 || ratio < 0.5) this.scale = this.targetScale();
		clearTimeout(this.settleTimer);
		this.settleTimer = setTimeout(() => {
			this.scale = this.targetScale();
			this.request();
		}, SETTLE_MS);
		this.request();
		this.onview?.();
	}

	private targetScale() {
		return Math.round(this.view.zoom * this.dpr * 1000) / 1000;
	}

	currentPage(): number {
		return this.view.centerPage(this.rects);
	}

	// --- Frames ---

	request() {
		if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
	}

	private frame() {
		this.raf = 0;
		const t0 = performance.now();
		const ctx = this.baseCtx;
		const { view, dpr } = this;
		const k = view.zoom * dpr;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = this.desk;
		ctx.fillRect(0, 0, this.el.base.width, this.el.base.height);

		// Rendering tiles is the expensive part: a time budget per frame, small while a stroke is drawn
		const deadline = t0 + (this.live ? 3 : 10);
		let missing = false;
		this.backgrounds?.frame();
		if (this.upgrade) {
			this.upgrade = this.upgradeTiles(deadline);
			missing = this.upgrade;
		}
		let visibleTiles = 0;
		const visible = view.visiblePages(this.rects);
		for (const i of visible) {
			const meta = this.pages[i];
			const rect = this.rects[i];
			const scene = this.sceneOf(meta.id);
			if (!scene) this.load(meta.id);
			const page = this.tilePage(meta, scene);
			const ox = Math.round((rect.x - view.x) * k);
			const oy = Math.round((rect.y - view.y) * k);
			const pw = Math.round(rect.w * k);
			const ph = Math.round(rect.h * k);
			ctx.fillStyle = this.shadow;
			ctx.fillRect(ox + 1, oy + 2, pw, ph);
			ctx.save();
			ctx.beginPath();
			ctx.rect(ox, oy, pw, ph);
			ctx.clip();
			ctx.fillStyle = PAPER_COLOR;
			ctx.fillRect(ox, oy, pw, ph);
			const box = this.partInView(rect, view.y, view.y + view.height / view.zoom);
			const scale = this.scale;
			const { tx0, ty0, tx1, ty1 } = tileRange(scale, box);
			const draw = (tile: { canvas: OffscreenCanvas; scale: number; tx: number; ty: number }) => {
				const g = k / tile.scale;
				const x0 = Math.round(ox + tile.tx * TILE * g);
				const y0 = Math.round(oy + tile.ty * TILE * g);
				const x1 = Math.round(ox + (tile.tx + 1) * TILE * g);
				const y1 = Math.round(oy + (tile.ty + 1) * TILE * g);
				ctx.drawImage(tile.canvas, x0, y0, x1 - x0, y1 - y0);
			};
			for (let ty = ty0; ty <= ty1; ty++) {
				for (let tx = tx0; tx <= tx1; tx++) {
					visibleTiles++;
					let tile: Tile | null | undefined = this.tiles.get(meta.id, scale, tx, ty);
					// Until its content is loaded, a page shows its paper color (it is redrawn when it arrives)
					let rendered = false;
					if (!tile && scene && performance.now() < deadline) {
						rendered = true;
						tile = this.tiles.render(page, scale, tx, ty);
					}
					if (tile) {
						draw(tile);
					} else {
						// Out of time: go on next frame; a PDF piece still rendering reports itself (`backgroundReady`)
						if (scene && !rendered) missing = true;
						const size = TILE / scale;
						const tb = { x0: tx * size, y0: ty * size, x1: (tx + 1) * size, y1: (ty + 1) * size };
						for (const fb of this.tiles.fallbacks(meta.id, scale, tb)) draw(fb);
					}
				}
			}
			ctx.restore();
		}
		// Prefetch the next tiles below and above while there is time
		if (!missing && !this.live) this.prefetch(deadline);

		this.tiles.max = Math.max(64, visibleTiles * 3);
		if (this.backgrounds) this.backgrounds.max = this.tiles.max;
		this.tiles.trim();
		if (this.clearLiveOnFrame) {
			this.clearLiveOnFrame = false;
			this.clearLive();
		}
		if (this.drawOverlay()) missing = true;
		const a = this.statsAcc;
		a.frames++;
		a.frameMs += performance.now() - t0;
		if (this.live) {
			this.strokeAcc.frames++;
			this.strokeAcc.frameMs += performance.now() - t0;
		}
		if (missing) this.request();
	}

	private prefetch(deadline: number) {
		const { view } = this;
		const margin = view.height / view.zoom / 2;
		const top = view.y - margin;
		const bottom = view.y + view.height / view.zoom + margin;
		for (let i = 0; i < this.rects.length && performance.now() < deadline; i++) {
			const rect = this.rects[i];
			if (rect.y + rect.h < top || rect.y > bottom) continue;
			const meta = this.pages[i];
			const scene = this.sceneOf(meta.id);
			if (!scene) {
				this.load(meta.id);
				continue;
			}
			const box = this.partInView(rect, top, bottom);
			if (box.y1 <= box.y0) continue;
			const { tx0, ty0, tx1, ty1 } = tileRange(this.scale, box);
			for (let ty = ty0; ty <= ty1 && performance.now() < deadline; ty++) {
				for (let tx = tx0; tx <= tx1 && performance.now() < deadline; tx++) {
					if (!this.tiles.get(meta.id, this.scale, tx, ty)) this.tiles.render(this.tilePage(meta, scene), this.scale, tx, ty);
				}
			}
		}
	}

	/** Part of a page (page points) within the view's width and the document rows `top`…`bottom` */
	private partInView(rect: PageRect, top: number, bottom: number): Box {
		const { view } = this;
		return {
			x0: Math.max(0, view.x - rect.x),
			y0: Math.max(0, top - rect.y),
			x1: Math.min(rect.w, view.x + view.width / view.zoom - rect.x),
			y1: Math.min(rect.h, bottom - rect.y)
		};
	}

	private tilePage(meta: PageMeta, scene: PageScene | null): TilePage {
		const bg = meta.background;
		const backgrounds = this.backgrounds;
		return {
			id: meta.id,
			w: meta.w,
			h: meta.h,
			paper: meta.paper,
			scene,
			pdf: bg && backgrounds ? (scale, tx, ty) => backgrounds.tile(bg, scale, tx, ty) : null
		};
	}

	/** A piece of a PDF page arrived: tiles showing a preview are rendered again (next frame) */
	backgroundReady() {
		this.upgrade = true;
		this.request();
	}

	/** Renders tiles again whose sharp PDF piece is there now; true if time ran out */
	private upgradeTiles(deadline: number): boolean {
		const backgrounds = this.backgrounds;
		if (!backgrounds) return false;
		for (const tile of [...this.tiles.inexact()]) {
			if (performance.now() > deadline) return true;
			const meta = this.pages.find((p) => p.id === tile.page);
			const scene = meta && this.sceneOf(meta.id);
			if (!meta?.background || !scene) continue;
			if (backgrounds.tile(meta.background, tile.scale, tile.tx, tile.ty)?.exact) this.tiles.render(this.tilePage(meta, scene), tile.scale, tile.tx, tile.ty);
		}
		return false;
	}

	/** Statistics since the last call (for the `?perf` overlay) */
	takeStats(): StageStats {
		const a = this.statsAcc;
		this.stats.frame = a.frames ? a.frameMs / a.frames : 0;
		this.stats.latency = a.events ? a.latencyMs / a.events : 0;
		this.stats.rate = a.last > a.start ? (a.points * 1000) / (a.last - a.start) : 0;
		this.stats.tiles = this.tiles.size;
		a.frames = a.frameMs = a.events = a.latencyMs = 0;
		return this.stats;
	}

	// --- The stroke being drawn ---

	/** Starts a stroke at a screen point; false if it is not on a page. `smoothing`: level 0…1 (see `smooth.ts`) */
	begin(sx: number, sy: number, p: number, tool: InkTool, color: string, size: number, smoothing = 0): boolean {
		const hit = this.view.pageAt(this.rects, sx, sy);
		if (!hit || !this.sceneOf(this.pages[hit.index].id)) return false;
		this.clearLive();
		this.clearLiveOnFrame = false;
		const rect = this.rects[hit.index];
		this.buf.reset();
		this.smoother.reset(smoothing);
		this.live = { page: hit.index, rect, tool, color, size, buf: this.buf, sx, sy, shaped: false };
		const ctx = (this.inkCtx = tool === 'highlighter' ? this.markerCtx : this.liveCtx);
		if (ctx === this.liveCtx) {
			// The opaque live canvas covers the pages: start from what they show now
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(this.el.base, 0, 0);
			this.el.live.style.visibility = 'visible';
		}
		const k = this.view.zoom * this.dpr;
		ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		ctx.save();
		ctx.beginPath();
		ctx.rect(Math.round((rect.x - this.view.x) * k) / this.dpr, Math.round((rect.y - this.view.y) * k) / this.dpr, (rect.w * k) / this.dpr, (rect.h * k) / this.dpr);
		ctx.clip();
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		const a = this.statsAcc;
		a.points = 0;
		a.start = performance.now();
		this.strokeAcc = { events: 0, latencyMs: 0, latencyMax: 0, frames: 0, frameMs: 0 };
		this.point(sx, sy, p, null);
		return true;
	}

	/** Adds a point (screen pixels) and paints its segment right away */
	add(sx: number, sy: number, p: number, event: PointerEvent | null, timeStamp: number) {
		if (!this.live) return;
		this.point(sx, sy, p, event);
		const a = this.statsAcc;
		const latency = performance.now() - timeStamp;
		a.events++;
		a.latencyMs += latency;
		const s = this.strokeAcc;
		s.events++;
		s.latencyMs += latency;
		if (latency > s.latencyMax) s.latencyMax = latency;
	}

	private point(px: number, py: number, p: number, event: PointerEvent | null) {
		const live = this.live!;
		const { view } = this;
		// Pen position in page points, smoothed; drawn at its screen position
		this.penX = view.toDocX(px) - live.rect.x;
		this.penY = view.toDocY(py) - live.rect.y;
		this.penP = p;
		const s = this.smoothed;
		this.smoother.next(this.penX, this.penY, s);
		this.paint(s.x, s.y, p, event);
	}

	/** Stores a point (page points) and paints its segment */
	private paint(x: number, y: number, p: number, event: PointerEvent | null) {
		const live = this.live!;
		const { view } = this;
		live.buf.push(x, y, p);
		const sx = view.toScreenX(x + live.rect.x);
		const sy = view.toScreenY(y + live.rect.y);
		const width = diameter(live.tool, live.size, p) * view.zoom;
		const ctx = this.inkCtx;
		if (live.buf.length === 1) {
			ctx.beginPath();
			ctx.arc(sx, sy, width / 2, 0, Math.PI * 2);
			ctx.fill();
		} else {
			ctx.lineWidth = width;
			ctx.beginPath();
			ctx.moveTo(live.sx, live.sy);
			ctx.lineTo(sx, sy);
			ctx.stroke();
		}
		live.sx = sx;
		live.sy = sy;
		this.statsAcc.points++;
		this.statsAcc.last = performance.now();
		if (event && this.presenter && live.tool === 'pen') {
			try {
				this.presenter.updateInkTrailStartPoint(event, { color: live.color, diameter: width });
			} catch {
				this.presenter = null;
			}
		}
	}

	/** Summary of the last stroke for the debug log */
	strokeReport(): string {
		const a = this.statsAcc;
		const s = this.strokeAcc;
		const ms = a.last - a.start;
		const avg = (sum: number, n: number) => (n ? (sum / n).toFixed(1) : '-');
		return (
			`${a.points} points in ${ms.toFixed(0)} ms (${ms > 0 ? Math.round((a.points * 1000) / ms) : 0}/s),` +
			` input→pixel avg ${avg(s.latencyMs, s.events)} ms max ${s.latencyMax.toFixed(1)} ms,` +
			` frame avg ${avg(s.frameMs, s.frames)} ms over ${s.frames} frames, zoom ${this.view.zoom.toFixed(2)}, dpr ${this.dpr}`
		);
	}

	/** Predicted continuation (screen pixels), shown until the next frame only */
	predict(points: readonly { sx: number; sy: number }[]) {
		const live = this.live;
		const ctx = this.ghostCtx;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.el.ghost.width, this.el.ghost.height);
		if (!live || !points.length) return;
		ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		this.el.ghost.style.opacity = String(inkAlpha(live.tool));
		ctx.strokeStyle = live.color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = diameter(live.tool, live.size, live.buf.p(live.buf.length - 1)) * this.view.zoom;
		ctx.beginPath();
		ctx.moveTo(live.sx, live.sy);
		for (const p of points) ctx.lineTo(p.sx, p.sy);
		ctx.stroke();
	}

	/** Replaces the stroke being drawn by other points (the shape tool's shape), painted at once */
	replaceLive(points: Float32Array) {
		const live = this.live;
		if (!live) return;
		live.shaped = true;
		const ctx = this.inkCtx;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (ctx === this.liveCtx) ctx.drawImage(this.el.base, 0, 0);
		else ctx.clearRect(0, 0, this.el.marker.width, this.el.marker.height);
		ctx.restore();
		live.buf.reset();
		for (let i = 0; i < points.length; i += 3) this.paint(points[i], points[i + 1], points[i + 2], null);
	}

	/** Ends the stroke: its page and points; the live layer stays until the stroke is in the tiles */
	end(): { page: number; points: Float32Array; tool: InkTool; color: string; size: number } | null {
		const live = this.live;
		if (live) {
			// The smoothed line lags behind the pen: let it reach where the pen was lifted
			const last = live.buf.length - 1;
			const gap = Math.hypot(this.penX - live.buf.x(last), this.penY - live.buf.y(last));
			if (gap > 0.05 && !live.shaped) this.paint(this.penX, this.penY, this.penP, null);
		}
		this.live = null;
		this.predict([]);
		this.inkCtx.restore();
		if (!live) return null;
		return { page: live.page, points: live.buf.toArray(), tool: live.tool, color: live.color, size: live.size };
	}

	/** Drops the stroke being drawn (e.g. a second finger turned it into a pinch) */
	cancel() {
		if (this.live) this.inkCtx.restore();
		this.live = null;
		this.predict([]);
		this.clearLive();
	}

	private clearLive() {
		this.el.live.style.visibility = 'hidden';
		const ctx = this.markerCtx;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.el.marker.width, this.el.marker.height);
		ctx.restore();
	}

	/** A finished stroke is in the page: draw it into the tiles, the live layer goes with the next frame */
	committed(pageId: string, scene: PageScene, stroke: Ink) {
		this.tiles.drawStroke(pageId, scene, stroke, scene.bounds(stroke));
		this.clearLiveOnFrame = true;
		this.request();
	}

	/** Items were added, removed or changed in a region of a page */
	regionChanged(pageId: string, box: Box | null) {
		const meta = this.pages.find((p) => p.id === pageId);
		const scene = this.sceneOf(pageId);
		if (!meta || !scene) return;
		this.tiles.refresh(this.tilePage(meta, scene), box, this.scale);
		this.request();
	}

	// --- Erasing ---

	/** Strokes and shapes under a circle of `radius` screen pixels at (sx, sy), with their page */
	strokesAt(sx: number, sy: number, radius: number): { page: number; strokes: Ink[] } | null {
		const hit = this.view.pageAt(this.rects, sx, sy);
		if (!hit) return null;
		const scene = this.sceneOf(this.pages[hit.index].id);
		if (!scene) return null;
		const r = radius / this.view.zoom;
		const box = { x0: hit.x - r, y0: hit.y - r, x1: hit.x + r, y1: hit.y + r };
		const strokes: Ink[] = [];
		for (const s of scene.index.query(box)) if (isInk(s) && intersects(scene.bounds(s), box) && inkStrokes(s).some((piece) => hitsStroke(piece, hit.x, hit.y, r))) strokes.push(s);
		return { page: hit.index, strokes };
	}

	/** The topmost item at a screen point (pictures by their box, ink within `reach` screen pixels), with its page */
	itemAt(sx: number, sy: number, reach: number): { page: number; id: string } | null {
		const hit = this.view.pageAt(this.rects, sx, sy);
		const scene = hit && this.sceneOf(this.pages[hit.index].id);
		if (!hit || !scene) return null;
		const r = reach / this.view.zoom;
		const items = scene.itemsIn({ x0: hit.x - r, y0: hit.y - r, x1: hit.x + r, y1: hit.y + r });
		for (let i = items.length - 1; i >= 0; i--) {
			const p = items[i];
			const fill = isShape(p) && fillOutline(p);
			const found = isInk(p)
				? inkStrokes(p).some((piece) => hitsStroke(piece, hit.x, hit.y, r)) || (!!fill && pointInPolygon(hit.x, hit.y, fill))
				: hit.x >= p.x && hit.x <= p.x + p.w && hit.y >= p.y && hit.y <= p.y + p.h;
			if (found) return { page: hit.index, id: p.id };
		}
		return null;
	}

	// --- Overlay: lasso, selection, guides, laser ---

	/** What to snap to on a page: its edges and center, its shapes and pictures except `exclude` */
	snapTargets(page: number, exclude: ReadonlySet<string>): SnapTargets | null {
		const meta = this.pages[page];
		const scene = meta && this.sceneOf(meta.id);
		return scene ? pageTargets(scene.items, exclude, meta.w, meta.h) : null;
	}

	setGuides(guides: StageGuides | null) {
		if (!guides && !this.guides) return;
		this.guides = guides && (guides.guides.x || guides.guides.y || guides.guides.gaps.length) ? guides : null;
		this.request();
	}

	setLasso(points: number[] | null) {
		this.lasso = points;
		this.request();
	}

	setSelection(selection: StageSelection | null) {
		this.selection = selection;
		this.request();
	}

	/** A box of a page (page points) on screen (CSS pixels) */
	boxRect(page: number, box: Box): { x: number; y: number; w: number; h: number } | null {
		const rect = this.rects[page];
		if (!rect) return null;
		const x = this.view.toScreenX(rect.x + box.x0);
		const y = this.view.toScreenY(rect.y + box.y0);
		return { x, y, w: this.view.toScreenX(rect.x + box.x1) - x, h: this.view.toScreenY(rect.y + box.y1) - y };
	}

	/** Bounds of the selection on screen (CSS pixels), with its current move/scale */
	selectionRect(): { x: number; y: number; w: number; h: number } | null {
		const s = this.selection;
		const rect = s && this.rects[s.page];
		if (!s || !rect) return null;
		const { t, box } = s;
		const [x0, y0] = this.toScreen(rect, t, box.x0, box.y0);
		const [x1, y1] = this.toScreen(rect, t, box.x1, box.y1);
		return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
	}

	/** Points of a selected shape on screen (CSS pixels), with the selection's current move/scale */
	private handlePoints(): [number, number][] {
		const s = this.selection;
		const rect = s && this.rects[s.page];
		if (!s?.handles || !rect) return [];
		return s.handles.map(([x, y]) => this.toScreen(rect, s.t, x, y));
	}

	/** A page point on screen (CSS pixels), moved/scaled by `t` */
	private toScreen(rect: PageRect, t: Transform, x: number, y: number): [number, number] {
		return [this.view.toScreenX(rect.x + t.ox + (x - t.ox) * t.scale + t.dx), this.view.toScreenY(rect.y + t.oy + (y - t.oy) * t.scale + t.dy)];
	}

	/** Which part of the selection is at a screen point: a point of a shape, a corner handle, the inside, or nothing */
	selectionHandle(sx: number, sy: number, touch: boolean): SelectionHandle | null {
		const r = this.selectionRect();
		if (!r) return null;
		const reach = touch ? 22 : 12;
		if (this.selection?.handles) {
			// Nearest point within reach (points of small shapes lie close together)
			let best = -1;
			let dist = reach;
			this.handlePoints().forEach(([x, y], i) => {
				const d = Math.hypot(sx - x, sy - y);
				if (d <= dist) {
					dist = d;
					best = i;
				}
			});
			if (best >= 0) return { point: best };
			// Thin shapes (a horizontal line) still need room to be grabbed
			const pad = touch ? 12 : 6;
			return sx >= r.x - pad && sx <= r.x + r.w + pad && sy >= r.y - pad && sy <= r.y + r.h + pad ? 'move' : null;
		}
		const corners: [SelectionHandle, number, number][] = [
			['nw', r.x, r.y],
			['ne', r.x + r.w, r.y],
			['se', r.x + r.w, r.y + r.h],
			['sw', r.x, r.y + r.h]
		];
		for (const [handle, x, y] of corners) if (Math.hypot(sx - x, sy - y) <= reach) return handle;
		return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h ? 'move' : null;
	}

	/** Page index and page point of a screen point (null between pages) */
	pageAt(sx: number, sy: number) {
		return this.view.pageAt(this.rects, sx, sy);
	}

	/** Where something new goes: the page under a screen point, else the middle of the view on the current page */
	insertPoint(sx?: number, sy?: number): { page: number; x: number; y: number } | null {
		if (sx !== undefined && sy !== undefined) {
			const hit = this.view.pageAt(this.rects, sx, sy);
			if (hit) return { page: hit.index, x: hit.x, y: hit.y };
		}
		const page = this.currentPage();
		const rect = this.rects[page];
		if (!rect) return null;
		const [x, y] = this.toPage(page, this.view.width / 2, this.view.height / 2);
		return { page, x: Math.min(Math.max(0, x), rect.w), y: Math.min(Math.max(0, y), rect.h) };
	}

	/** Screen point in the coordinates of a page (also outside it) */
	toPage(page: number, sx: number, sy: number): [number, number] {
		const rect = this.rects[page];
		return [this.view.toDocX(sx) - rect.x, this.view.toDocY(sy) - rect.y];
	}

	laserPoint(sx: number, sy: number) {
		this.laser.push({ x: this.view.toDocX(sx), y: this.view.toDocY(sy), t: performance.now() });
		this.request();
	}

	/** Draws the overlay (`overlay.ts`); true while it needs further frames (fading laser) */
	private drawOverlay(): boolean {
		const ctx = this.overlayCtx;
		const { dpr, view } = this;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.el.overlay.width, this.el.overlay.height);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		const s = this.selection;
		const rect = s && this.rects[s.page];
		if (s && rect) {
			// The dragged items, moved/scaled as they will be put back
			if (s.lifted) drawLifted(ctx, view, rect, s.t, s.lifted, this.sceneOf(this.pages[s.page].id)?.pictures ?? null, this.liftedPaths);
			drawSelectionFrame(ctx, this.selectionRect()!, s.handles ? this.handlePoints() : null, this.selectionColor);
		}

		const guides = this.guides;
		const guideRect = guides && this.rects[guides.page];
		if (guides && guideRect) drawGuides(ctx, view, guideRect, guides.guides, guides.boxes, { guide: this.guideColor, text: this.guideText });

		if (this.lasso && this.lasso.length >= 4) drawLasso(ctx, this.lasso, this.selectionColor);

		this.laser = drawLaser(ctx, view, this.laser);
		return this.laser.length > 0;
	}

	// --- Cursor preview (pen hover, eraser) ---

	showCursor(sx: number, sy: number, diameterPx: number, color: string | null) {
		const c = this.el.cursor;
		const d = Math.max(4, diameterPx);
		c.style.width = c.style.height = `${d}px`;
		c.style.transform = `translate(${sx - d / 2}px, ${sy - d / 2}px)`;
		c.style.background = color ?? 'transparent';
		c.style.display = 'block';
	}

	hideCursor() {
		this.el.cursor.style.display = 'none';
	}
}
