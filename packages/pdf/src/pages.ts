// PDF pages as tiles, rendered by PDF.js in its renderer worker (the main thread only copies bitmaps).
// - Blocks: one render call covers up to BLOCK×BLOCK tiles (a whole page at normal zoom) – PDF.js runs through the
//   whole page for every call, so rendering tile by tile would repeat that work for each tile.
// - Preview: the whole page small, rendered first and shown stretched until the sharp block is there.
// Tiles ask for their piece every frame they need it; what is in view in the newest frame is rendered first (in the
// order asked), older requests later. One render per document at a time (PDF.js cancels concurrent renders of a
// page). Least recently used blocks are dropped beyond `max` tiles' worth.

import { debug } from '@in-browser/brand/debug.js';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { OptionalContentConfig } from 'pdfjs-dist/types/src/display/optional_content_config.js';
import { openPdf } from './pdfjs.js';

/** PDF.js `AnnotationMode.ENABLE_STORAGE`: annotations as the document's `annotationStorage` says (a tool hides those
 * it draws itself with `{ noView: true }`; filled-in form values) */
const ENABLE_STORAGE = 3;

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
	/** Shows the page as it was (`refresh`): handed out as a preview until it is rendered anew */
	stale?: boolean;
}

interface Request {
	key: string;
	doc: string;
	/** 1-based */
	page: number;
	/** Pixels per point; 0 = preview */
	scale: number;
	bx: number;
	by: number;
	gen: number;
	seq: number;
	tries: number;
	/** The color under the page's content instead of white */
	background?: string;
}

export interface PdfPagesOptions {
	/** Tile edge in pixels (default 512) */
	tile?: number;
	/** Prefix of log lines, e.g. `[pdf-editor]` */
	label?: string;
	/** Documents the caller already opened (they stay the caller's: never destroyed here); others are read and opened */
	open?: (doc: string) => Promise<PDFDocumentProxy> | null;
	/** Which layers (optional content) of a document are shown; the document's own choice without it */
	layers?: (doc: string) => Promise<OptionalContentConfig> | undefined;
	/** Rotation of a page in degrees when it differs from the document's own (`forget` the page after a change) */
	rotation?: (doc: string, page: number) => number | undefined;
}

/** Pages of PDF documents, piece by piece for tiles. Documents are named by the caller (`doc`), pages count from 1 */
export class PdfPages {
	private readonly docs = new Map<string, Promise<PDFDocumentProxy>>();
	private readonly pages = new Map<string, Promise<PDFPageProxy>>();
	private readonly done = new Map<string, Rendered>();
	private readonly queue = new Map<string, Request>();
	/** Documents with a render running */
	private readonly busy = new Set<string>();
	/** Blocks being rendered now; those `refresh` saw meanwhile are rendered once more (`again`) */
	private readonly rendering = new Set<string>();
	private readonly again = new Set<string>();
	private clock = 0;
	private seq = 0;
	private gen = 0;
	private destroyed = false;
	/** Tiles' worth kept (a tile about 1 MB); the stage keeps it in step with its tiles */
	max = 64;

	private readonly size: number;
	private readonly label: string;
	private readonly opened: PdfPagesOptions['open'];
	private readonly layers: PdfPagesOptions['layers'];
	private readonly rotation: PdfPagesOptions['rotation'];
	/** Documents opened here (destroyed with this) */
	private readonly own = new Set<string>();

	constructor(
		/** Content of a document */
		private readonly readDoc: (doc: string) => Promise<Blob>,
		/** Something arrived: draw again (tiles showing a preview are rendered again) */
		private readonly ready: () => void,
		options: PdfPagesOptions = {}
	) {
		this.size = options.tile ?? 512;
		this.label = options.label ?? '[pdf]';
		this.opened = options.open;
		this.layers = options.layers;
		this.rotation = options.rotation;
	}

	/** Starts PDF.js and opens the documents before the first page needs them */
	warm(docs: Iterable<string>) {
		for (const doc of new Set(docs)) this.doc(doc).catch(() => {});
	}

