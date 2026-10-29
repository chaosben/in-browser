<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import type { IconCategoryGroup } from '#lib/icons/curated/types.js';
	import {
		DEFAULT_ICON_SET,
		filterIcons,
		ICON_SETS,
		isIconSetCached,
		loadAllIcons,
		loadCurated,
		searchIcons,
		type IconSetId,
		type LoadedSet
	} from '#lib/icons/index.js';
	import type { IconData } from '#lib/project/types.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { ToolProps } from '#lib/tools/types.js';
	import { toast } from '#lib/ui/toast.svelte.js';
	import { errorMessage } from '#lib/util/format.js';

	let { actions }: ToolProps = $props();

	/** Icons rendered per step; more follow while scrolling (whole sets have up to 16,000) */
	const PAGE = 240;
	const STORAGE_KEY = 'screen-capture:icon-set';

	function loadSetId(): IconSetId {
		try {
			const id = localStorage.getItem(STORAGE_KEY);
			if (ICON_SETS.some((s) => s.id === id)) return id as IconSetId;
		} catch {
			// localStorage not available
		}
		return DEFAULT_ICON_SET;
	}

	let query = $state('');
	/** Chosen set (persisted): its curated selection is offline, the whole set is loaded on demand */
	let setId = $state(loadSetId());
	let curated = $state.raw<IconCategoryGroup[] | null>(null);
	/** Whole sets once loaded (search and filters then cover all their icons) */
	let sets = $state.raw<Partial<Record<IconSetId, LoadedSet>>>({});
	let loading = $state(false);
	/** Filters of a whole set; null: all */
	let variant = $state<string | null>(null);
	let category = $state<string | null>(null);

	const set = $derived(ICON_SETS.find((s) => s.id === setId)!);
	const all = $derived(sets[setId] ?? null);
	const results = $derived.by(() => {
		// A loaded set is shown and searched as a whole; before that, the curated icons are what is there
		if (all) return filterIcons(all.icons, { query, variant, category });
		return query.trim() && curated ? searchIcons(curated.flatMap((c) => c.icons), query) : null;
	});
	/** Number of rendered results; back to one step whenever the results change */
	let shown = $derived.by(() => {
		void results;
		return PAGE;
	});

	/** Renders the next step once the end of the list comes near */
	function more(sentinel: HTMLElement) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) untrack(() => (shown += PAGE));
			},
			{ rootMargin: '400px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}

	// Curated selection of the chosen set; a whole set fetched before loads right away (from the browser cache)
	$effect(() => {
		const id = setId;
		let current = true;
		curated = null;
		loadCurated(id)
			.then((groups) => {
				if (current) curated = groups;
			})
			.catch((e) => {
				console.error('[icons]', e);
				toast(m.icons.loadFailed(errorMessage(e)), 'error');
			});
		isIconSetCached(id)
			.then((cached) => {
				if (current && cached && !sets[id]) load(id);
			})
			.catch((e) => console.error('[icons]', e));
		return () => (current = false);
	});

	function chooseSet(id: IconSetId) {
		setId = id;
		variant = category = null;
		try {
			localStorage.setItem(STORAGE_KEY, id);
		} catch {
			// ignore
		}
	}

	async function load(id: IconSetId) {
		loading = true;
		try {
			const icons = await loadAllIcons(id);
			sets = { ...sets, [id]: icons };
		} catch (e) {
			console.error('[icons]', e);
			toast(navigator.onLine ? m.icons.loadFailed(errorMessage(e)) : m.icons.offline, 'error', 8000);
		} finally {
			loading = false;
		}
	}
</script>

{#snippet tile(icon: IconData)}
	<button
		class="btn btn-ghost btn-square btn-sm"
		draggable="true"
		ondragstart={(e) => setDragPayload(e, { type: 'icon', icon })}
		onclick={() => actions.addIcon(icon)}
		title={icon.name}
		aria-label={m.icons.insert(icon.name)}
	>
		<svg class="size-6" viewBox="0 0 {icon.width} {icon.height}" aria-hidden="true">
			<!-- Bodies come from the icon sets shipped with the app (bundle or own assets), not from users -->
			{@html icon.body}
		</svg>
	</button>
{/snippet}

<div class="flex flex-col gap-3 p-3">
	<label class="input input-sm">
		<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
		<input type="search" placeholder={m.icons.searchSet(set.name)} bind:value={query} />
	</label>
	<select
		class="select select-sm w-full"
		value={setId}
		onchange={(e) => chooseSet(e.currentTarget.value as IconSetId)}
		aria-label={m.icons.source}
	>
		{#each ICON_SETS as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
	</select>
	{#if all}
		<div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 text-xs">
			<span>{m.icons.variant}</span>
			<select
				class="select select-xs w-full"
				value={variant ?? '*'}
				onchange={(e) => (variant = e.currentTarget.value === '*' ? null : e.currentTarget.value)}
				aria-label={m.icons.variant}
			>
				<option value="*">{m.icons.all}</option>
				{#each Object.entries(set.variants) as [suffix, name] (suffix)}<option value={suffix}>{name}</option>{/each}
			</select>
			{#if all.categories.length}
				<span>{m.icons.category}</span>
				<select
					class="select select-xs w-full"
					value={category ?? '*'}
					onchange={(e) => (category = e.currentTarget.value === '*' ? null : e.currentTarget.value)}
					aria-label={m.icons.category}
				>
					<option value="*">{m.icons.all}</option>
					{#each all.categories as c (c)}<option value={c}>{c}</option>{/each}
				</select>
			{/if}
		</div>
	{:else}
		<button class="btn btn-sm" onclick={() => load(set.id)} disabled={loading}>
			{#if loading}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<span class="icon-[material-symbols-light--travel-explore] size-5" aria-hidden="true"></span>
			{/if}
			{m.icons.load(set.size)}
		</button>
		<p class="text-xs opacity-60">{m.icons.loadHint(set.count)}</p>
	{/if}
	<p class="text-xs opacity-60">{m.icons.license(set.name, set.license)}</p>
	<p class="text-xs opacity-60">{m.icons.hint}</p>

	{#if results}
		{#if results.length === 0}
			<p class="text-xs opacity-60">{m.icons.noResults}</p>
		{:else}
			<p class="text-xs opacity-60">{m.icons.count(results.length)}</p>
			<div class="flex flex-wrap gap-0.5">
				{#each results.slice(0, shown) as icon (icon.name)}{@render tile(icon)}{/each}
			</div>
			{#if shown < results.length}
				<!-- A new observer per step: it fires again if the end is still in sight -->
				{#key shown}<div class="h-px" {@attach more}></div>{/key}
			{/if}
		{/if}
	{:else if curated}
		{#each curated as group (group.id)}
			<div class="flex flex-col gap-1">
				<span class="text-xs font-semibold opacity-70">{m.icons.categories[group.id]}</span>
				<div class="flex flex-wrap gap-0.5">
					{#each group.icons as icon (icon.name)}{@render tile(icon)}{/each}
				</div>
			</div>
		{/each}
	{:else}
		<span class="loading loading-spinner loading-sm self-center opacity-60"></span>
	{/if}

</div>
