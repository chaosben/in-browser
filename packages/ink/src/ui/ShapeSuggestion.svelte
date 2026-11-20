<script lang="ts" generics="P extends SurfacePage, I extends SceneItem">
	// The suggestion to turn a freehand stroke into a shape, floating above the stroke (below when there is no room).
	import { inkMessages } from '../i18n/index.svelte.js';
	import type { ShapeSuggestion } from '../input/suggestion.svelte.js';
	import type { SceneItem, SurfacePage } from '../render/kit.js';

	let { suggestion, onaccept }: { suggestion: ShapeSuggestion<P, I>; onaccept: (shape: { page: number; id: string }) => void } = $props();

	const m = $derived(inkMessages());

	const rect = $derived(suggestion.rect);
	const above = $derived(!!rect && rect.y > 60);
	const top = $derived(rect ? (above ? rect.y - 8 : rect.y + rect.h + 8) : 0);

	function accept() {
		const shape = suggestion.accept();
		if (shape) onaccept(shape);
	}
</script>

{#if rect && suggestion.name}
	<button
		class="btn btn-sm bg-base-100 border-base-300 pointer-events-auto absolute z-10 -translate-x-1/2 shadow-lg {above ? '-translate-y-full' : ''}"
		style="left: {Math.min(Math.max(rect.x + rect.w / 2, 110), window.innerWidth - 110)}px; top: {top}px"
		title={m.suggest.hint}
		onclick={accept}
	>
		<span class="icon-[material-symbols-light--shapes-outline] size-5" aria-hidden="true"></span>{m.suggest.label(m.suggest.names[suggestion.name])}
	</button>
{/if}
