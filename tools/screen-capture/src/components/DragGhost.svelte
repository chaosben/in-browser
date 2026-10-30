<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import type { Editor } from '#lib/project/editor.svelte.js';
	import type { Clip, Item } from '#lib/project/types.js';
	import { itemMedia, projectMedia, type ItemMedia } from '#lib/media/visuals.js';
	import { fontState } from '#lib/render/fonts.svelte.js';
	import { imageState } from '#lib/render/images.svelte.js';
	import { drawItemsPreview } from '#lib/render/item-preview.js';
	import { libraryUi } from '#lib/ui/library.svelte.js';

	let { editor }: { editor: Editor } = $props();

	/** The dragged elements on their own; drawn again once fonts, images, thumbnails or waveforms have loaded */
	function preview(canvas: HTMLCanvasElement, items: Item[]) {
		void fontState.version;
		void imageState.version;
		const project = untrack(() => editor.project);
		const hasPicture = (clip: Clip) => editor.source(clip.sourceId)?.hasVideo !== false;
		let media: ItemMedia | undefined;
		let cancelled = false;
		const draw = () => drawItemsPreview(canvas, items, project.width, project.height, 192, 128, media, hasPicture);
		untrack(draw);
		itemMedia(items, project.sources, projectMedia(project.id)).then((loaded) => {
			if (cancelled) return;
			media = loaded;
			draw();
		});
		return () => (cancelled = true);
	}
</script>

<!-- The dragged elements at the pointer once they left the preview or timeline; clear over a library section -->
{#if libraryUi.ghost}
	{@const g = libraryUi.ghost}
	<div
		class="bg-base-100 text-base-content rounded-box pointer-events-none fixed z-50 flex max-w-56 flex-col gap-1 border-2 p-1.5 shadow-xl transition-opacity {g.target
			? 'border-selection opacity-100'
			: 'border-base-300 opacity-75'}"
		style="left: {libraryUi.ghostAt.x + 14}px; top: {libraryUi.ghostAt.y + 14}px"
		aria-hidden="true"
	>
		<div class="bg-base-200 grid h-16 place-items-center rounded p-1">
			<canvas class="max-h-full max-w-full" {@attach (c) => preview(c, g.items)}></canvas>
		</div>
		<span class="truncate px-0.5 text-xs font-semibold">{g.label}</span>
		{#if !g.target}
			<span class="px-0.5 text-[10px] opacity-70">{m.library.dragHint}</span>
		{/if}
	</div>
{/if}
