<script lang="ts">
	// The elements of a drawing surface (see `render/stage.ts`): the stage's canvases, the snap guides and the brush
	// preview. Tools put their own layers on top as children (e.g. text or form fields of a PDF page).
	import SnapGuides from '@in-browser/graphics/SnapGuides.svelte';
	import type { GuideView } from '@in-browser/graphics/snap.js';
	import type { Snippet } from 'svelte';
	import type { StageElements } from '../render/stage.js';

	interface Props {
		/** Set once all elements are there */
		elements?: StageElements | null;
		/** The stage made from them: its guides are shown here */
		stage?: { onguides: ((view: GuideView | null) => void) | null } | null;
		children?: Snippet;
	}

	let { elements = $bindable(null), stage = null, children }: Props = $props();

	let guides = $state.raw<GuideView | null>(null);

	$effect(() => {
		if (!stage) return;
		stage.onguides = (view) => (guides = view);
		return () => {
			stage.onguides = null;
			guides = null;
		};
	});

	let root = $state<HTMLDivElement>();
	let base = $state<HTMLCanvasElement>();
	let live = $state<HTMLCanvasElement>();
	let marker = $state<HTMLCanvasElement>();
	let overlay = $state<HTMLCanvasElement>();
	let ghost = $state<HTMLCanvasElement>();
	let cursor = $state<HTMLDivElement>();

	$effect(() => {
		elements = root && base && live && marker && ghost && overlay && cursor ? { root, base, live, marker, ghost, overlay, cursor } : null;
	});
</script>

<!-- No browser gestures, selection, magnifier or callout on the surface (iOS needs the prefixed properties) -->
<div
	bind:this={root}
	class="bg-base-200 relative size-full touch-none overflow-hidden select-none"
	style="-webkit-user-select: none; -webkit-touch-callout: none"
	data-testid="surface"
>
	<canvas bind:this={base} class="absolute inset-0 size-full"></canvas>
	<!-- Opaque low-latency layer: only visible while a pen stroke is drawn -->
	<canvas bind:this={live} class="pointer-events-none invisible absolute inset-0 size-full"></canvas>
	<!-- Highlighter strokes: painted opaque, see-through as a whole (overlaps don't darken) -->
	<canvas bind:this={marker} class="pointer-events-none absolute inset-0 size-full"></canvas>
	<canvas bind:this={ghost} class="pointer-events-none absolute inset-0 size-full"></canvas>
	<!-- Lasso, selection frame and dragged strokes, laser pointer -->
	<canvas bind:this={overlay} class="pointer-events-none absolute inset-0 size-full"></canvas>
	{@render children?.()}
	<!-- Lines snapped to while dragging, with what they snap to -->
	<SnapGuides view={guides} />
	<!-- Brush/eraser preview over the paper (a document color, so fixed contrast colors instead of theme colors) -->
	<div
		bind:this={cursor}
		class="pointer-events-none absolute top-0 left-0 hidden rounded-full"
		style="border: 1px solid rgb(0 0 0 / 0.55); box-shadow: 0 0 0 1px rgb(255 255 255 / 0.8)"
		aria-hidden="true"
	></div>
</div>
