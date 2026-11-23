<script lang="ts">
	// What the audience sees: the slide filling the screen on black, the pointer over it, black while “Black screen” is
	// on. It works on its own – keys and clicks here go on and back even when every control is gone; while a remote
	// control steers they wait (`DisplayController.local`). A slim bar at the
	// top (only while the mouse moves) holds “Full screen” and “End”; the cursor hides with it.
	import { onMount, untrack } from 'svelte';
	import { installCommandKeys, type Command } from '@in-browser/brand/commands.js';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import type { DisplayController } from './display.svelte.js';
	import { SlideRenderer } from './render.js';
	import { nextOf } from './state.js';
	import { keepAwake } from './screen.js';
	import SlideView from './SlideView.svelte';
	import PointerLayer from './PointerLayer.svelte';

	let {
		doc,
		display,
		onexit,
		hint
	}: {
		doc: PdfDocument;
		display: DisplayController;
		/** Leaves the presentation (Esc outside full screen, “End”) */
		onexit: () => void;
		/** Said below the bar while not in full screen (e.g. where to drag the window) */
		hint?: string;
	} = $props();

	// One per document (pictures of its pages are kept)
	const renderer = $derived(new SlideRenderer(doc));
	let root = $state<HTMLDivElement>();
	let bar = $state(true);
	let idle: ReturnType<typeof setTimeout> | undefined;

	const page = $derived(doc.pages[display.state.page] ?? null);
	const label = $derived(m.show.slideOf(display.state.page + 1, doc.pages.length));

	/** The bar and the cursor show while the mouse moves, and go after a moment */
	function wake() {
		bar = true;
		clearTimeout(idle);
		idle = setTimeout(() => (bar = false), 2500);
	}

	function fullscreen() {
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void (root ?? document.documentElement).requestFullscreen().catch(() => {});
	}

	onMount(() => {
		const awake = keepAwake();
		const changed = () => display.setFullscreen(!!document.fullscreenElement);
		document.addEventListener('fullscreenchange', changed);
		changed();
		wake();
		// The keys are the slides' now (a focused button of the ribbon would take the arrows)
		root?.focus();
		return () => {
			awake();
			clearTimeout(idle);
			document.removeEventListener('fullscreenchange', changed);
		};
	});

	// The next view rendered ahead (a step of the same page needs no new picture)
	$effect(() => {
		const at = nextOf({ pages: doc.pages.length, steps: (i) => doc.stepsOf(doc.pages[i].id) }, display.state);
		const next = doc.pages[at.page];
		const box = root?.getBoundingClientRect();
		if (!next || !box) return;
		untrack(() => renderer.warm(next, renderer.scaleFor(next, box.width, box.height)));
	});

	const commands: Command[] = [
		...['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n'].map((key) => ({ id: `next:${key}`, label: m.show.next, icon: 'icon-[material-symbols-light--arrow-forward]', shortcut: { key }, run: () => display.local(() => display.next()) })),
		...['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].map((key) => ({ id: `previous:${key}`, label: m.show.previous, icon: 'icon-[material-symbols-light--arrow-back]', shortcut: { key }, run: () => display.local(() => display.previous()) })),
		{ id: 'first', label: m.show.first, icon: 'icon-[material-symbols-light--first-page]', shortcut: { key: 'Home' }, run: () => display.local(() => display.first()) },
		{ id: 'last', label: m.show.last, icon: 'icon-[material-symbols-light--last-page]', shortcut: { key: 'End' }, run: () => display.local(() => display.last()) },
		...['b', '.'].map((key) => ({ id: `blank:${key}`, label: m.show.blank, icon: 'icon-[material-symbols-light--dark-mode-outline]', shortcut: { key }, run: () => display.local(() => display.setBlank(!display.state.blank)) })),
		{ id: 'fullscreen', label: m.show.fullscreen, icon: 'icon-[material-symbols-light--fullscreen]', shortcut: { key: 'f' }, run: fullscreen },
		// In full screen the browser takes Esc to leave it; outside it Esc ends the presentation
		{ id: 'exit', label: m.show.end, icon: 'icon-[material-symbols-light--close]', shortcut: { key: 'Escape' }, run: () => !document.fullscreenElement && onexit() }
	];
	$effect(() => installCommandKeys(() => commands));
</script>

<div
	bind:this={root}
	class="fixed inset-0 z-[60] flex flex-col bg-black text-white outline-none select-none"
	class:cursor-none={!bar}
	onpointermove={(e) => e.pointerType === 'mouse' && wake()}
	role="region"
	aria-label={label}
	tabindex="-1"
>
	<div class="relative min-h-0 flex-1">
		<SlideView {renderer} {page} step={display.state.step} {label} onclick={() => display.local(() => display.next())}>
			<PointerLayer pointer={display.pointer} />
		</SlideView>
		{#if display.state.blank}
			<div class="absolute inset-0 bg-black" aria-label={m.show.blank}></div>
		{/if}
	</div>
	<div class="absolute inset-x-0 top-0 flex items-start justify-end gap-2 p-3 transition-opacity duration-300" class:opacity-0={!bar} class:pointer-events-none={!bar}>
		{#if hint && !display.fullscreen}
			<p class="mr-auto max-w-xl rounded bg-black/70 px-3 py-2 text-sm">{hint}</p>
		{/if}
		<button type="button" class="btn btn-sm border-white/30 bg-black/60 text-white hover:bg-black/80" onclick={fullscreen}>
			<span class={display.fullscreen ? 'icon-[material-symbols-light--fullscreen-exit] size-5' : 'icon-[material-symbols-light--fullscreen] size-5'} aria-hidden="true"></span>
			{m.show.fullscreen}
		</button>
		<button type="button" class="btn btn-sm border-white/30 bg-black/60 text-white hover:bg-black/80" onclick={onexit}>
			<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
			{m.show.end}
		</button>
	</div>
</div>
