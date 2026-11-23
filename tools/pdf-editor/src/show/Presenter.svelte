<script lang="ts">
	// The presenter's view – on the laptop next to the projector, and on a phone as the remote control: the current
	// slide (the pointer moves over it), what comes next, the notes, the time, and large “Previous”/“Next”. It only
	// sends where to go (`ShowControl`); the slides window decides and answers. The layout follows the room it has:
	// wide (a laptop, a phone held sideways) the slide left and next slide and notes right; narrow one below the other
	// with the buttons at the bottom, in reach of a thumb.
	import { onMount } from 'svelte';
	import { installCommandKeys, type Command } from '@in-browser/brand/commands.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import Thumbnail from '#lib/panels/Thumbnail.svelte';
	import type { ShowControl } from './control.svelte.js';
	import type { PointerMode } from './protocol.js';
	import { SlideRenderer } from './render.js';
	import { atEnd, nextOf } from './state.js';
	import { keepAwake } from './screen.js';
	import { presentSettings } from './settings.svelte.js';
	import SlideView from './SlideView.svelte';
	import PointerLayer from './PointerLayer.svelte';

	let {
		doc,
		control,
		onend,
		onopen
	}: {
		doc: PdfDocument;
		control: ShowControl;
		/** Ends presenting (the slides window closes) */
		onend: () => void;
		/** Opens the slides window again (it was closed); missing where this can't (a phone) */
		onopen?: () => void;
	} = $props();

	// One per document (pictures of its pages are kept)
	const renderer = $derived(new SlideRenderer(doc));
	const deck = () => ({ pages: doc.pages.length, steps: (i: number) => doc.stepsOf(doc.pages[i]?.id ?? '') });

	const place = $derived(control.place);
	const page = $derived(doc.pages[place.page] ?? null);
	const steps = $derived(page ? doc.stepsOf(page.id) : 0);
	const upcoming = $derived(nextOf(deck(), place));
	const last = $derived(atEnd(deck(), place));
	const notes = $derived(page ? (doc.notes.get(page.id) ?? '') : '');
	const blank = $derived(control.display?.blank ?? false);

	let pointerMode = $state<PointerMode | null>(null);
	let pointer = $state<{ x: number; y: number; mode: PointerMode } | null>(null);
	let overview = $state(false);

	// The time since the start (pausable) and the clock
	let started = $state(performance.now());
	let paused = $state<number | null>(null);
	let now = $state(performance.now());
	let clock = $state(new Date());
	const elapsed = $derived(Math.max(0, (paused ?? now) - started));
	const duration = (ms: number) => {
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
		return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
	};
	const clockText = $derived(clock.toLocaleTimeString(document.documentElement.lang || undefined, { hour: '2-digit', minute: '2-digit' }));

	onMount(() => {
		const awake = keepAwake();
		const tick = setInterval(() => {
			now = performance.now();
			clock = new Date();
		}, 1000);
		return () => {
			awake();
			clearInterval(tick);
		};
	});

	function toggleTime() {
		if (paused === null) paused = performance.now();
		else {
			started += performance.now() - paused;
			paused = null;
		}
	}

	function point(at: { x: number; y: number } | null) {
		if (!pointerMode) return;
		pointer = at && { ...at, mode: pointerMode };
		control.point(at, pointerMode);
	}

	function setPointer(mode: PointerMode | null) {
		if (pointerMode && !mode) control.point(null, pointerMode);
		pointerMode = mode;
		pointer = null;
	}

	const commands: Command[] = [
		...['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n'].map((key) => ({ id: `next:${key}`, label: m.show.next, icon: 'icon-[material-symbols-light--arrow-forward]', shortcut: { key }, run: () => control.next() })),
		...['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].map((key) => ({ id: `previous:${key}`, label: m.show.previous, icon: 'icon-[material-symbols-light--arrow-back]', shortcut: { key }, run: () => control.previous() })),
		{ id: 'first', label: m.show.first, icon: 'icon-[material-symbols-light--first-page]', shortcut: { key: 'Home' }, run: () => control.goTo({ page: 0, step: 0 }) },
		{ id: 'last', label: m.show.last, icon: 'icon-[material-symbols-light--last-page]', shortcut: { key: 'End' }, run: () => control.goTo({ page: doc.pages.length - 1, step: 0 }) },
		...['b', '.'].map((key) => ({ id: `blank:${key}`, label: m.show.blank, icon: 'icon-[material-symbols-light--dark-mode-outline]', shortcut: { key }, run: () => control.blank(!blank) })),
		{ id: 'end', label: m.show.end, icon: 'icon-[material-symbols-light--close]', shortcut: { key: 'Escape' }, run: () => (overview ? (overview = false) : onend()) }
	];
	$effect(() => installCommandKeys(() => commands));

	// A remote control that found no slides for a while says why and what helps
	let long = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (long = true), 20_000);
		return () => clearTimeout(timer);
	});
	// The slides show another version of the file than this view: usually for a moment (the other side is reading
	// the new one); when it stays, say what helps
	const other = $derived(!!control.display && !!doc.fingerprint && control.display.file !== doc.fingerprint);
	let differs = $state(false);
	$effect(() => {
		if (!other) return void (differs = false);
		const timer = setTimeout(() => (differs = true), 15_000);
		return () => clearTimeout(timer);
	});
	const status = $derived.by(() => {
		if (control.gone) return onopen ? m.show.gone : m.show.remoteEnded;
		if (!control.connected) return onopen ? m.show.waiting : long ? m.show.unreachable : m.show.connecting;
		const shown = control.display;
		if (other) return differs ? m.show.otherVersion : m.show.matching;
		return null;
	});
	const big = $derived(coarsePointer.current);