	/** A new frame asks: its requests go before all older ones */
	frame() {
		this.gen++;
	}

	/** The piece of a PDF page for tile (tx, ty) at `scale`: sharp, a preview meanwhile, or null (both requested) */
	tile(doc: string, page: number, scale: number, tx: number, ty: number, background?: string): Piece | null {
		const TILE = this.size;
		const bx = Math.floor(tx / BLOCK);
		const by = Math.floor(ty / BLOCK);
		const on = background ? `|${background}` : '';
		const key = `${doc}|${page}|${scale}|${bx}|${by}${on}`;
		const block = this.get(key);
		if (block) {
			if (!block.image) return blank();
			if (block.stale && !this.queue.has(key) && !this.rendering.has(key)) this.ask(key, doc, page, scale, bx, by, background);
			return { image: block.image, sx: (tx - bx * BLOCK) * TILE, sy: (ty - by * BLOCK) * TILE, sw: TILE, sh: TILE, exact: !block.stale };
		}
		const previewKey = `${doc}|${page}|preview${on}`;
		const preview = this.get(previewKey);
		if (!preview || (preview.stale && !this.queue.has(previewKey) && !this.rendering.has(previewKey))) this.ask(previewKey, doc, page, 0, 0, 0, background);
		this.ask(key, doc, page, scale, bx, by, background);
		if (!preview?.image) return null;
		// The tile's part of the page in preview pixels
		const k = preview.scale / scale;
		return { image: preview.image, sx: tx * TILE * k, sy: ty * TILE * k, sw: TILE * k, sh: TILE * k, exact: false };
	}

	/** The small picture of a whole page (thumbnails), null while it is rendered (`ready` follows) */
	preview(doc: string, page: number, background?: string): ImageBitmap | null {
		const key = `${doc}|${page}|preview${background ? `|${background}` : ''}`;
		const preview = this.get(key);
		if (!preview || (preview.stale && !this.queue.has(key) && !this.rendering.has(key))) this.ask(key, doc, page, 0, 0, 0, background);
		return preview?.image ?? null;
	}

	/** Is the small picture of a page there as the page looks now (not one kept from before `refresh`)? */
	previewFresh(doc: string, page: number, background?: string): boolean {
		const preview = this.done.get(`${doc}|${page}|preview${background ? `|${background}` : ''}`);
		return !!preview && !preview.stale;
	}

	/**
	 * A whole PDF page rendered at `scale` (export, print), with the layers shown. `annotations: false` leaves out the
	 * file's comments (everything but form fields) for this render only; `background` is what lies under the page's
	 * content (a CSS color, `rgba(0,0,0,0)` for none) instead of white
	 */
	async render(doc: string, page: number, scale: number, options: { annotations?: boolean; background?: string } = {}): Promise<HTMLCanvasElement> {
		const proxy = await this.page(doc, page);
		const viewport = proxy.getViewport({ scale, rotation: this.rotation?.(doc, page) });
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const hide = options.annotations === false ? (await proxy.getAnnotations()).filter((a) => a.subtype !== 'Widget').map((a) => a.id as string) : [];
		// PDF.js reads the storage when `render` is called: hidden for that moment only, so the screen keeps them
		const storage = (await this.doc(doc)).annotationStorage;
		const added = hide.filter((id) => !storage.has(id));
		for (const id of added) storage.setValue(id, { noView: true });
		const layers = this.layers?.(doc);
		// A canvas handed to PDF.js gets an opaque background: another one is drawn through a context of our own
		const context = options.background === undefined ? null : canvas.getContext('2d');
		if (options.background !== undefined && !context) throw new Error('No canvas');
		const task = context
			? proxy.render({ canvas: null, canvasContext: context, viewport, background: options.background, optionalContentConfigPromise: layers, annotationMode: ENABLE_STORAGE })
			: proxy.render({ canvas, viewport, optionalContentConfigPromise: layers, annotationMode: ENABLE_STORAGE });
		for (const id of added) storage.remove(id);
		await task.promise;
		return canvas;
	}

