<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import { SPLIT } from '#lib/workspace.svelte.js';

	// Text and view side by side, with a divider that moves by mouse, finger or arrow keys (double-click: half and
	// half). Either side can be hidden; both stay mounted so the editor keeps its state.

	let {
		share,
		onshare,
		showText,
		showView,
		text,
		view
	}: {
		/** Share of the width the text gets */
		share: number;
		onshare: (share: number) => void;
		showText: boolean;
		showView: boolean;
		text: Snippet;
		view: Snippet;
	} = $props();

	let box = $state<HTMLElement>();
	let dragging = $state(false);
	const both = $derived(showText && showView);

	function shareAt(x: number) {
		const rect = box!.getBoundingClientRect();
		return (x - rect.left) / rect.width;
	}

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = true;
	}

	function move(e: PointerEvent) {
		if (dragging) onshare(shareAt(e.clientX));
	}

	function key(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.1 : 0.02;
		if (e.key === 'ArrowLeft') onshare(share - step);
		else if (e.key === 'ArrowRight') onshare(share + step);
		else if (e.key === 'Home') onshare(SPLIT.min);
		else if (e.key === 'End') onshare(SPLIT.max);
		else return;
		e.preventDefault();
	}
</script>

<div bind:this={box} class={['flex min-h-0 flex-1', dragging && 'cursor-col-resize select-none']}>
	<div class={['min-w-0', !showText && 'hidden', both ? 'shrink-0' : 'flex-1']} style:width={both ? `${share * 100}%` : undefined}>
		{@render text()}
	</div>
	{#if both}
		<!-- A focusable separator is the ARIA window splitter pattern -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			role="separator"
			tabindex="0"
			aria-orientation="vertical"
			aria-label={m.views.divider}
			aria-valuemin={SPLIT.min * 100}
			aria-valuemax={SPLIT.max * 100}
			aria-valuenow={Math.round(share * 100)}
			title={m.views.divider}
			class="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize touch-none outline-none pointer-coarse:-mx-2 pointer-coarse:w-4"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={() => (dragging = false)}
			onpointercancel={() => (dragging = false)}
			ondblclick={() => onshare(SPLIT.default)}
			onkeydown={key}
		>
			<div
				class={[
					'bg-base-300 group-hover:bg-selection group-focus-visible:bg-selection absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors',
					dragging && 'bg-selection w-0.5'
				]}
			></div>
		</div>
	{/if}
	<div class={['min-w-0 flex-1', !showView && 'hidden']}>
		{@render view()}
	</div>
</div>
