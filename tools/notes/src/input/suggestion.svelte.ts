// Suggestion after a pen stroke that resembles a shape: "Convert to arrow" above the stroke (`ShapeSuggestion.svelte`).
// Shown until the next action on the surface, another tool, undo/redo, or a few seconds pass; it follows the view.

import { shapeName, type ShapeName } from '#lib/ink/recognize.js';
import type { ShapeFit } from '#lib/ink/shapes.js';
import type { NotebookDoc } from '#lib/model/notebook.svelte.js';
import type { Stage } from '#lib/render/stage.js';

/** How long the suggestion stays (ms) */
const SHOW_MS = 6000;

export class ShapeSuggestion {
	/** What is suggested (null: nothing) */
	name = $state<ShapeName | null>(null);
	/** The stroke's frame on screen (CSS pixels) */
	rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	private current: { page: number; id: string; fit: ShapeFit } | null = null;
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private readonly stage: Stage,
		private readonly doc: NotebookDoc
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
