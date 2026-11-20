<script lang="ts">
	// The search over the inspector's fields (Esc empties it first)
	import { getInspector } from './inspector.svelte.js';
	import { brandMessages } from './i18n/index.svelte.js';

	const t = $derived(brandMessages().inspector);
	const search = getInspector().search;
</script>

<label class="input input-sm w-full">
	<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
	<input
		type="text"
		class="grow"
		placeholder={t.search}
		aria-label={t.search}
		bind:value={search.query}
		onkeydown={(e) => {
			if (e.key === 'Escape' && search.query) {
				search.query = '';
				e.stopPropagation();
			}
		}}
	/>
	{#if search.query}
		<button class="btn btn-ghost btn-xs btn-circle" onclick={() => (search.query = '')} title={t.clearSearch} aria-label={t.clearSearch}>
			<span class="icon-[material-symbols-light--close] size-4" aria-hidden="true"></span>
		</button>
	{/if}
</label>
{#if search.active && !search.matches.any}
	<p class="text-xs opacity-70">{t.noMatches}</p>
{/if}
