// The text of the visible PDF pages as invisible, selectable text over the rendered pages (PDF.js's `TextLayer`),
// plus search hits. Built once per page at scale 1 and only moved and scaled afterwards (`--total-scale-factor`), so
// zooming and scrolling cost a few style writes – called from the view's frame callback, never on the hot path.
// Styles: `text-layer.css`.

import type { PDFPageProxy } from 'pdfjs-dist';
import { pdfjs } from './pdfjs.js';
import type { SearchHit } from './text.js';

type Box = SearchHit['boxes'][number];
/** How text is marked */
export type MarkKind = 'highlight' | 'underline' | 'strikeout' | 'squiggly';

/** Where a page lies on screen (CSS pixels relative to the host) and its zoom */
export interface PagePlace {
	x: number;
	y: number;
	zoom: number;
	/** Page size in points (rotation applied) */
	w: number;
	h: number;
	/** Rotation in degrees the page is shown with (a change builds its text anew) */
	rotate: number;
	/** Which page stands at this place (pages moved or inserted: another key builds its text anew) */
	key?: string;
}

interface Layer {
	rotate: number;
	key?: string;
	wrapper: HTMLDivElement;
	hits: HTMLDivElement;
	mark: HTMLDivElement;
	cancel: () => void;
}

export class TextLayers {
	private readonly layers = new Map<number, Layer>();
	private hits: readonly SearchHit[] = [];
	private current: SearchHit | null = null;
	private selectable = false;
	private preview: { index: number; boxes: readonly Box[]; color: string; kind: MarkKind } | null = null;

	constructor(
		/** Element the layers are placed in (over the canvases) */
		private readonly host: HTMLElement,
		/** The page of the document shown at an index (`null`: none – a blank page, no text) */
		private readonly page: (index: number) => Promise<PDFPageProxy | null>
	) {}

	/** Shows the text of these pages where they are now; other pages' layers go */
	update(places: ReadonlyMap<number, PagePlace>) {
		for (const [index, layer] of this.layers) {
			if (places.has(index)) continue;
			layer.cancel();
			layer.wrapper.remove();
			this.layers.delete(index);
		}
		for (const [index, place] of places) {
			let layer = this.layers.get(index);
			if (layer && (layer.rotate !== place.rotate || layer.key !== place.key)) {
				layer.cancel();
				layer.wrapper.remove();
				layer = undefined;
			}
			if (!layer) this.layers.set(index, (layer = this.create(index, place.rotate, place.key)));
			const s = layer.wrapper.style;
			s.transform = `translate(${place.x}px, ${place.y}px)`;
			s.width = `${place.w * place.zoom}px`;
			s.height = `${place.h * place.zoom}px`;
			s.setProperty('--total-scale-factor', String(place.zoom));
		}
	}

	/** Text can be selected (tool "Select text"); otherwise presses go through to the surface */
	setSelectable(on: boolean) {
		this.selectable = on;
		for (const layer of this.layers.values()) layer.wrapper.style.pointerEvents = on ? 'auto' : 'none';
	}

	/** Search hits to mark (and the current one) */
	setHits(hits: readonly SearchHit[], current: SearchHit | null) {
		this.hits = hits;
		this.current = current;
		for (const [index, layer] of this.layers) this.drawHits(index, layer);
	}

	/** Shows text being marked on a page (null: none) – boxes in page points as shown */
	setPreview(preview: { index: number; boxes: readonly Box[]; color: string; kind: MarkKind } | null) {
		const before = this.preview?.index;
		this.preview = preview;
		for (const index of new Set([before, preview?.index])) {
			const layer = index === undefined ? undefined : this.layers.get(index);
			if (layer) this.drawMark(index!, layer);
		}
	}

	destroy() {
		for (const layer of this.layers.values()) {
			layer.cancel();
			layer.wrapper.remove();
		}
		this.layers.clear();
	}

