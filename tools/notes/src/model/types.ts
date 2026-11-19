// A notebook is a package in the shared file system (see @in-browser/files):
//   <folder>/<Name>.note/project.json      notebook: page order, sizes, paper, PDF page under it (small, rewritten)
//   <folder>/<Name>.note/pages/<id>.json   content of one page: strokes, shapes and pictures in draw order (rewritten as a whole)
//   <folder>/<Name>.note/assets/<file>     images and imported PDFs (only ever added under new names, never overwritten)
// Coordinates are PDF points (1/72 inch, A4 = 595 × 842) with the origin at the page's top left.

import type { IconData } from '@in-browser/graphics/icons/types.js';
import { DASHES, parseFit, type Dash, type ShapeFit } from '#lib/ink/shapes.js';
import { FormatError, migrateFormat, type RawDocument } from '@in-browser/files/formats.js';

export const FORMAT = 'notes';
export const VERSION = 1;
export const NOTEBOOK_EXT = '.note';

export const A4 = { w: 595, h: 842 } as const;

/** Page sizes to choose from (portrait, points) */
export const PAGE_SIZES = {
	a4: A4,
	a5: { w: 420, h: 595 },
	a3: { w: 842, h: 1191 },
	letter: { w: 612, h: 792 }
} as const;
export type PageSize = keyof typeof PAGE_SIZES;

/** Which of the sizes a page has (either orientation), null for others (e.g. imported PDF pages) */
export function pageSizeOf(page: { w: number; h: number }): { size: PageSize; landscape: boolean } | null {
	for (const [size, s] of Object.entries(PAGE_SIZES) as [PageSize, { w: number; h: number }][]) {
		if (Math.abs(page.w - s.w) < 1 && Math.abs(page.h - s.h) < 1) return { size, landscape: false };
		if (Math.abs(page.w - s.h) < 1 && Math.abs(page.h - s.w) < 1) return { size, landscape: true };
	}
	return null;
}

