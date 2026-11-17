// PDF pages under the notes, rendered by PDF.js in its renderer worker (the main thread only copies bitmaps).
// - Blocks: one render call covers up to BLOCK×BLOCK tiles (a whole page at normal zoom) – PDF.js runs through the
//   whole page for every call, so rendering tile by tile would repeat that work for each tile.
// - Preview: the whole page small, rendered first and shown stretched until the sharp block is there.
// Tiles ask for their piece every frame they need it; what is in view in the newest frame is rendered first (in the
// order asked), older requests later. One render per document at a time (PDF.js cancels concurrent renders of a
// page). Least recently used blocks are dropped beyond `max` tiles' worth.

import { debug } from '@in-browser/brand/debug.js';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { Background } from '#lib/model/types.js';
import { openPdf } from './pdf.js';
import { TILE } from './tiles.js';

/** Tiles per block edge (a block is at most 2048 px square) */
const BLOCK = 4;
/** Longer side of the preview of a page (pixels) */
const PREVIEW = 768;
/** Requests kept (older ones are forgotten – asked again if still needed) */
const QUEUE = 64;
/** Retries of a render that failed for no fault of the page (e.g. cancelled) */
const RETRIES = 2;

/** A piece for a tile: a part of a rendered image; `exact` false = stretched preview */
export interface Piece {
	image: CanvasImageSource;
	sx: number;
	sy: number;
	sw: number;
	sh: number;
	exact: boolean;
}

interface Rendered {
	/** null: failed for good (plain paper is shown) */
	image: ImageBitmap | null;
	/** Pixels per point it was rendered at */
	scale: number;
	used: number;
	/** Tiles' worth of memory */
	weight: number;
}

interface Request {
	key: string;
	bg: Background;
	/** Pixels per point; 0 = preview */
	scale: number;
	bx: number;
	by: number;
	gen: number;
	seq: number;
	tries: number;
}

export class PdfBackgrounds {
	private readonly docs = new Map<string, Promise<PDFDocumentProxy>>();
	private readonly pages = new Map<string, Promise<PDFPageProxy>>();
	private readonly done = new Map<string, Rendered>();
	private readonly queue = new Map<string, Request>();
	/** Documents with a render running */
	private readonly busy = new Set<string>();
	private clock = 0;
	private seq = 0;
	private gen = 0;
	private destroyed = false;
	/** Tiles' worth kept (a tile about 1 MB); the stage keeps it in step with its tiles */
	max = 64;

	constructor(
		/** Content of an asset file */
		private readonly readAsset: (name: string) => Promise<Blob>,
		/** Something arrived: draw again (tiles showing a preview are rendered again) */
		private readonly ready: () => void
	) {}

	/** Starts PDF.js and opens the documents before the first page needs them (opening a notebook) */
	warm(assets: Iterable<string>) {
		for (const asset of new Set(assets)) this.doc(asset).catch(() => {});
	}

	/** A new frame asks: its requests go before all older ones */
	frame() {
		this.gen++;
	}

	/** The piece of a PDF page for tile (tx, ty) at `scale`: sharp, a preview meanwhile, or null (both requested) */
	tile(bg: Background, scale: number, tx: number, ty: number): Piece | null {
		const bx = Math.floor(tx / BLOCK);
		const by = Math.floor(ty / BLOCK);
		const key = `${bg.asset}|${bg.page}|${scale}|${bx}|${by}`;
		const block = this.get(key);
		if (block) {
			if (!block.image) return blank();
			return { image: block.image, sx: (tx - bx * BLOCK) * TILE, sy: (ty - by * BLOCK) * TILE, sw: TILE, sh: TILE, exact: true };
		}
		const previewKey = `${bg.asset}|${bg.page}|preview`;
		const preview = this.get(previewKey);
		if (!preview) this.ask(previewKey, bg, 0, 0, 0);
		this.ask(key, bg, scale, bx, by);
		if (!preview?.image) return null;
		// The tile's part of the page in preview pixels
		const k = preview.scale / scale;
		return { image: preview.image, sx: tx * TILE * k, sy: ty * TILE * k, sw: TILE * k, sh: TILE * k, exact: false };
	}

	/** A whole PDF page rendered at `scale` (export) */
	async render(bg: Background, scale: number): Promise<HTMLCanvasElement> {
		const page = await this.page(bg);
		const viewport = page.getViewport({ scale });
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await page.render({ canvas, viewport }).promise;
		return canvas;
	}

	/** Bytes of a PDF asset (export embeds it) */
	async bytes(asset: string): Promise<Uint8Array> {
		return new Uint8Array(await (await this.readAsset(asset)).arrayBuffer());
	}

	private get(key: string): Rendered | undefined {
		const r = this.done.get(key);
		if (r) r.used = ++this.clock;
		return r;
	}

	private ask(key: string, bg: Background, scale: number, bx: number, by: number) {
		const known = this.queue.get(key);
		if (known) {
			if (known.gen !== this.gen) {
				known.gen = this.gen;
				known.seq = ++this.seq;
			}
		} else {
			this.queue.set(key, { key, bg, scale, bx, by, gen: this.gen, seq: ++this.seq, tries: 0 });
			if (this.queue.size > QUEUE) this.queue.delete(this.oldest()!.key);
		}
		this.pump();
	}

