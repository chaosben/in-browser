<script lang="ts" generics="C">
	// Side panels of a tool: a narrow rail of icons, a click opens or closes the
	// panel next to the content (its width can be dragged or set with the arrow keys; panel and width are kept as
	// `<storage>:panel`). Panels are loaded when first opened and get the tool's `context`. Phones have no rail (it
	// would cost the content its room): commands open a panel (`open`), shown as a full-screen sheet.
	// The page places it as the first child of a flex row, before the content.
	import type { Component } from 'svelte';
	import type { PanelProps, PanelSpec } from './panels.js';
	import { MediaQuery } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import { brandMessages } from './i18n/index.svelte.js';
	import { loadJson, storeJson } from './storage.js';
	import { coarsePointer } from './ui/pointer.svelte.js';

	interface Props {
		panels: PanelSpec<C>[];
		context: C;
		/** The open panel (null: none); commands set it */
		open?: string | null;
		/** The tool's storage prefix */
		storage: string;
		/** Opened on the desktop until the user chose otherwise (e.g. the folders in Files) */
		initial?: string;
	}

	let { panels, context, open = $bindable(null), storage, initial }: Props = $props();

	const t = $derived(brandMessages());
	const narrow = new MediaQuery('max-width: 639px', false);
	const phone = $derived(coarsePointer.current || narrow.current);

	const MIN = 180;
	const stored = untrack(() => loadJson<{ open?: string | null; width?: number }>(`${storage}:panel`, {}));
	let width = $state(Math.max(MIN, stored.width ?? 260));
	// Phones start without a panel (it would cover the page)
	untrack(() => {
		if (open === null && !phone) open = stored.open === undefined ? (initial ?? null) : stored.open;
	});

	const shown = $derived(panels.filter((p) => p.available?.() !== false));
	const current = $derived(shown.find((p) => p.id === open) ?? null);

	const loaded = new Map<string, Promise<Component<PanelProps<C>>>>();
	function component(spec: PanelSpec<C>) {
		let c = loaded.get(spec.id);
		if (!c) loaded.set(spec.id, (c = spec.load()));
		return c;
	}

	function store() {
		if (!phone) storeJson(`${storage}:panel`, { open, width: Math.round(width) });
	}

	function toggle(id: string) {
		open = open === id ? null : id;
		store();
	}

	function close() {
		open = null;
		store();
	}

	const maxWidth = () => Math.max(MIN, Math.round(innerWidth * 0.5));

	function resizeStart(e: PointerEvent) {
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		const x0 = e.clientX;
		const w0 = width;
		const move = (ev: PointerEvent) => (width = Math.min(maxWidth(), Math.max(MIN, w0 + ev.clientX - x0)));
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			store();
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
	}

	function resizeKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		width = Math.min(maxWidth(), Math.max(MIN, width + (e.key === 'ArrowRight' ? 20 : -20)));
		store();
	}
</script>

{#snippet body(spec: PanelSpec<C>)}
	{#await component(spec)}
		<div class="flex flex-1 items-center justify-center"><span class="loading loading-spinner loading-sm opacity-50"></span></div>
	{:then Panel}
		<div class="min-h-0 flex-1 overflow-auto"><Panel {context} {close} /></div>
	{:catch}
		<div class="p-3 text-sm opacity-70">{t.panels.failed}</div>
	{/await}
{/snippet}

{#snippet header(spec: PanelSpec<C>)}
	<div class="border-base-300 flex h-9 shrink-0 items-center gap-2 border-b pr-1 pl-3">
		<span class={[spec.icon, 'size-5 shrink-0 opacity-70']} aria-hidden="true"></span>
		<h2 class="min-w-0 flex-1 truncate text-sm font-medium">{spec.label}</h2>
		<button class="btn btn-ghost btn-sm btn-square" onclick={close} title={t.panels.close} aria-label={t.panels.close}>
			<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
		</button>
	</div>
{/snippet}

{#if phone}
	{#if current}
		<div class="bg-base-100 fixed inset-0 z-40 flex flex-col" role="dialog" aria-modal="true" aria-label={current.label} data-testid="panel">
			{@render header(current)}
			{@render body(current)}
		</div>
	{/if}
{:else}
	<nav class="border-base-300 bg-base-100 flex w-10 shrink-0 flex-col items-center gap-1 border-r py-1" aria-label={t.panels.label}>
		{#each shown as spec (spec.id)}
			<button
				class={['btn btn-ghost btn-sm btn-square', spec.id === open && 'btn-active text-primary']}
				onclick={() => toggle(spec.id)}
				title={spec.label}
				aria-label={spec.label}
				aria-pressed={spec.id === open}
				data-panel={spec.id}
			>
				<span class={[spec.icon, 'size-5']} aria-hidden="true"></span>
			</button>
		{/each}
	</nav>
	{#if current}
		<aside class="border-base-300 bg-base-100 relative flex shrink-0 flex-col border-r" style="width: {width}px" aria-label={current.label} data-testid="panel">
			{@render header(current)}
			{@render body(current)}
			<!-- Drag (or arrow keys) to change the width -->
			<button
				class="hover:bg-selection/40 focus-visible:bg-selection/40 absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize outline-none"
				aria-label={t.panels.resize}
				title={t.panels.resize}
				onpointerdown={resizeStart}
				onkeydown={resizeKey}
			></button>
		</aside>
	{/if}
{/if}
