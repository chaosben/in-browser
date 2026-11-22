// What is picked of a page's own content, drawn over the pages: outlines of the objects, the frame around them with
// its corner handles, the frame dragged open. Plain DOM placed like the text layers (no Svelte on the view's path).

import type { Box } from '@in-browser/ink/geometry.js';
import type { PagePlace } from '@in-browser/pdf/text-layer.js';

export interface ContentMark {
	/** Page index */
	index: number;
	/** Page points as shown */
	box: Box;
	kind: 'object' | 'hover' | 'frame' | 'band';
}

const CLASSES: Record<ContentMark['kind'], string> = {
	object: 'absolute border border-selection/70',
	hover: 'absolute border border-dashed border-selection',
	frame: 'absolute border-2 border-selection',
	band: 'absolute border border-selection bg-selection/10'
};
const HANDLES = ['-top-1.5 -left-1.5', '-top-1.5 -right-1.5', '-bottom-1.5 -right-1.5', '-bottom-1.5 -left-1.5'];

export class ContentOverlay {
	private places: ReadonlyMap<number, PagePlace> = new Map();
	private marks: readonly ContentMark[] = [];
	/** A picture of objects shown moved: the whole page's size, changed by `matrix` (page points as shown) */
	private lifted: { index: number; canvas: HTMLCanvasElement; matrix: readonly number[] } | null = null;

	constructor(private readonly host: HTMLElement) {}

	/** The pages where they are now */
	update(places: ReadonlyMap<number, PagePlace>) {
		this.places = places;
		if (this.marks.length || this.lifted) this.draw();
	}

	lift(lifted: { index: number; canvas: HTMLCanvasElement; matrix: readonly number[] } | null) {
		if (!lifted && !this.lifted) return;
		this.lifted = lifted;
		this.draw();
	}

	set(marks: readonly ContentMark[]) {
		if (!marks.length && !this.marks.length) return;
		this.marks = marks;
		this.draw();
	}

	private draw() {
		const nodes: HTMLElement[] = [];
		const lifted = this.lifted;
		const at = lifted && this.places.get(lifted.index);
		if (lifted && at) {
			const [a, b, c, d, e, f] = lifted.matrix;
			const el = lifted.canvas;
			el.className = 'absolute top-0 left-0 origin-top-left opacity-80';
			el.style.width = `${at.w * at.zoom}px`;
			el.style.height = `${at.h * at.zoom}px`;
			// The page's place, then the change in page points
			el.style.transform = `translate(${at.x}px, ${at.y}px) matrix(${a}, ${b}, ${c}, ${d}, ${e * at.zoom}, ${f * at.zoom})`;
			nodes.push(el);
		}
		for (const mark of this.marks) {
			const place = this.places.get(mark.index);
			if (!place) continue;
			const el = document.createElement('div');
			el.className = CLASSES[mark.kind];
			el.dataset.content = mark.kind;
			el.style.left = `${place.x + mark.box.x0 * place.zoom}px`;
			el.style.top = `${place.y + mark.box.y0 * place.zoom}px`;
			el.style.width = `${(mark.box.x1 - mark.box.x0) * place.zoom}px`;
			el.style.height = `${(mark.box.y1 - mark.box.y0) * place.zoom}px`;
			if (mark.kind === 'frame') {
				for (const at of HANDLES) {
					const handle = document.createElement('span');
					handle.className = `absolute size-3 rounded-sm border border-selection bg-base-100 ${at}`;
					el.append(handle);
				}
			}
			nodes.push(el);
		}
		this.host.replaceChildren(...nodes);
	}
}
