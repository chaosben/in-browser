<script lang="ts" generics="P extends SurfacePage, I extends SceneItem">
	// Actions of a selection, floating above it (below when there is no room), as icons: the tool's own `actions`
	// first (e.g. writing a text box's text), then duplicate and delete. Formats (color, thickness, style) live in the
	// tools' ribbons (`InkColorButton`, `selection-commands.ts`, `InkStyleButton`). Placed by the tool over its surface
	// (positioned in the surface's pixels). `children`: more of the tool's own for the selection, at the bottom of the
	// menu – so it never covers the menu or the frame.
	import type { Snippet } from 'svelte';
	import { inkMessages } from '../i18n/index.svelte.js';
	import type { Selection } from '../input/selection.svelte.js';
	import type { SceneItem, SurfacePage } from '../render/kit.js';

	interface Props {
		selection: Selection<P, I>;
		/** The tool's own actions for the selection, before duplicate and delete */
		actions?: Snippet;
		children?: Snippet;
	}

	let { selection, actions, children }: Props = $props();
	const t = $derived(inkMessages().selection);

	const rect = $derived(selection.rect);
	/** Above the frame if there is room, else below it */
	const top = $derived(rect ? (rect.y > 100 ? rect.y - 12 : rect.y + rect.h + 12) : 0);
	const above = $derived(!!rect && rect.y > 100);
</script>

{#snippet action(label: string, icon: string, onclick: () => void, disabled = false)}
	<button class="btn btn-ghost btn-sm btn-square" {onclick} {disabled} title={label} aria-label={label}>
		<span class="{icon} size-5" aria-hidden="true"></span>
	</button>
{/snippet}

{#if rect && selection.count}
	<div
		class="bg-base-100 border-base-300 rounded-box pointer-events-auto absolute z-10 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col gap-1 border p-1 shadow-lg {above ? '-translate-y-full' : ''}"
		style="left: {Math.min(Math.max(rect.x + rect.w / 2, 150), window.innerWidth - 150)}px; top: {top}px"
		role="toolbar"
		aria-label={t.label(selection.count)}
	>
		<div class="flex items-center gap-0.5">
			{@render actions?.()}
			<!-- Always the same buttons (disabled where they don't apply), so none moves when the selection changes -->
			{@render action(t.duplicate, 'icon-[material-symbols-light--content-copy-outline]', () => selection.duplicate(), selection.fixed)}
			{@render action(t.delete, 'icon-[material-symbols-light--delete-outline]', () => selection.delete())}
		</div>
		{@render children?.()}
	</div>
{/if}