/** Points of a size in an orientation */
export function pageSize(size: PageSize, landscape: boolean): { w: number; h: number } {
	const s = PAGE_SIZES[size];
	return landscape ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

export type Paper = 'blank' | 'lined' | 'grid' | 'dotted';
export const PAPERS: readonly Paper[] = ['blank', 'lined', 'grid', 'dotted'];

/** A page of a PDF in the notebook's assets, shown under the page's content (imported PDFs) */
export interface Background {
	asset: string;
	/** Page number in the PDF, from 1 */
	page: number;
}

export interface PageMeta {
	id: string;
	w: number;
	h: number;
	paper: Paper;
	background?: Background;
}

export interface Notebook {
	format: typeof FORMAT;
	version: typeof VERSION;
	createdAt: number;
	updatedAt: number;
	pages: PageMeta[];
}

export type InkTool = 'pen' | 'highlighter';

export interface Stroke {
	id: string;
	tool: InkTool;
	/** `#rrggbb` */
	color: string;
	/** Base diameter in points */
	size: number;
	/** x, y, pressure (0…1) per point */
	points: Float32Array;
}

/** A geometric shape (line, arrow, polygon, ellipse …), drawn like pen strokes along its outline (`inkStrokes`) */
export interface ShapeItem {
	id: string;
	type: 'shape';
	fit: ShapeFit;
	/** `#rrggbb` */
	color: string;
	/** Pen diameter in points */
	size: number;
	/** `#rrggbbaa` inside (closed shapes only); none when missing */
	fill?: string;
	/** Solid when missing */
	dash?: Exclude<Dash, 'solid'>;
	/** Hand-drawn instead of exact */
	sketch?: true;
}

/** A picture on a page: a box in page points (top left, size), drawn stretched into it */
interface PictureBase {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** An image file of the notebook (`assets/<asset>`) */
export interface ImageItem extends PictureBase {
	type: 'image';
	asset: string;
}

/** An icon: its SVG travels along (no icon set needed to show it), drawn in one color */
export interface IconItem extends PictureBase {
	type: 'icon';
	icon: IconData;
	/** `#rrggbb` */
	color: string;
}

export type Picture = ImageItem | IconItem;

/** Everything on a page, in draw order (later on top) */
export type Item = Stroke | ShapeItem | Picture;

/** What is drawn with a pen: erasable, drawn as strokes (`inkOf` in `ink/shapes.ts`) */
export type Ink = Stroke | ShapeItem;

export const isStroke = (item: Item): item is Stroke => 'points' in item;
export const isShape = (item: Item): item is ShapeItem => 'type' in item && item.type === 'shape';
export const isInk = (item: Item): item is Ink => isStroke(item) || isShape(item);
export const isPicture = (item: Item): item is Picture => !isInk(item);

export interface PageContent {
	items: Item[];
}

/** Version of the page files; points are stored as drawn, i.e. already smoothed (see `ink/smooth.ts`) */
const PAGE_VERSION = 1;

export { FormatError };

/** Steps from version n to n + 1 (none yet) */
const MIGRATIONS: Record<number, (p: RawDocument) => RawDocument> = {};

/** Asset names are plain file names inside `assets/` */
const ASSET = /^[\w.-]+$/;

const isPaper = (v: unknown): v is Paper => PAPERS.includes(v as Paper);

export function parseNotebook(raw: unknown): Notebook {
	const p = migrateFormat(raw, FORMAT, VERSION, MIGRATIONS);
	if (!Array.isArray(p.pages)) throw new FormatError('unknown');
	const pages = (p.pages as Partial<PageMeta>[])
		.filter((page) => typeof page?.id === 'string')
		.map((page): PageMeta => {
			const meta: PageMeta = {
				id: page.id!,
				w: Number(page.w) > 0 ? Number(page.w) : A4.w,
				h: Number(page.h) > 0 ? Number(page.h) : A4.h,
				paper: isPaper(page.paper) ? page.paper : 'blank'
			};
			const bg = page.background;
			if (bg && typeof bg.asset === 'string' && ASSET.test(bg.asset) && Number.isInteger(bg.page) && bg.page >= 1) {
				meta.background = { asset: bg.asset, page: bg.page };
			}
			return meta;
		});
	return {
		format: FORMAT,
		version: VERSION,
		createdAt: Number(p.createdAt) || 0,
		updatedAt: Number(p.updatedAt) || 0,
		pages
	};
}

export function newPage(paper: Paper = 'lined', size: { w: number; h: number } = A4): PageMeta {
	return { id: crypto.randomUUID(), w: size.w, h: size.h, paper };
}

export function newNotebook(now = Date.now()): Notebook {
	return { format: FORMAT, version: VERSION, createdAt: now, updatedAt: now, pages: [newPage()] };
}

// --- Page files: points quantized (0.1 pt, pressure in 1/255) and delta-encoded – compact JSON ---

interface RawStroke {
	id: string;
	tool: InkTool;
	color: string;
	size: number;
	pts: number[];
}

export function encodePoints(points: Float32Array): number[] {
	const out: number[] = new Array(points.length);
	let px = 0;
	let py = 0;
	let pp = 0;
	for (let i = 0; i < points.length; i += 3) {
		const x = Math.round(points[i] * 10);
		const y = Math.round(points[i + 1] * 10);
		const p = Math.round(points[i + 2] * 255);
		out[i] = x - px;
		out[i + 1] = y - py;
		out[i + 2] = p - pp;
		px = x;
		py = y;
		pp = p;
	}
	return out;
}

export function decodePoints(pts: readonly number[]): Float32Array {
	const n = pts.length - (pts.length % 3);
	const out = new Float32Array(n);
	let x = 0;
	let y = 0;
	let p = 0;
	for (let i = 0; i < n; i += 3) {
		x += pts[i];
		y += pts[i + 1];
		p += pts[i + 2];
		out[i] = x / 10;
		out[i + 1] = y / 10;
		out[i + 2] = p / 255;
	}
	return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Strokes are stored without `type` (compact), shapes and pictures with it */
export function serializePage(content: PageContent): string {
	const items = content.items.map((item): RawStroke | ShapeItem | Picture => {
		if (isStroke(item)) return { id: item.id, tool: item.tool, color: item.color, size: round(item.size), pts: encodePoints(item.points) };
		if (isShape(item)) return { ...item, fit: parseFit(item.fit)!, size: round(item.size) };
		const box = { x: round(item.x), y: round(item.y), w: round(item.w), h: round(item.h) };
		return item.type === 'image'
			? { id: item.id, type: 'image', asset: item.asset, ...box }
			: { id: item.id, type: 'icon', icon: item.icon, color: item.color, ...box };
	});
	return JSON.stringify({ version: PAGE_VERSION, items });
}

const HEX = /^#[0-9a-f]{6}$/;
const FILL = /^#[0-9a-f]{8}$/;

function parseItem(raw: unknown): Item | null {
	const r = raw as Record<string, unknown> | null;
	if (!r || typeof r !== 'object' || typeof r.id !== 'string') return null;
	const color = typeof r.color === 'string' && HEX.test(r.color) ? r.color : '#000000';
	if (r.type === 'shape') {
		const fit = parseFit(r.fit);
		if (!fit) return null;
		const shape: ShapeItem = { id: r.id, type: 'shape', fit, color, size: Number(r.size) > 0 ? Number(r.size) : 2 };
		if (typeof r.fill === 'string' && FILL.test(r.fill) && fit.kind !== 'line') shape.fill = r.fill;
		if (r.dash !== 'solid' && DASHES.includes(r.dash as Dash)) shape.dash = r.dash as ShapeItem['dash'];
		if (r.sketch === true) shape.sketch = true;
		return shape;
	}
	if (r.type === 'image' || r.type === 'icon') {
		const [x, y, w, h] = [r.x, r.y, r.w, r.h].map(Number);
		if (![x, y].every(Number.isFinite) || !(w > 0) || !(h > 0)) return null;
		if (r.type === 'image') return typeof r.asset === 'string' && ASSET.test(r.asset) ? { id: r.id, type: 'image', asset: r.asset, x, y, w, h } : null;
		const icon = r.icon as Partial<IconData> | null;
		if (!icon || typeof icon.body !== 'string' || !(Number(icon.width) > 0) || !(Number(icon.height) > 0)) return null;
		return {
			id: r.id,
			type: 'icon',
			icon: { name: String(icon.name ?? ''), body: icon.body, width: Number(icon.width), height: Number(icon.height) },
			color,
			x,
			y,
			w,
			h
		};
	}
	if (!Array.isArray(r.pts) || r.pts.length < 3) return null;
	return {
		id: r.id,
		tool: r.tool === 'highlighter' ? 'highlighter' : 'pen',
		color,
		size: Number(r.size) > 0 ? Number(r.size) : 2,
		points: decodePoints(r.pts as number[])
	};
}

export function parsePage(raw: unknown): PageContent {
	const p = raw as { version?: unknown; items?: unknown };
	if (!p || typeof p !== 'object' || typeof p.version !== 'number') throw new FormatError('unknown');
	if (p.version > PAGE_VERSION) throw new FormatError('newer');
	const items = (Array.isArray(p.items) ? p.items : []).map(parseItem).filter((i): i is Item => i !== null);
	return { items };
}

/** Asset files the page list uses (PDFs under pages) */
export const backgroundAssets = (notebook: Notebook): string[] => notebook.pages.flatMap((p) => (p.background ? [p.background.asset] : []));

/** Asset files a page uses */
export const assetsOf = (content: PageContent): string[] => content.items.flatMap((i) => (isPicture(i) && i.type === 'image' ? [i.asset] : []));
