<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import { CURATED_ICONS } from '#lib/icons/curated.js';
	import { ICON_SETS, loadAllIcons, searchIcons, type IconSetId } from '#lib/icons/index.js';
	import type { IconData } from '#lib/project/types.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { ToolProps } from '#lib/tools/types.js';
	import { toast } from '#lib/ui/toast.svelte.js';
	import { errorMessage } from '#lib/util/format.js';

	let { actions }: ToolProps = $props();

	const LIMIT = 200;
	const curated = CURATED_ICONS.flatMap((c) => c.icons);

	let query = $state('');
	/** Chosen source: the curated selection (offline) or a whole set */
	let source = $state<'curated' | IconSetId>('curated');
	/** Whole sets once loaded (search then covers all their icons) */
	let sets = $state.raw<Partial<Record<IconSetId, IconData[]>>>({});
	let loading = $state(false);

	const set = $derived(source === 'curated' ? null : ICON_SETS.find((s) => s.id === source)!);
	const all = $derived(source === 'curated' ? null : (sets[source] ?? null));
	const results = $derived(query.trim() || all ? searchIcons(all ?? curated, query, LIMIT) : null);

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
			<!-- Bodies come from the bundled icon set -->
			{@html icon.body}
		</svg>
	</button>
{/snippet}

<div class="flex flex-col gap-3 p-3">
	<label class="input input-sm">
		<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
		<input type="search" placeholder={set ? m.icons.searchSet(set.name) : m.icons.search} bind:value={query} />
	</label>
	<select class="select select-sm w-full" bind:value={source} aria-label={m.icons.source}>
		<option value="curated">{m.icons.curated}</option>
		{#each ICON_SETS as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
	</select>
	{#if set}
		{#if !all}
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
	{/if}
	<p class="text-xs opacity-60">{m.icons.hint}</p>

	{#if results}
		{#if results.length === 0}
			<p class="text-xs opacity-60">{m.icons.noResults}</p>
		{:else}
			<div class="flex flex-wrap gap-0.5">
				{#each results as icon (icon.name)}{@render tile(icon)}{/each}
			</div>
			{#if results.length >= LIMIT}
				<p class="text-xs opacity-60">{m.icons.limited(LIMIT)}</p>
			{/if}
		{/if}
	{:else}
		{#each CURATED_ICONS as category (category.id)}
			<div class="flex flex-col gap-1">
				<span class="text-xs font-semibold opacity-70">{m.icons.categories[category.id]}</span>
				<div class="flex flex-wrap gap-0.5">
					{#each category.icons as icon (icon.name)}{@render tile(icon)}{/each}
				</div>
			</div>
		{/each}
	{/if}

</div>
