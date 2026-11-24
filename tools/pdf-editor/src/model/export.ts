// “Export …”: pages as pictures (PNG, JPEG, WebP) or as a JW Library playlist. The names of the pictures come from a
// template with placeholders; its settings are kept per device.

import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import { uniqueName } from '@in-browser/files/path.js';
import { DEFAULT_PICTURE_SECONDS, END_ACTIONS, type EndAction } from '@in-browser/jwl/playlist.js';
import type { ImageFormat } from '@in-browser/graphics/image-formats.js';

export { canWriteWebp, IMAGE_FORMATS, type ImageFormat } from '@in-browser/graphics/image-formats.js';
export type ExportFormat = ImageFormat | 'playlist';
export const EXPORT_FORMATS: readonly ExportFormat[] = ['png', 'jpeg', 'webp', 'playlist'];

/** The placeholders of the name template – the same in every language */
export const PLACEHOLDERS = ['name', 'page', 'pages', 'date', 'time'] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export const DPI_CHOICES = [72, 96, 150, 200, 300] as const;
export const DPI_MIN = 36;
export const DPI_MAX = 600;
/** Most pixels of one picture: the largest canvas iOS Safari draws (larger pages are rendered less fine) */
export const MAX_PIXELS = 16_777_216;

export interface ExportSettings {
	format: ExportFormat;
	dpi: number;
	/** 1–100, for JPEG, WebP and the playlist's pictures */
	quality: number;
	comments: boolean;
	/** Playlist: every presentation step of a page as an item of its own (the page as it shows after each step) */
	steps: boolean;
	/** What lies under the pages' content: `#rrggbb[aa]`, `null` for nothing (see-through) */
	background: string | null;
	template: string;
	/** Playlist: how long a page is shown, and what follows */
	seconds: number;
	endAction: EndAction;
}

export const DEFAULT_EXPORT: ExportSettings = {
	format: 'png',
	dpi: 150,
	quality: 90,
	comments: true,
	steps: false,
	background: '#ffffff',
	template: '{name}_{page}',
	seconds: DEFAULT_PICTURE_SECONDS,
	endAction: 'freeze'
};

const STORE = 'pdf-editor:export';
const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

const within = (value: unknown, min: number, max: number, fallback: number) =>
	typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** The settings kept on this device; what is missing or invalid takes its default */
export function loadExportSettings(): ExportSettings {
	const s = loadJson<Partial<Record<keyof ExportSettings, unknown>>>(STORE, {});
	const d = DEFAULT_EXPORT;
	return {
		format: EXPORT_FORMATS.includes(s.format as ExportFormat) ? (s.format as ExportFormat) : d.format,
		dpi: within(s.dpi, DPI_MIN, DPI_MAX, d.dpi),
		quality: within(s.quality, 1, 100, d.quality),
		comments: typeof s.comments === 'boolean' ? s.comments : d.comments,
		steps: typeof s.steps === 'boolean' ? s.steps : d.steps,
		background: s.background === null || (typeof s.background === 'string' && COLOR.test(s.background)) ? (s.background as string | null) : d.background,
		template: typeof s.template === 'string' && s.template.trim() ? s.template : d.template,
		seconds: within(s.seconds, 1, 3600, d.seconds),
		endAction: END_ACTIONS.includes(s.endAction as EndAction) ? (s.endAction as EndAction) : d.endAction
	};
}

export function storeExportSettings(settings: ExportSettings) {
	storeJson(STORE, settings);
}

/** What the placeholders stand for */
export interface NameValues {
	/** The PDF's name without `.pdf` */
	name: string;
	/** The page's number (from 1) */
	page: number;
	/** Pages in the PDF – `{page}` gets as many digits, so the files sort in order */
	pages: number;
	date: Date;
}

const two = (n: number) => String(n).padStart(2, '0');

/** The template with its placeholders filled in (without extension); unknown `{…}` stay as they are */
export function expandName(template: string, v: NameValues): string {
	const values: Record<Placeholder, string> = {
		name: v.name,
		page: String(v.page).padStart(String(v.pages).length, '0'),
		pages: String(v.pages),
		date: `${v.date.getFullYear()}-${two(v.date.getMonth() + 1)}-${two(v.date.getDate())}`,
		time: `${two(v.date.getHours())}-${two(v.date.getMinutes())}`
	};
	return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? values[key as Placeholder] : all)).trim();
}

/**
 * The file names of the pictures of `pages` (numbers from 1) in a folder already holding `taken`: never one of
 * those, never twice – a template without `{page}` gets “ (2)”, “ (3)” …
 */
export function pictureNames(template: string, ext: string, pages: readonly number[], v: Omit<NameValues, 'page'>, taken: Iterable<string>): string[] {
	const used = [...taken];
	return pages.map((page) => {
		const name = uniqueName(`${expandName(template, { ...v, page })}.${ext}`, used);
		used.push(name);
		return name;
	});
}

/** Whether the format keeps see-through pixels (JPEG and the playlist's pictures don't) */
export const seeThrough = (format: ExportFormat) => format === 'png' || format === 'webp';

/** The background for PDF.js: nothing becomes `rgba(0,0,0,0)` – or white, and colors opaque, where the format has no transparency */
export function backgroundOf({ format, background }: Pick<ExportSettings, 'format' | 'background'>): string {
	if (seeThrough(format)) return background ?? 'rgba(0,0,0,0)';
	return background?.slice(0, 7) ?? '#ffffff';
}

/** Pixels per point for `dpi`, made smaller where the page would exceed `MAX_PIXELS` */
export function exportScale(w: number, h: number, dpi: number): { scale: number; reduced: boolean } {
	const scale = dpi / 72;
	const most = Math.sqrt(MAX_PIXELS / (w * h));
	return scale > most ? { scale: most, reduced: true } : { scale, reduced: false };
}
