<script lang="ts">
	// One slide fitted into the space it is given (kept in proportion, centered): the page with its comments shown at a
	// step. What is shown stays until the next picture is ready, so going on never flashes white. The slide's
	// own box takes children on top (the pointer) and reports where the pointer is on it (0…1 across and down).
	import { untrack, type Snippet } from 'svelte';
	import type { PdfPage } from '#lib/model/document.svelte.js';
	import type { SlideRenderer } from './render.js';

	let {
		renderer,
		page,
		step,
		label,
		children,
		onpointer,
		onclick
	}: {
		renderer: SlideRenderer;
		page: PdfPage | null;
		step: number;
		label: string;
		children?: Snippet;
		/** The pointer over the slide (pressed with a finger or pen, any mouse over it); null: it left */
		onpointer?: (at: { x: number; y: number } | null) => void;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	let box = $state({ w: 0, h: 0 });
	let canvas = $state<HTMLCanvasElement>();

	const measure = (node: HTMLElement) => {
		const observer = new ResizeObserver(([entry]) => (box = { w: entry.contentRect.width, h: entry.contentRect.height }));
		observer.observe(node);
		return () => observer.disconnect();
	};

	/** The slide's size on screen (CSS pixels) */
	const fit = $derived(page && box.w > 0 && box.h > 0 ? Math.min(box.w / page.w, box.h / page.h) : 0);

	let run = 0;
	$effect(() => {
		if (!page || !canvas || !fit) return;
		const scale = renderer.scaleFor(page, box.w, box.h);
		const target = canvas;
		const current = page;
		const at = step;
		const mine = ++run;
		// The picture is drawn into an unseen canvas first: the old one stays until the new one is ready
		untrack(() => {
			const next = document.createElement('canvas');
			void renderer.draw(next, current, at, scale).then((ok) => {
				if (!ok || mine !== run) return;
				target.width = next.width;
				target.height = next.height;
				target.getContext('2d')?.drawImage(next, 0, 0);
			});
		});
	});

	function at(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
	}
</script>

<div class="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden" {@attach measure}>
	{#if page && fit}
		<!-- A click goes on (the keys do the same); the pointer follows the mouse or finger -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<div
			class="relative shrink-0 touch-none bg-white shadow"
			style="width: {page.w * fit}px; height: {page.h * fit}px"
			role="img"
			aria-label={label}
			{onclick}
			onpointermove={(e) => {
				if (!onpointer) return;
				// A mouse points while over the slide; a finger or pen while pressed
				if (e.pointerType === 'mouse' || e.buttons) onpointer(at(e));
			}}
			onpointerdown={(e) => {
				if (!onpointer || e.pointerType === 'mouse') return;
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
				onpointer(at(e));
			}}
			onpointerup={(e) => onpointer && e.pointerType !== 'mouse' && onpointer(null)}
			onpointercancel={() => onpointer?.(null)}
			onpointerleave={(e) => onpointer && e.pointerType === 'mouse' && onpointer(null)}
		>
			<canvas bind:this={canvas} class="block h-full w-full"></canvas>
			{@render children?.()}
		</div>
	{/if}
</div>
