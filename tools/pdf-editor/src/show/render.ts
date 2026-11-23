// Slides as pictures for presenting: the page as the screen shows it (its own content, form values, layers and the
// annotations the editor doesn't draw itself) rendered once per size, with the comments shown at a step drawn
// over it. The same for the display, the presenter view and a phone, so all of them show the same.

import { linkView } from '#lib/render/link.js';
import { stampsSharp } from '#lib/render/stamp.js';
import { shownAt, stepView } from '#lib/render/steps.js';
import { sourceOf, type PdfDocument, type PdfPage } from '#lib/model/document.svelte.js';

/** Most pixels of a slide's picture (phones refuse larger canvases) */
const MAX_PIXELS = 16_000_000;
/** Pictures of pages kept (the current one, its neighbours and the next one asked for) */
const KEEP = 8;

interface Rendered {
	key: string;
	canvas: Promise<HTMLCanvasElement>;
}

/** Renders slides of one document and keeps the last few (going back and forth needs no new render) */
export class SlideRenderer {
	private readonly cache: Rendered[] = [];

	constructor(private readonly doc: PdfDocument) {}

	/** Pixels per point for a page shown `width` × `height` CSS pixels (fitted, at the screen's density) */
	scaleFor(page: PdfPage, width: number, height: number): number {
		const fit = Math.min(width / page.w, height / page.h) * (globalThis.devicePixelRatio || 1);
		return Math.max(0.05, Math.min(fit, Math.sqrt(MAX_PIXELS / (page.w * page.h))));
	}

	/** The page without the editor's comments, at `scale` (rendered once per page, look and size) */
	private background(page: PdfPage, scale: number): Promise<HTMLCanvasElement> {
		// Sizes close to each other share a picture (a window resized a little doesn't render anew)
		const rounded = Math.round(scale * 20) / 20;
		const key = `${page.id}|${sourceOf(page)}|${page.number}|${page.rotate}|${page.rev}|${this.doc.contentRev(page)}|${rounded}`;
		const found = this.cache.find((r) => r.key === key);
		if (found) {
			this.cache.splice(this.cache.indexOf(found), 1);
			this.cache.push(found);
			return found.canvas;
		}
		const canvas = page.number ? this.doc.renders.render(sourceOf(page), page.number, rounded) : Promise.resolve(blank(page, rounded));
		const entry = { key, canvas };
		this.cache.push(entry);
		// A failed render is tried again next time
		canvas.catch(() => this.cache.includes(entry) && this.cache.splice(this.cache.indexOf(entry), 1));
		while (this.cache.length > KEEP) this.cache.shift();
		return canvas;
	}

	/** Renders a page ahead, so going there shows it at once */
	warm(page: PdfPage, scale: number) {
		void this.background(page, scale).catch(() => {});
	}

	/**
	 * Draws a slide into `target` (resized to the picture): the page and its comments up to `step` (all of them with
	 * `step` Infinity). False when the page couldn't be rendered.
	 */
	async draw(target: HTMLCanvasElement, page: PdfPage, step: number, scale: number): Promise<boolean> {
		let bg: HTMLCanvasElement;
		try {
			bg = await this.background(page, scale);
		} catch (e) {
			console.warn('[pdf-editor] slide', e);
			return false;
		}
		const items = shownAt(this.doc.scene(page.id)?.items ?? [], step);
		if (items.length) await stampsSharp(items, bg.width / page.w);
		const ctx = target.getContext('2d');
		if (!ctx) return false;
		if (target.width !== bg.width || target.height !== bg.height) {
			target.width = bg.width;
			target.height = bg.height;
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, target.width, target.height);
		ctx.drawImage(bg, 0, 0);
		const scene = this.doc.scene(page.id);
		if (scene && items.length) {
			ctx.setTransform(bg.width / page.w, 0, 0, bg.height / page.h, 0, 0);
			// The editor's marks (links' boxes, steps) never show while presenting
			const links = linkView.shown;
			const steps = stepView.shown;
			linkView.shown = false;
			stepView.shown = false;
			try {
				scene.draw(ctx, items);
			} finally {
				linkView.shown = links;
				stepView.shown = steps;
				ctx.setTransform(1, 0, 0, 1, 0, 0);
			}
		}
		return true;
	}
}

/** A blank page: white paper */
function blank(page: PdfPage, scale: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.ceil(page.w * scale));
	canvas.height = Math.max(1, Math.ceil(page.h * scale));
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	return canvas;
}
