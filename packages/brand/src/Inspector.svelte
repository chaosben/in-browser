<script lang="ts">
	// The inspector of a tool, on the right of the content (`ui.md` frame): the properties of the selection, else of
	// the document. Its head says “Properties”, the content starts with what it shows; the tool brings the fields (`InspectorSection`, `InspectorField`,
	// `InspectorSearchField`). The width can be dragged (or set with the arrow keys); shown or not and the width are
	// kept (`InspectorState`). Phones: a full-screen sheet while it is open (the command “Properties” opens it).
	// The page places it as the last child of a flex row, after the content.
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { brandMessages } from './i18n/index.svelte.js';
	import { MIN_WIDTH, setInspector, type InspectorState } from './inspector.svelte.js';
	import { coarsePointer } from './ui/pointer.svelte.js';

	interface Props {
		state: InspectorState;
		/** Its head (default “Properties”); the content starts with what it shows (“Clip”, “3 items”, “Project”) */
		title?: string;
		icon?: string;
		children: Snippet;
	}

	let { state: inspector, title, icon = 'icon-[material-symbols-light--tune]', children }: Props = $props();

	// svelte-ignore state_referenced_locally
	setInspector(inspector);
	const t = $derived(brandMessages().inspector);
	const narrow = new MediaQuery('max-width: 639px', false);
	const phone = $derived(coarsePointer.current || narrow.current);

	const maxWidth = () => Math.max(MIN_WIDTH, Math.round(innerWidth * 0.5));

	function resizeStart(e: PointerEvent) {
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		const x0 = e.clientX;
		const w0 = inspector.width;
		// The handle is on the left edge: dragging left widens it
		const move = (ev: PointerEvent) => (inspector.width = Math.min(maxWidth(), Math.max(MIN_WIDTH, w0 - (ev.clientX - x0))));
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			inspector.store();
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
	}

	function resizeKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		inspector.width = Math.min(maxWidth(), Math.max(MIN_WIDTH, inspector.width + (e.key === 'ArrowLeft' ? 20 : -20)));
		inspector.store();
	}
</script>

{#snippet head()}
	<div class="border-base-300 flex h-9 shrink-0 items-center gap-2 border-b pr-1 pl-3">
		<span class={[icon, 'size-5 shrink-0 opacity-70']} aria-hidden="true"></span>
		<h2 class="min-w-0 flex-1 truncate text-sm font-medium">{title ?? t.label}</h2>
		<button class="btn btn-ghost btn-sm btn-square" onclick={() => inspector.toggle()} title={t.close} aria-label={t.close}>
			<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
		</button>
	</div>
{/snippet}

{#if phone}
	{#if inspector.sheet}
		<div class="bg-base-100 fixed inset-0 z-40 flex flex-col" role="dialog" aria-modal="true" aria-label={t.label} data-testid="inspector">
			{@render head()}
			<div class="min-h-0 flex-1 overflow-y-auto">{@render children()}</div>
		</div>
	{/if}
{:else if inspector.open}
	<aside class="border-base-300 bg-base-100 relative flex shrink-0 flex-col border-l" style="width: {inspector.width}px" aria-label={t.label} data-testid="inspector">
		{@render head()}
		<div class="min-h-0 flex-1 overflow-y-auto">{@render children()}</div>
		<!-- Drag (or arrow keys) to change the width -->
		<button
			class="hover:bg-selection/40 focus-visible:bg-selection/40 absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize outline-none"
			aria-label={t.resize}
			title={t.resize}
			onpointerdown={resizeStart}
			onkeydown={resizeKey}
		></button>
	</aside>
{/if}