	private oldest(): Request | undefined {
		let found: Request | undefined;
		for (const r of this.queue.values()) if (!found || r.gen < found.gen || (r.gen === found.gen && r.seq < found.seq)) found = r;
		return found;
	}

	/** Next request of a free document: newest frame first, previews first, then in the order asked */
	private next(): Request | undefined {
		let found: Request | undefined;
		for (const r of this.queue.values()) {
			if (this.busy.has(r.bg.asset)) continue;
			if (!found || before(r, found)) found = r;
		}
		return found;
	}

	private pump() {
		for (let r = this.next(); r && !this.destroyed; r = this.next()) {
			const request = r;
			this.queue.delete(request.key);
			this.busy.add(request.bg.asset);
			this.renderBlock(request)
				.then((rendered) => this.keep(request.key, rendered))
				.catch((e) => {
					const cancelled = (e as { name?: string })?.name === 'RenderingCancelledException';
					if (cancelled && request.tries < RETRIES && !this.destroyed) {
						this.queue.set(request.key, { ...request, tries: request.tries + 1 });
					} else {
						console.error('[notes] PDF page', request.bg.page, e);
						this.keep(request.key, { image: null, scale: request.scale, used: 0, weight: 0 });
					}
				})
				.finally(() => {
					this.busy.delete(request.bg.asset);
					this.pump();
				});
		}
	}

	private async renderBlock({ bg, scale, bx, by }: Request): Promise<Rendered> {
		const t0 = performance.now();
		const page = await this.page(bg);
		const t1 = performance.now();
		const full = page.getViewport({ scale: 1 });
		const s = scale || PREVIEW / Math.max(full.width, full.height);
		const viewport = page.getViewport({ scale: s });
		const size = BLOCK * TILE;
		const canvas = document.createElement('canvas');
		// The block, cut at the page's edge (the preview is the whole page)
		canvas.width = scale ? Math.max(1, Math.min(size, Math.ceil(viewport.width) - bx * size)) : Math.ceil(viewport.width);
		canvas.height = scale ? Math.max(1, Math.min(size, Math.ceil(viewport.height) - by * size)) : Math.ceil(viewport.height);
		await page.render({ canvas, viewport, transform: [1, 0, 0, 1, -bx * size, -by * size] }).promise;
		const image = await createImageBitmap(canvas);
		if (import.meta.hot) {
			const what = scale ? `${canvas.width}×${canvas.height} px at ${scale}` : 'preview';
			const wait = t1 - t0 > 5 ? `, waited ${(t1 - t0).toFixed(0)} ms for the document` : '';
			debug(`[notes] PDF page ${bg.page} ${what}: ${(performance.now() - t1).toFixed(0)} ms${wait}`);
		}
		// Frees the canvas memory now instead of with the garbage collector
		canvas.width = canvas.height = 0;
		return { image, scale: s, used: 0, weight: (image.width * image.height) / (TILE * TILE) };
	}

	private keep(key: string, rendered: Rendered) {
		if (this.destroyed) {
			rendered.image?.close();
			return;
		}
		rendered.used = ++this.clock;
		this.done.set(key, rendered);
		let weight = 0;
		for (const r of this.done.values()) weight += r.weight;
		if (weight > this.max) {
			const byAge = [...this.done.entries()].sort((a, b) => a[1].used - b[1].used);
			for (const [old, r] of byAge) {
				if (weight <= this.max) break;
				if (old === key) continue;
				weight -= r.weight;
				r.image?.close();
				this.done.delete(old);
			}
		}
		this.ready();
	}

	private doc(asset: string): Promise<PDFDocumentProxy> {
		let doc = this.docs.get(asset);
		if (!doc) {
			const t0 = performance.now();
			doc = this.bytes(asset)
				.then(openPdf)
				.then((d) => {
					if (import.meta.hot) debug(`[notes] PDF opened (${d.numPages} pages): ${(performance.now() - t0).toFixed(0)} ms`);
					return d;
				});
			this.docs.set(asset, doc);
		}
		return doc;
	}

	private page(bg: Background): Promise<PDFPageProxy> {
		const key = `${bg.asset}|${bg.page}`;
		let page = this.pages.get(key);
		if (!page) {
			page = this.doc(bg.asset).then((doc) => doc.getPage(bg.page));
			this.pages.set(key, page);
		}
		return page;
	}

	destroy() {
		this.destroyed = true;
		this.queue.clear();
		for (const r of this.done.values()) r.image?.close();
		this.done.clear();
		for (const doc of this.docs.values()) doc.then((d) => d.loadingTask.destroy()).catch(() => {});
		this.docs.clear();
		this.pages.clear();
	}
}

/** Order of requests: newer frame, then previews, then asked earlier */
function before(a: Request, b: Request): boolean {
	if (a.gen !== b.gen) return a.gen > b.gen;
	const pa = a.scale === 0;
	const pb = b.scale === 0;
	if (pa !== pb) return pa;
	return a.seq < b.seq;
}

let white: Piece | null = null;

/** Plain paper for a page that failed to render */
function blank(): Piece {
	if (!white) {
		const canvas = new OffscreenCanvas(1, 1);
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, 1, 1);
		white = { image: canvas, sx: 0, sy: 0, sw: 1, sh: 1, exact: true };
	}
	return white;
}