	private create(index: number, rotate: number, key?: string): Layer {
		const wrapper = document.createElement('div');
		wrapper.style.cssText = 'position: absolute; left: 0; top: 0; transform-origin: 0 0';
		wrapper.style.pointerEvents = this.selectable ? 'auto' : 'none';
		const hits = document.createElement('div');
		hits.className = 'pdfHits';
		const mark = document.createElement('div');
		mark.className = 'pdfMark';
		const text = document.createElement('div');
		text.className = 'textLayer';
		text.dataset.textLayer = '';
		wrapper.append(hits, mark, text);
		this.host.append(wrapper);
		let cancelled = false;
		let task: { cancel(): void } | null = null;
		void (async () => {
			try {
				const [lib, page] = await Promise.all([pdfjs(), this.page(index)]);
				if (cancelled || !page) return;
				const layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: page.getViewport({ scale: 1, rotation: rotate }) });
				task = layer;
				await layer.render();
			} catch (e) {
				if (!cancelled && (e as { name?: string })?.name !== 'AbortException') console.warn('[pdf] text layer', index + 1, e);
			}
		})();
		const layer: Layer = {
			rotate,
			key,
			wrapper,
			hits,
			mark,
			cancel: () => {
				cancelled = true;
				task?.cancel();
			}
		};
		this.drawHits(index, layer);
		this.drawMark(index, layer);
		return layer;
	}

	private drawMark(index: number, layer: Layer) {
		const p = this.preview?.index === index ? this.preview : null;
		layer.mark.replaceChildren(
			...(p?.boxes ?? []).map((b) => {
				const div = document.createElement('div');
				const h = b.y1 - b.y0;
				// Underline and strike out: a line along the text (just below the baseline, or through lower-case letters 0.3 em
				// above it), else the whole box
				const [y0, y1] = p!.kind === 'underline' || p!.kind === 'squiggly' ? [b.y1 + h * 0.035, b.y1 + h * 0.105] : p!.kind === 'strikeout' ? [b.y0 + h * 0.665, b.y0 + h * 0.735] : [b.y0, b.y1];
				div.style.cssText =
					`left: calc(var(--total-scale-factor) * ${b.x0}px); top: calc(var(--total-scale-factor) * ${y0}px);` +
					` width: calc(var(--total-scale-factor) * ${b.x1 - b.x0}px); height: calc(var(--total-scale-factor) * ${y1 - y0}px); background: ${p!.color}`;
				return div;
			})
		);
	}

	private drawHits(index: number, layer: Layer) {
		layer.hits.replaceChildren(
			...this.hits
				.filter((hit) => hit.page === index)
				.flatMap((hit) =>
					hit.boxes.map((b) => {
						const div = document.createElement('div');
						if (hit === this.current) div.className = 'current';
						const pad = (b.y1 - b.y0) * 0.15;
						div.style.cssText =
							`left: calc(var(--total-scale-factor) * ${b.x0 - pad}px); top: calc(var(--total-scale-factor) * ${b.y0 - pad}px);` +
							` width: calc(var(--total-scale-factor) * ${b.x1 - b.x0 + 2 * pad}px); height: calc(var(--total-scale-factor) * ${b.y1 - b.y0 + 2 * pad}px)`;
						return div;
					})
				)
		);
	}
}

/** The searchable text of a page (`text.ts`), its boxes on the page as shown (`rotation`: the page's own without it) */
export async function readPageText(page: PDFPageProxy, rotation?: number) {
	const { pageText } = await import('./text.js');
	const viewport = page.getViewport({ scale: 1, rotation });
	const content = await page.getTextContent();
	const items = content.items.filter((item): item is Extract<typeof item, { str: string }> => 'str' in item);
	return pageText(items, ([x0, y0, x1, y1]) => [...viewport.convertToViewportPoint(x0, y0), ...viewport.convertToViewportPoint(x1, y1)], viewport.rotation, content.styles);
}
