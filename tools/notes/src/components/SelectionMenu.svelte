<script lang="ts">
	// Actions of a lasso selection, floating above it (below when there is no room): color (strokes, icons),
	// duplicate, delete.
	import { loadPalette } from '@in-browser/graphics/palette.js';
	import type { Selection } from '#lib/input/selection.svelte.js';
	import { m } from '#lib/i18n/index.js';

	let { selection }: { selection: Selection } = $props();

	/** Color row open; closed again for every new selection */
	let colors = $derived.by(() => {
		void selection.count;
		return false;
	});
	const palette = loadPalette();
	const rect = $derived(selection.rect);
	/** Above the frame if there is room, else below it */
	const top = $derived(rect ? (rect.y > 100 ? rect.y - 12 : rect.y + rect.h + 12) : 0);
	const above = $derived(!!rect && rect.y > 100);
</script>

{#if rect && selection.count}
	<div
		class="bg-base-100 border-base-300 rounded-box pointer-events-auto absolute z-10 flex -translate-x-1/2 flex-col gap-1 border p-1 shadow-lg {above ? '-translate-y-full' : ''}"
		style="left: {Math.min(Math.max(rect.x + rect.w / 2, 120), window.innerWidth - 120)}px; top: {top}px"
		role="toolbar"
		aria-label={m.selection.label(selection.count)}
	>
		<div class="flex items-center gap-0.5">
			{#if selection.colorable}
				<button class="btn btn-ghost btn-sm {colors ? 'btn-active' : ''}" onclick={() => (colors = !colors)} aria-expanded={colors}>
					<span class="icon-[material-symbols-light--palette-outline] size-5" aria-hidden="true"></span>{m.selection.color}
				</button>
			{/if}
			<button class="btn btn-ghost btn-sm" onclick={() => selection.duplicate()}>
				<span class="icon-[material-symbols-light--content-copy-outline] size-5" aria-hidden="true"></span>{m.selection.duplicate}
			</button>
			<button class="btn btn-ghost btn-sm" onclick={() => selection.delete()}>
				<span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span>{m.selection.delete}
			</button>
		</div>
		{#if colors && selection.colorable}
			<div class="flex flex-wrap items-center gap-1 px-1 pb-1" role="group" aria-label={m.selection.color}>
				{#each palette as color (color)}
					<button
						class="border-base-content/30 size-7 rounded border"
						style="background: {color}"
						onclick={() => selection.recolor(color)}
						aria-label={color}
						title={color}
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
