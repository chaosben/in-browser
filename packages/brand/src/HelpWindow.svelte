<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { helpSearchTexts, type HelpContent } from './help.js';
	import type { HelpState } from './help.svelte.js';
	import HelpEntry from './HelpEntry.svelte';
	import { brandMessages } from './i18n/index.svelte.js';
	import { coarsePointer } from './ui/pointer.svelte.js';
	import { matchesQuery } from './ui/search.js';

	interface Props {
		/** Topics of the tool (its `m.help`) */
		content: HelpContent;
		help: HelpState;
		/** The same help as a page (`/help/<tool>`), linked at the bottom */
		page: string;
		/** Desktop: CSS position before the user moves the window (e.g. left of a side panel) */
		anchor?: string;
	}

	let { content, help, page, anchor = 'right: 1rem; top: 3rem' }: Props = $props();

	const t = $derived(brandMessages());
	const narrow = new MediaQuery('max-width: 40rem', false);
	/** Phones: a full-screen modal instead of the floating window (no dragging, no resizing) */
	const compact = $derived(coarsePointer.current || narrow.current);

	let dialog = $state<HTMLDialogElement>();
	let query = $state('');

	const topics = $derived(Object.entries(content));
	const current = $derived(topics.find(([id]) => id === help.topic) ?? topics[0]);
	/** While searching: the matching entries of all topics */
	const results = $derived.by(() => {
		if (!query.trim()) return null;
		return topics.flatMap(([id, topic]) =>
			Object.entries(topic.items)
				.filter(([, item]) => matchesQuery(query, topic.title, ...helpSearchTexts(item)))
				.map(([key, item]) => ({ id: `${id}.${key}`, topicId: id, topic: topic.title, item }))
		);
	});

	// Desktop: not modal, the tool stays usable next to it. Phone: modal over everything.
	$effect(() => {
		if (!dialog) return;
		if (help.open && !dialog.open) {
			if (compact) dialog.showModal();
			else dialog.show();
		} else if (!help.open && dialog.open) dialog.close();
	});

	/** Keeps at least the title bar on screen */
	function clampPos(x: number, y: number) {
		return { x: Math.min(Math.max(x, 0), window.innerWidth - 160), y: Math.min(Math.max(y, 0), window.innerHeight - 48) };
	}

	/** Title bar: drag to move the window */
	function dragWindow(e: PointerEvent) {
		if (compact || !dialog || e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = dialog.getBoundingClientRect();
		const offsetX = e.clientX - rect.left;
		const offsetY = e.clientY - rect.top;
		const move = (ev: PointerEvent) => (help.pos = clampPos(ev.clientX - offsetX, ev.clientY - offsetY));
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
			help.save();
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	/** Remembers the size the user gave the window (CSS `resize`) */
	function trackSize(node: HTMLElement) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const observer = new ResizeObserver(() => {
			if (compact || !node.offsetWidth) return;
			help.size = { w: node.offsetWidth, h: node.offsetHeight };
			clearTimeout(timer);
			timer = setTimeout(() => help.save(), 300);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			clearTimeout(timer);
		};
	}

	function showTopic(id: string) {
		help.topic = id;
		help.save();
	}

	const place = $derived(
		compact
			? ''
			: `${help.pos ? `left: ${help.pos.x}px; top: ${help.pos.y}px` : `left: auto; ${anchor}`}; width: ${help.size.w}px; height: ${help.size.h}px`
	);
</script>

{#snippet search(cls: string)}
	<label class="input input-sm {cls} cursor-text">
		<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
		<input type="search" class="grow" placeholder={t.help.search} aria-label={t.help.search} bind:value={query} />
	</label>
{/snippet}

<!-- Help window of a tool (one per layout); the same texts are the page `page` -->
<dialog
	bind:this={dialog}
	{@attach trackSize}
	class={[
		'bg-base-100 text-base-content m-0 flex-col overflow-hidden p-0 open:flex',
		compact
			? 'fixed inset-0 h-dvh max-h-none w-screen max-w-none'
			: 'border-base-300 rounded-box fixed z-40 max-h-[calc(100vh-1rem)] min-h-60 max-w-[calc(100vw-1rem)] min-w-80 resize border shadow-xl'
	]}
	style={place}
	aria-labelledby="help-title"
	onclose={() => (help.open = false)}
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		// Not the tool's Esc (e.g. deselect)
		e.preventDefault();
		e.stopPropagation();
		if (query) query = '';
		else help.open = false;
	}}
>
	<!-- Title bar: drag handle on the desktop -->
	<div
		class={['bg-base-200 flex items-center gap-2 py-1.5 pr-1.5 pl-3', !compact && 'cursor-move']}
		onpointerdown={dragWindow}
		title={compact ? undefined : t.help.move}
		role="presentation"
	>
		<span class="icon-[material-symbols-light--help-outline] size-5" aria-hidden="true"></span>
		<h2 id="help-title" class="font-semibold">{t.help.title}</h2>
		{#if !compact}{@render search('ml-auto w-56')}{/if}
		<a
			class={['btn btn-ghost btn-sm btn-square', compact && 'ml-auto']}
			href={page}
			target="_blank"
			rel="noopener"
			title={t.help.asPage}
			aria-label={t.help.asPage}
		>
			<span class="icon-[material-symbols-light--open-in-new] size-5" aria-hidden="true"></span>
		</a>
		<button class="btn btn-ghost btn-sm btn-square" onclick={() => (help.open = false)} title={t.help.close} aria-label={t.help.close}>
			<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
		</button>
	</div>

	{#if compact}
		<div class="border-base-300 flex flex-col gap-2 border-b p-2">
			{@render search('w-full')}
			{#if !results}
				<select
					class="select select-sm w-full"
					aria-label={t.help.topics}
					value={current?.[0]}
					onchange={(e) => showTopic(e.currentTarget.value)}
				>
					{#each topics as [id, topic] (id)}
						<option value={id}>{topic.title}</option>
					{/each}
				</select>
			{/if}
		</div>
	{/if}

	<div class="flex min-h-0 flex-1">
		{#if results}
			<section class="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
				{#each results as r (r.id)}
					<div class="hover:bg-base-200 rounded-field flex flex-col gap-1 p-2">
						<button
							class="link link-hover w-fit text-left text-xs opacity-60"
							onclick={() => {
								showTopic(r.topicId);
								query = '';
							}}
						>
							{r.topic}
						</button>
						<HelpEntry item={r.item} newTab />
					</div>
				{:else}
					<p class="text-sm opacity-70">{t.help.noMatches}</p>
				{/each}
			</section>
		{:else if current}
			{#if !compact}
				<nav class="border-base-300 w-44 shrink-0 overflow-y-auto border-r p-2" aria-label={t.help.topics}>
					<ul class="menu menu-sm w-full p-0">
						{#each topics as [id, topic] (id)}
							<li>
								<button
									class={id === current[0] ? 'menu-active' : ''}
									aria-current={id === current[0] ? 'true' : undefined}
									onclick={() => showTopic(id)}
								>
									{topic.title}
								</button>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}
			<section class="min-w-0 flex-1 overflow-y-auto p-4">
				<h3 class="mb-3 text-base font-semibold">{current[1].title}</h3>
				<div class="flex flex-col gap-5">
					{#each Object.entries(current[1].items) as [key, item] (key)}
						<div class="flex flex-col gap-1"><HelpEntry {item} newTab /></div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</dialog>