	/**
	 * A page looks different now (e.g. a form field filled in) but keeps its size: what was rendered stays shown – as
	 * a preview, `exact` false – until it is rendered anew, so nothing flickers
	 */
	refresh(doc: string, page: number) {
		const prefix = `${doc}|${page}|`;
		for (const [key, r] of this.done) if (key.startsWith(prefix)) r.stale = true;
		// Rendered from the page as it was: their result is stale too
		for (const key of this.rendering) if (key.startsWith(prefix)) this.again.add(key);
	}

	/**
	 * Another document stands for `doc` from now on (the same pages, some with changed content): those pages are
	 * rendered anew from it, like `refresh` – what is shown stays until then. The caller closes the old document
	 * once nothing renders from it any more.
	 */
	swap(doc: string, proxy: PDFDocumentProxy, pages: Iterable<number>) {
		this.docs.set(doc, Promise.resolve(proxy));
		this.own.delete(doc);
		const prefix = `${doc}|`;
		for (const key of this.pages.keys()) if (key.startsWith(prefix)) this.pages.delete(key);
		for (const page of pages) this.refresh(doc, page);
	}

	/** Is a page still shown as it was before `refresh` (or being rendered anew)? */
	refreshing(doc: string, page: number): boolean {
		const prefix = `${doc}|${page}|`;
		for (const [key, r] of this.done) if (r.stale && key.startsWith(prefix)) return true;
		for (const key of this.rendering) if (key.startsWith(prefix)) return true;
		return false;
	}

	/** Forgets what was rendered of a document (it changed: pages rotated, annotations edited); asked for again */
	forget(doc: string, page?: number) {
		const prefix = page === undefined ? `${doc}|` : `${doc}|${page}|`;
		for (const [key, r] of this.done) {
			if (!key.startsWith(prefix)) continue;
			r.image?.close();
			this.done.delete(key);
		}
		for (const key of this.queue.keys()) if (key.startsWith(prefix)) this.queue.delete(key);
		for (const key of this.again) if (key.startsWith(prefix)) this.again.delete(key);
		if (page === undefined) {
			for (const key of this.pages.keys()) if (key.startsWith(prefix)) this.pages.delete(key);
			if (this.own.has(doc)) this.docs.get(doc)?.then((d) => d.loadingTask.destroy()).catch(() => {});
			this.docs.delete(doc);
			this.own.delete(doc);
		}
	}

	/** Bytes of a document (export embeds it) */
	async bytes(doc: string): Promise<Uint8Array> {
		return new Uint8Array(await (await this.readDoc(doc)).arrayBuffer());
	}

	private get(key: string): Rendered | undefined {
		const r = this.done.get(key);
		if (r) r.used = ++this.clock;
		return r;
	}

	private ask(key: string, doc: string, page: number, scale: number, bx: number, by: number, background?: string) {
		const known = this.queue.get(key);
		if (known) {
			if (known.gen !== this.gen) {
				known.gen = this.gen;
				known.seq = ++this.seq;
			}
		} else {
			this.queue.set(key, { key, doc, page, scale, bx, by, background, gen: this.gen, seq: ++this.seq, tries: 0 });
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
			if (this.busy.has(r.doc)) continue;
			if (!found || before(r, found)) found = r;
		}
		return found;
	}

