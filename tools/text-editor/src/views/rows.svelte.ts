import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';

/**
 * Rows of a fixed height in a scroller, of which only those in sight (and a few around them) are rendered. Bind
 * `scroller` and `viewHeight` to the scrolling element and call `onscroll` from it.
 */
export class VisibleRows {
	#count: () => number;
	scroller = $state<HTMLElement>();
	scrollTop = $state(0);
	viewHeight = $state(0);
	readonly height = $derived(coarsePointer.current ? 40 : 28);
	/** First and end index of the rows to render */
	readonly first = $derived(Math.max(0, Math.floor(this.scrollTop / this.height) - 5));
	readonly last = $derived.by(() => Math.min(this.#count(), Math.ceil((this.scrollTop + this.viewHeight) / this.height) + 5));

	constructor(count: () => number) {
		this.#count = count;
	}

	onscroll = () => {
		this.scrollTop = this.scroller!.scrollTop;
	};
}