</script>

<div class="bg-base-200 text-base-content fixed inset-0 z-[60] flex flex-col select-none">
	<!-- Where the presentation stands, the time and the presenter's switches -->
	<header class="bg-base-100 border-base-300 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
		<span class="font-medium tabular-nums">
			{m.show.slideOf(place.page + 1, doc.pages.length)}{#if steps}<span class="text-base-content/70 font-normal"> · {m.show.stepOf(place.step, steps)}</span>{/if}
		</span>
		<span class="flex items-center gap-1 tabular-nums" title={m.show.time}>
			<span class="icon-[material-symbols-light--timer-outline] size-5" aria-hidden="true"></span>
			<span aria-label={m.show.time}>{duration(elapsed)}</span>
			<button type="button" class="btn btn-ghost btn-xs btn-square" title={paused === null ? m.show.pauseTime : m.show.runTime} aria-label={paused === null ? m.show.pauseTime : m.show.runTime} onclick={toggleTime}>
				<span class={paused === null ? 'icon-[material-symbols-light--pause-outline] size-5' : 'icon-[material-symbols-light--play-arrow-outline] size-5'} aria-hidden="true"></span>
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square"
				title={m.show.resetTime}
				aria-label={m.show.resetTime}
				onclick={() => {
					started = performance.now();
					now = started;
					if (paused !== null) paused = started;
				}}
			>
				<span class="icon-[material-symbols-light--restart-alt] size-5" aria-hidden="true"></span>
			</button>
		</span>
		<span class="text-base-content/70 tabular-nums" title={m.show.clock}>{clockText}</span>
		<div class="ml-auto flex items-center gap-1">
			<div class="join" role="group" aria-label={m.show.pointer}>
				{#each [[null, m.show.pointerOff, 'icon-[material-symbols-light--do-not-disturb-on-outline]'], ['dot', m.show.pointerDot, 'icon-[material-symbols-light--radio-button-checked]'], ['spotlight', m.show.pointerSpotlight, 'icon-[material-symbols-light--filter-center-focus]']] as const as [mode, label, icon] (label)}
					<button type="button" class="btn join-item btn-sm" class:btn-active={pointerMode === mode} title={label} aria-label={label} aria-pressed={pointerMode === mode} onclick={() => setPointer(mode)}>
						<span class="{icon} size-5" aria-hidden="true"></span>
					</button>
				{/each}
			</div>
			<button type="button" class="btn btn-sm" class:btn-active={blank} aria-pressed={blank} title={m.show.blank} aria-label={m.show.blank} onclick={() => control.blank(!blank)}>
				<span class="icon-[material-symbols-light--dark-mode-outline] size-5" aria-hidden="true"></span>
			</button>
			<button type="button" class="btn btn-sm" title={m.show.overview} aria-label={m.show.overview} onclick={() => (overview = true)}>
				<span class="icon-[material-symbols-light--grid-view-outline] size-5" aria-hidden="true"></span>
			</button>
			<button type="button" class="btn btn-sm" onclick={onend}>
				<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
				{m.show.end}
			</button>
		</div>
	</header>

	{#if status}
		<div class="bg-warning/15 flex items-center gap-2 px-3 py-1.5 text-sm" role="status">
			<span class="icon-[material-symbols-light--info-outline] size-5 shrink-0" aria-hidden="true"></span>
			<span class="flex-1">{status}</span>
			{#if control.gone && onopen}
				<button type="button" class="btn btn-sm" onclick={onopen}>{m.show.openDisplay}</button>
			{/if}
		</div>
	{/if}

	<!-- Wide: the slide left, what comes and the notes right; narrow: one below the other -->
	<main class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-3 p-3 landscape:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] landscape:grid-rows-1">
		<section class="flex min-h-0 flex-col gap-1" aria-label={m.show.slideOf(place.page + 1, doc.pages.length)}>
			<div class="relative min-h-0 flex-1" class:opacity-60={!!control.pending}>
				<SlideView {renderer} {page} step={place.step} label={m.show.slideOf(place.page + 1, doc.pages.length)} onpointer={pointerMode ? point : undefined}>
					<PointerLayer {pointer} />
				</SlideView>
			</div>
		</section>
		<aside class="flex min-h-0 flex-col gap-3">
			<div class="flex min-h-0 flex-[2] flex-col gap-1">
				<h2 class="text-base-content/70 text-sm">{last ? m.show.theEnd : upcoming.page === place.page ? m.show.nextStep : m.show.upNext}</h2>
				<div class="min-h-0 flex-1">
					{#if !last}
						<SlideView {renderer} page={doc.pages[upcoming.page] ?? null} step={upcoming.step} label={m.show.slideOf(upcoming.page + 1, doc.pages.length)} />
					{/if}
				</div>
			</div>
			<div class="bg-base-100 flex min-h-0 flex-[3] flex-col rounded-box">
				<div class="flex items-center gap-1 px-3 pt-2">
					<h2 class="text-base-content/70 flex-1 text-sm">{m.show.notes}</h2>
					<button type="button" class="btn btn-ghost btn-xs btn-square" title={m.show.smaller} aria-label={m.show.smaller} onclick={() => presentSettings.resizeNotes(-1)}>
						<span class="icon-[material-symbols-light--text-decrease-outline] size-5" aria-hidden="true"></span>
					</button>
					<button type="button" class="btn btn-ghost btn-xs btn-square" title={m.show.larger} aria-label={m.show.larger} onclick={() => presentSettings.resizeNotes(1)}>
						<span class="icon-[material-symbols-light--text-increase-outline] size-5" aria-hidden="true"></span>
					</button>
				</div>
				<div class="min-h-0 flex-1 overflow-auto px-3 pb-3 whitespace-pre-wrap" style="font-size: {presentSettings.noteSize}px; line-height: 1.4">
					{#if notes}{notes}{:else}<span class="text-base-content/60 text-sm">{m.show.noNotes}</span>{/if}
				</div>
			</div>
		</aside>
	</main>

	<footer class="bg-base-100 border-base-300 grid grid-cols-2 gap-3 border-t p-3">
		<button type="button" class="btn" class:btn-lg={big} disabled={place.page === 0 && place.step === 0} onclick={() => control.previous()}>
			<span class="icon-[material-symbols-light--arrow-back] size-6" aria-hidden="true"></span>
			{m.show.previous}
		</button>
		<button type="button" class="btn btn-primary" class:btn-lg={big} disabled={last} onclick={() => control.next()}>
			{m.show.next}
			<span class="icon-[material-symbols-light--arrow-forward] size-6" aria-hidden="true"></span>
		</button>
	</footer>

	{#if overview}
		<div class="bg-base-200 absolute inset-0 z-10 flex flex-col">
			<div class="bg-base-100 border-base-300 flex items-center gap-2 border-b px-3 py-2">
				<h2 class="flex-1 font-medium">{m.show.overview}</h2>
				<button type="button" class="btn btn-sm" onclick={() => (overview = false)}>
					<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
					{m.show.close}
				</button>
			</div>
			<ul class="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] content-start gap-3 overflow-auto p-3">
				{#each doc.pages as p, i (p.id)}
					<li>
						<button
							type="button"
							class={['hover:bg-base-300 flex w-full flex-col items-center gap-1 rounded p-1', i === place.page && 'bg-selection/20']}
							aria-label={m.show.goToSlide(i + 1)}
							onclick={() => {
								control.goTo({ page: i, step: 0 });
								overview = false;
							}}
						>
							<Thumbnail {doc} page={p} width={136} />
							<span class="text-sm tabular-nums">{i + 1}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
