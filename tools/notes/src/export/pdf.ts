// The notebook as a PDF (pdf-lib, loaded on demand). Everything stays vector where it was vector:
// - imported PDF pages are embedded as they are (text stays selectable and sharp), rotation applied;
// - paper lines, grid and dots as shapes;
// - strokes as lines with round caps and joins: every segment as wide as the pressure at its end – exactly the
//   shape of `ink/outline.ts` (a segment with round ends is a line with round caps). Pen strokes are opaque, so
//   overlapping pieces don't matter; highlighters have one width and are drawn as one line, see-through and
//   multiplied like on screen.
// Images are embedded (PNG as is, others re-encoded), icons as images at 300 dpi.

import type { PDFDocument, PDFImage, PDFName, PDFOperator, PDFPage } from 'pdf-lib';
import { diameter } from '#lib/ink/outline.js';
import { fillOutline, inkStrokes } from '#lib/ink/shapes.js';
import { isInk, isShape, type Background, type PageMeta, type Picture, type ShapeItem, type Stroke } from '#lib/model/types.js';
import { pictureKey } from '#lib/render/pictures.js';
import { GRID_SPACING, LINE_SPACING, PAPER_INK } from '#lib/render/paper.js';
import type { ExportSource, Progress } from './source.js';

type PdfLib = typeof import('pdf-lib');

/** Icons are rasterized at this resolution (pixels per point = 300 dpi) */
const ICON_SCALE = 300 / 72;
/** PDF pages that can't be embedded are rasterized at this scale (200 dpi) */
const RASTER_SCALE = 200 / 72;

const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const round = (n: number) => Math.round(n * 100) / 100;