	private pump() {
		for (let r = this.next(); r && !this.destroyed; r = this.next()) {
			const request = r;
			this.queue.delete(request.key);
			this.busy.add(request.doc);
			this.rendering.add(request.key);
			// No longer rendering before anyone hears of the result (who asks then must be able to ask again)
			const done = () => this.rendering.delete(request.key);
			this.renderBlock(request)
				.then((rendered) => {
					done();
					this.keep(request.key, rendered);
				})
				.catch((e) => {
					done();
					const cancelled = (e as { name?: string })?.name === 'RenderingCancelledException';
					if (cancelled && this.destroyed) {
						// Closed while rendering: nothing to report
					} else if (cancelled && request.tries < RETRIES) {
						this.queue.set(request.key, { ...request, tries: request.tries + 1 });
					} else {
						console.error(`${this.label} PDF page`, request.page, e);
						this.keep(request.key, { image: null, scale: request.scale, used: 0, weight: 0 });
					}
				})
				.finally(() => {
					this.busy.delete(request.doc);
					this.pump();
				});
		}
	}

	private async renderBlock({ doc, page: n, scale, bx, by, background }: Request): Promise<Rendered> {
		const TILE = this.size;
		const t0 = performance.now();
		const page = await this.page(doc, n);
		const t1 = performance.now();
		const rotation = this.rotation?.(doc, n);
		const full = page.getViewport({ scale: 1, rotation });
		const s = scale || PREVIEW / Math.max(full.width, full.height);
		const viewport = page.getViewport({ scale: s, rotation });
		const size = BLOCK * TILE;
		const canvas = document.createElement('canvas');
		// The block, cut at the page's edge (the preview is the whole page)
		canvas.width = scale ? Math.max(1, Math.min(size, Math.ceil(viewport.width) - bx * size)) : Math.ceil(viewport.width);
		canvas.height = scale ? Math.max(1, Math.min(size, Math.ceil(viewport.height) - by * size)) : Math.ceil(viewport.height);
		const optionalContentConfigPromise = this.layers?.(doc);
		const transform = [1, 0, 0, 1, -bx * size, -by * size];
		// Another color under the page than white: drawn through a context of our own (as in `render`)
		const context = background ? canvas.getContext('2d') : null;
		await (context
			? page.render({ canvas: null, canvasContext: context, viewport, transform, background, optionalContentConfigPromise, annotationMode: ENABLE_STORAGE })
			: page.render({ canvas, viewport, transform, optionalContentConfigPromise, annotationMode: ENABLE_STORAGE })
		).promise;
		const image = await createImageBitmap(canvas);
		if (import.meta.hot) {
			const what = scale ? `${canvas.width}×${canvas.height} px at ${scale}` : 'preview';
			const wait = t1 - t0 > 5 ? `, waited ${(t1 - t0).toFixed(0)} ms for the document` : '';
			debug(`${this.label} PDF page ${n} ${what}: ${(performance.now() - t1).toFixed(0)} ms${wait}`);
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
		// The page changed while it rendered: still stale (asked for again when shown)
		if (this.again.delete(key)) rendered.stale = true;
		const old = this.done.get(key);
		if (old && old.image !== rendered.image) old.image?.close();
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

	private doc(name: string): Promise<PDFDocumentProxy> {
		let doc = this.docs.get(name);
		if (!doc) doc = this.opened?.(name) ?? undefined;
		if (doc && !this.docs.has(name)) this.docs.set(name, doc);
		if (!doc) {
			this.own.add(name);
			const t0 = performance.now();
			doc = this.bytes(name)
				.then(openPdf)
				.then((d) => {
					if (import.meta.hot) debug(`${this.label} PDF opened (${d.numPages} pages): ${(performance.now() - t0).toFixed(0)} ms`);
					return d;
				});
			this.docs.set(name, doc);
		}
		return doc;
	}

	private page(doc: string, n: number): Promise<PDFPageProxy> {
		const key = `${doc}|${n}`;
		let page = this.pages.get(key);
		if (!page) {
			page = this.doc(doc).then((d) => d.getPage(n));
			this.pages.set(key, page);
		}
		return page;
	}

	destroy() {
		this.destroyed = true;
		this.queue.clear();
		for (const r of this.done.values()) r.image?.close();
		this.done.clear();
		for (const [name, doc] of this.docs) if (this.own.has(name)) doc.then((d) => d.loadingTask.destroy()).catch(() => {});
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

/** White for a page that failed to render */
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
