// Suggestion after a pen stroke that resembles a shape: "Convert to arrow" above the stroke (`ShapeSuggestion.svelte`).
// Shown until the next action on the surface, another tool, undo/redo, or a few seconds pass; it follows the view.

import { shapeName, type ShapeName } from '../recognize.js';
import type { SceneItem, SurfacePage } from '../render/kit.js';
import type { PageScene } from '../render/scene.js';
import type { Stage } from '../render/stage.js';
import type { ShapeFit } from '../shapes.js';

/** What the suggestion needs of the document */
export interface SuggestionDoc<I extends SceneItem> {
	readonly pages: readonly SurfacePage[];
	scene(id: string): PageScene<I> | null;
	/** Replaces a stroke by a shape (one undo step); the shape's id */
	toShape(pageIndex: number, strokeId: string, fit: ShapeFit): string | null;
}

/** How long the suggestion stays (ms) */
const SHOW_MS = 6000;

export class ShapeSuggestion<P extends SurfacePage, I extends SceneItem> {
	/** What is suggested (null: nothing) */
	name = $state<ShapeName | null>(null);
	/** The stroke's frame on screen (CSS pixels) */
	rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	private current: { page: number; id: string; fit: ShapeFit } | null = null;
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private readonly stage: Stage<P, I>,
		private readonly doc: SuggestionDoc<I>
	) {}

	show(suggestion: { page: number; id: string; fit: ShapeFit } | null) {
		clearTimeout(this.timer);
		this.current = suggestion;
		this.name = suggestion && shapeName(suggestion.fit);
		if (suggestion) this.timer = setTimeout(() => this.show(null), SHOW_MS);
		this.updateRect();
	}

	clear() {
		if (this.current) this.show(null);
	}

	/** Position follows the view; gone with the stroke */
	updateRect() {
		const c = this.current;
		const scene = c && this.doc.scene(this.doc.pages[c.page]?.id ?? '');
		const stroke = scene?.items.find((i) => i.id === c!.id);
		if (!c || !scene || !stroke) {
			this.current = null;
			this.name = null;
			this.rect = null;
			return;
		}
		this.rect = this.stage.boxRect(c.page, scene.bounds(stroke));
	}

	/** Replaces the stroke by the shape (one undo step); where the shape is, to select it */
	accept(): { page: number; id: string } | null {
		const c = this.current;
		this.show(null);
		const id = c && this.doc.toShape(c.page, c.id, c.fit);
		return c && id ? { page: c.page, id } : null;
	}
}
