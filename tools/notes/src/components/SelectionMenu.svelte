<script lang="ts">
	// Actions of a selection, floating above it (below when there is no room): color (strokes, shapes, icons),
	// thickness (strokes, shapes), style (shapes: fill, line style, hand-drawn, arrowheads), duplicate, delete.
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import type { Selection } from '#lib/input/selection.svelte.js';
	import { PEN_SIZES } from '#lib/model/tools.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import ShapeStyleFields from './ShapeStyleFields.svelte';

	let { selection }: { selection: Selection } = $props();

	/** Open panel; closed again for every new selection */
	let panel = $derived.by((): 'color' | 'size' | 'style' | null => {
		void selection.count;
		return null;
	});
	const toggle = (p: 'color' | 'size' | 'style') => (panel = panel === p ? null : p);
	const rect = $derived(selection.rect);
	/** Above the frame if there is room, else below it */
	const top = $derived(rect ? (rect.y > 100 ? rect.y - 12 : rect.y + rect.h + 12) : 0);
	const above = $derived(!!rect && rect.y > 100);
	const largest = PEN_SIZES[PEN_SIZES.length - 1];
	/** Dot size of a thickness choice (pixels) */
	const dot = (size: number) => 4 + (size / largest) * 20;
</script>

{#snippet action(label: string, icon: string, onclick: () => void, open?: boolean)}
	<!-- Labels from `sm` on; on phones only icons, so the row fits -->
	<button class="btn btn-ghost btn-sm max-sm:px-2 {open ? 'btn-active' : ''}" {onclick} title={label} aria-label={label} aria-expanded={open}>
		<span class="{icon} size-5" aria-hidden="true"></span><span class="max-sm:hidden">{label}</span>
	</button>
{/snippet}

{#if rect && selection.count}
	<div
		class="bg-base-100 border-base-300 rounded-box pointer-events-auto absolute z-10 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col gap-1 border p-1 shadow-lg {above ? '-translate-y-full' : ''}"
		style="left: {Math.min(Math.max(rect.x + rect.w / 2, 150), window.innerWidth - 150)}px; top: {top}px"
		role="toolbar"
		aria-label={m.selection.label(selection.count)}
	>
		<div class="flex items-center gap-0.5">
			{#if selection.colorable}
				{@render action(m.selection.color, 'icon-[material-symbols-light--palette-outline]', () => toggle('color'), panel === 'color')}
			{/if}
			{#if selection.size}
				{@render action(m.selection.size, 'icon-[material-symbols-light--line-weight]', () => toggle('size'), panel === 'size')}
			{/if}
			{#if selection.shapes.any}
				{@render action(m.selection.style, 'icon-[material-symbols-light--line-style]', () => toggle('style'), panel === 'style')}
			{/if}
			{@render action(m.selection.duplicate, 'icon-[material-symbols-light--content-copy-outline]', () => selection.duplicate())}
			{@render action(m.selection.delete, 'icon-[material-symbols-light--delete-outline]', () => selection.delete())}
		</div>
		{#if panel === 'color' && selection.colorable}
			<!-- The suite's color field (palette, recent colors, picker); one undo step per chosen color -->
			<div class="w-72 max-w-[calc(100vw-2rem)] px-2 pb-2" role="group" aria-label={m.selection.color}>
				<ColorField value={selection.color} opaque onchange={(v, final) => v && final && selection.recolor(v.slice(0, 7))} />
			</div>
		{:else if panel === 'size' && selection.size}
			<div class="flex items-center justify-center gap-1 px-2 pb-1" role="group" aria-label={m.selection.size}>
				{#each PEN_SIZES as size (size)}
					<button
						class="btn btn-ghost btn-square {selection.size === size ? 'btn-active' : ''}"
						onclick={() => selection.resize(size)}
						aria-label={m.tools.sizeValue(size)}
						aria-pressed={selection.size === size}
					>
						<span class="rounded-full" style="background: {selection.color}; width: {dot(size)}px; height: {dot(size)}px"></span>
					</button>
				{/each}
			</div>
		{:else if panel === 'style' && selection.shapes.any}
			<div class="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 px-2 pb-2" role="group" aria-label={m.selection.style}>
				<ShapeStyleFields
					style={selection.style}
					fillable={selection.shapes.fillable}
					onchange={(style, final) => final && selection.restyle(style)}
					heads={selection.shapes.lines ? selection.heads : null}
					onheads={(start, end) => selection.setHeads(start, end)}
				/>
			</div>
		{/if}
	</div>
{/if}
