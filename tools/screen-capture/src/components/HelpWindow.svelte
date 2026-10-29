<script lang="ts">
	import type { HelpItem, HelpTopic } from '#lib/i18n/help.en.js';
	import { m } from '#lib/i18n/index.js';
	import { helpState } from '#lib/ui/help.svelte.js';
	import { matchesQuery } from '#lib/ui/inspector-search.js';

	let dialog: HTMLDialogElement;
	let query = $state('');

	const topics = $derived(Object.entries(m.help.sections) as [string, HelpTopic][]);
	const current = $derived(topics.find(([id]) => id === helpState.topic) ?? topics[0]);
	/** While searching: the matching entries of all topics */
	const results = $derived.by(() => {
		if (!query.trim()) return null;
		return topics.flatMap(([id, topic]) =>
			Object.entries(topic.items)
				.filter(([, item]) => matchesQuery(query, topic.title, ...searchable(item as HelpItem)))
				.map(([key, item]) => ({ id: `${id}.${key}`, topicId: id, topic: topic.title, item: item as HelpItem }))
		);
	});

	/** Everything the search looks at in an entry */
	function searchable(item: HelpItem) {
		const options = Object.values(item.options ?? {}).flatMap((o) => [o.label, o.text]);
		return [item.title, item.text, ...options, item.tip ?? '', ...(item.keys?.flat() ?? [])];
	}

	// Not modal: the editor stays usable next to it
	$effect(() => {
		if (helpState.open && !dialog.open) dialog.show();
		else if (!helpState.open && dialog.open) dialog.close();
	});

	/** Keeps at least the title bar on screen */
	function clampPos(x: number, y: number) {
		return { x: Math.min(Math.max(x, 0), window.innerWidth - 160), y: Math.min(Math.max(y, 0), window.innerHeight - 48) };
	}

	/** Title bar: drag to move the window */
	function dragWindow(e: PointerEvent) {
		if (e.button !== 0 || (e.target as HTMLElement).closest('button, input')) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = dialog.getBoundingClientRect();
		const offsetX = e.clientX - rect.left;
		const offsetY = e.clientY - rect.top;
		const move = (ev: PointerEvent) => (helpState.pos = clampPos(ev.clientX - offsetX, ev.clientY - offsetY));
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
			helpState.save();
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	/** Remembers the size the user gave the window (CSS `resize`) */
	function trackSize(node: HTMLElement) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const observer = new ResizeObserver(() => {
			if (!node.offsetWidth) return;
			helpState.size = { w: node.offsetWidth, h: node.offsetHeight };
			clearTimeout(timer);
			timer = setTimeout(() => helpState.save(), 300);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			clearTimeout(timer);
		};
	}

	function showTopic(id: string) {
		helpState.topic = id;
		helpState.save();
	}

	const place = $derived(
		helpState.pos ? `left: ${helpState.pos.x}px; top: ${helpState.pos.y}px` : 'right: 21rem; top: 4rem'
	);
</script>

<!-- One entry: title, its keys, the text, the meaning of each choice and how to decide (spans only, so it also
	 fits into a search result button) -->
{#snippet entry(item: HelpItem)}
	<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
		<span class="font-semibold">{item.title}</span>
		{#each item.keys ?? [] as combo, i (i)}
			<span class="flex items-center gap-0.5">
				{#each combo as key, j (j)}
					{#if j}<span class="text-xs opacity-50">+</span>{/if}
					<kbd class="kbd kbd-xs">{key}</kbd>
				{/each}
			</span>
		{/each}
	</span>
	<span class="block text-sm opacity-80">{item.text}</span>
	{#if item.options}
		<span class="mt-1 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-sm">
			{#each Object.entries(item.options) as [key, option] (key)}
				<span class="font-medium">{option.label}</span>
				<span class="opacity-80">{option.text}</span>
			{/each}
		</span>
	{/if}
	{#if item.tip}
		<span class="bg-base-200 rounded-field mt-1 flex gap-2 p-2 text-sm">
			<span class="icon-[material-symbols-light--lightbulb-outline] text-warning size-5 shrink-0" aria-hidden="true"></span>
			<span><span class="font-semibold">{m.help.tipLabel}:</span> {item.tip}</span>
		</span>
	{/if}
{/snippet}

<dialog
	bind:this={dialog}
	{@attach trackSize}
	class="bg-base-100 text-base-content border-base-300 rounded-box fixed z-40 m-0 max-h-[calc(100vh-1rem)] min-h-60 max-w-[calc(100vw-1rem)] min-w-80 resize flex-col overflow-hidden border p-0 shadow-xl open:flex"
	style="{place}; width: {helpState.size.w}px; height: {helpState.size.h}px"
	aria-labelledby="help-title"
	onclose={() => (helpState.open = false)}
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		// Not the editor's Esc (deselect)
		e.preventDefault();
		e.stopPropagation();
		if (query) query = '';
		else helpState.open = false;
	}}
>
	<!-- Title bar: drag handle -->
	<div
		class="bg-base-200 flex cursor-move items-center gap-2 py-1.5 pr-1.5 pl-3"
		onpointerdown={dragWindow}
		title={m.help.move}
		role="presentation"
	>
		<span class="icon-[material-symbols-light--help-outline] size-5" aria-hidden="true"></span>
		<h2 id="help-title" class="font-semibold">{m.help.title}</h2>
		<label class="input input-sm ml-auto w-56 cursor-text">
			<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
			<input type="text" class="grow" placeholder={m.help.search} aria-label={m.help.search} bind:value={query} />
		</label>
		<button
			class="btn btn-ghost btn-sm btn-square"
			onclick={() => (helpState.open = false)}
			title={m.common.close}
			aria-label={m.common.close}
		>
			<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
		</button>
	</div>

	<div class="flex min-h-0 flex-1">
		{#if results}
			<section class="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
				{#each results as r (r.id)}
					<button class="hover:bg-base-200 rounded-field flex flex-col gap-1 p-2 text-left" onclick={() => {
						showTopic(r.topicId);
						query = '';
					}}>
						<span class="text-xs opacity-60">{r.topic}</span>
						{@render entry(r.item)}
					</button>
				{:else}
					<p class="text-sm opacity-70">{m.help.noMatches}</p>
				{/each}
			</section>
		{:else}
			<nav class="border-base-300 w-44 shrink-0 overflow-y-auto border-r p-2" aria-label={m.help.topics}>
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
			<section class="min-w-0 flex-1 overflow-y-auto p-4">
				<h3 class="mb-3 text-base font-semibold">{current[1].title}</h3>
				<div class="flex flex-col gap-5">
					{#each Object.entries(current[1].items) as [key, item] (key)}
						<div class="flex flex-col gap-1">{@render entry(item as HelpItem)}</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</dialog>