export async function exportPdf(source: ExportSource, progress: Progress = () => {}): Promise<Blob> {
	const lib = await import('pdf-lib');
	const out = await lib.PDFDocument.create();
	out.setProducer('in-browser Notes');
	const writer = new Writer(lib, out, source);
	for (const [i, meta] of source.pages.entries()) {
		await writer.page(meta);
		progress((i + 1) / source.pages.length);
	}
	const bytes = await out.save();
	return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

class Writer {
	private readonly sources = new Map<string, Promise<PDFDocument | null>>();
	private readonly images = new Map<string, Promise<PDFImage | null>>();
	private readonly highlight;

	constructor(
		private readonly lib: PdfLib,
		private readonly out: PDFDocument,
		private readonly source: ExportSource
	) {
		this.highlight = out.context.register(out.context.obj({ Type: 'ExtGState', CA: 0.35, ca: 0.35, BM: 'Multiply' }));
	}

	async page(meta: PageMeta) {
		const { lib } = this;
		const page = this.out.addPage([meta.w, meta.h]);
		const highlight = page.node.newExtGState('Highlight', this.highlight);
		// Our coordinates: y downwards from the top (pushed in runs, pictures in between use pdf-lib's own)
		let run: PDFOperator[] = [];
		const flush = () => {
			if (!run.length) return;
			page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(1, 0, 0, -1, 0, meta.h), ...run, lib.popGraphicsState());
			run = [];
		};

		if (meta.background) await this.background(page, meta.background, meta);
		else run.push(...this.paper(meta));

		const scene = this.source.scene(meta.id);
		for (const item of scene?.items ?? []) {
			if (isInk(item)) {
				if (isShape(item)) run.push(...this.fill(page, item));
				for (const s of inkStrokes(item)) run.push(...this.stroke(s, highlight));
				continue;
			}
			flush();
			const image = await this.picture(item);
			if (image) page.drawImage(image, { x: item.x, y: meta.h - item.y - item.h, width: item.w, height: item.h });
		}
		flush();
	}

	// --- Background and paper ---

	private async background(page: PDFPage, bg: Background, meta: PageMeta) {
		const { lib } = this;
		try {
			let doc = this.sources.get(bg.asset);
			if (!doc) {
				doc = this.source.backgrounds.bytes(bg.asset).then((bytes) => lib.PDFDocument.load(bytes, { ignoreEncryption: true }));
				this.sources.set(bg.asset, doc);
			}
			const src = (await doc)!;
			const srcPage = src.getPage(bg.page - 1);
			const crop = srcPage.getCropBox();
			const embedded = await this.out.embedPage(srcPage, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
			const { width: w, height: h } = embedded;
			// The page's own rotation (clockwise), turned around the drawing origin and moved back into the page
			const r = (((srcPage.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
			const at = { 0: { x: 0, y: 0, a: 0 }, 90: { x: 0, y: w, a: -90 }, 180: { x: w, y: h, a: 180 }, 270: { x: h, y: 0, a: 90 } }[r] ?? { x: 0, y: 0, a: 0 };
			page.drawPage(embedded, { x: at.x, y: at.y, rotate: lib.degrees(at.a) });
		} catch (e) {
			// Encrypted or broken for pdf-lib (PDF.js can still show it): the page as an image instead
			console.warn('[notes] PDF page embedded as image', e);
			const canvas = await this.source.backgrounds.render(bg, RASTER_SCALE);
			const png = await this.out.embedPng(await canvasBytes(canvas, 'image/png'));
			page.drawImage(png, { x: 0, y: 0, width: meta.w, height: meta.h });
		}
	}

	private paper(meta: PageMeta): PDFOperator[] {
		const o = this.lib;
		const { w, h, paper } = meta;
		if (paper === 'blank') return [];
		const ops: PDFOperator[] = [o.setFillingRgbColor(...rgbOf(PAPER_INK[paper]))];
		const hair = 0.5;
		if (paper === 'lined') {
			for (let y = LINE_SPACING; y < h; y += LINE_SPACING) ops.push(o.rectangle(0, round(y), w, hair));
		} else if (paper === 'grid') {
			for (let y = GRID_SPACING; y < h; y += GRID_SPACING) ops.push(o.rectangle(0, round(y), w, hair));
			for (let x = GRID_SPACING; x < w; x += GRID_SPACING) ops.push(o.rectangle(round(x), 0, hair, h));
		} else {
			const r = 1.2;
			for (let y = GRID_SPACING; y < h; y += GRID_SPACING) {
				for (let x = GRID_SPACING; x < w; x += GRID_SPACING) ops.push(o.rectangle(round(x - r / 2), round(y - r / 2), r, r));
			}
		}
		ops.push(o.fill());
		return ops;
	}

	// --- Strokes ---

	/** See-through fills: one graphics state per opacity and page */
	private readonly opacities = new Map<PDFPage, Map<number, PDFName>>();

	private opacity(page: PDFPage, alpha: number): PDFName {
		let names = this.opacities.get(page);
		if (!names) this.opacities.set(page, (names = new Map()));
		let name = names.get(alpha);
		if (!name) {
			const state = this.out.context.register(this.out.context.obj({ Type: 'ExtGState', ca: alpha }));
			names.set(alpha, (name = page.node.newExtGState('Fill', state)));
		}
		return name;
	}

	/** The fill of a shape (under its outline) */
	private fill(page: PDFPage, s: ShapeItem): PDFOperator[] {
		const outline = fillOutline(s);
		if (!outline || !s.fill) return [];
		const o = this.lib;
		const alpha = Math.round((parseInt(s.fill.slice(7, 9), 16) / 255) * 100) / 100;
		const ops: PDFOperator[] = [o.pushGraphicsState()];
		if (alpha < 1) ops.push(o.setGraphicsState(this.opacity(page, alpha)));
		ops.push(o.setFillingRgbColor(...rgbOf(s.fill)), o.moveTo(round(outline[0]), round(outline[1])));
		for (let i = 2; i < outline.length; i += 2) ops.push(o.lineTo(round(outline[i]), round(outline[i + 1])));
		ops.push(o.closePath(), o.fill(), o.popGraphicsState());
		return ops;
	}

	private stroke(s: Stroke, highlight: PDFName): PDFOperator[] {
		const o = this.lib;
		const pts = s.points;
		const ops: PDFOperator[] = [o.pushGraphicsState()];
		if (s.tool === 'highlighter') ops.push(o.setGraphicsState(highlight));
		ops.push(o.setStrokingRgbColor(...rgbOf(s.color)), o.setLineCap(o.LineCapStyle.Round), o.setLineJoin(o.LineJoinStyle.Round));
		// The first point is a dot (a line of no length with round caps); then one line per run of equal width
		let width = round(diameter(s.tool, s.size, pts[2]));
		ops.push(o.setLineWidth(width), o.moveTo(round(pts[0]), round(pts[1])), o.lineTo(round(pts[0]), round(pts[1])));
		for (let i = 3; i < pts.length; i += 3) {
			const w = round(diameter(s.tool, s.size, pts[i + 2]));
			if (w !== width) {
				ops.push(o.stroke(), o.setLineWidth(w), o.moveTo(round(pts[i - 3]), round(pts[i - 2])));
				width = w;
			}
			ops.push(o.lineTo(round(pts[i]), round(pts[i + 1])));
		}
		ops.push(o.stroke(), o.popGraphicsState());
		return ops;
	}

	// --- Pictures ---

	private picture(p: Picture): Promise<PDFImage | null> {
		const key = pictureKey(p);
		let image = this.images.get(key);
		if (!image) {
			image = this.embedPicture(p).catch((e) => {
				console.error('[notes] picture in PDF', e);
				return null;
			});
			this.images.set(key, image);
		}
		return image;
	}

	private async embedPicture(p: Picture): Promise<PDFImage | null> {
		if (p.type === 'image') {
			const blob = await this.source.readAsset(p.asset);
			if (p.asset.endsWith('.png')) {
				try {
					return await this.out.embedPng(new Uint8Array(await blob.arrayBuffer()));
				} catch {
					// A PNG variant pdf-lib can't read: re-encoded below
				}
			}
			// Decoding applies the photo's orientation (EXIF), which PDF viewers would ignore in the raw JPEG
			const bitmap = await createImageBitmap(blob);
			const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
			canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
			bitmap.close();
			return /\.jpe?g$/.test(p.asset)
				? this.out.embedJpg(await canvasBytes(canvas, 'image/jpeg', 0.92))
				: this.out.embedPng(await canvasBytes(canvas, 'image/png'));
		}
		const icon = await this.source.pictures.load(p);
		if (!icon) return null;
		const k = Math.min(ICON_SCALE, 2048 / Math.max(p.w, p.h));
		const canvas = new OffscreenCanvas(Math.max(1, Math.round(p.w * k)), Math.max(1, Math.round(p.h * k)));
		canvas.getContext('2d')!.drawImage(icon, 0, 0, canvas.width, canvas.height);
		return this.out.embedPng(await canvasBytes(canvas, 'image/png'));
	}
}

async function canvasBytes(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
	const blob =
		canvas instanceof OffscreenCanvas
			? await canvas.convertToBlob({ type, quality })
			: await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas export failed'))), type, quality));
	return new Uint8Array(await blob.arrayBuffer());
}
