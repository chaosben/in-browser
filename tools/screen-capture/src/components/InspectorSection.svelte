<script lang="ts">
	import type { Snippet } from 'svelte';
	import { matchesQuery } from '#lib/ui/inspector-search.js';
	import { FieldMatches, getInspectorSearch, sectionState, setSectionScope } from '#lib/ui/inspector.svelte.js';

	interface Props {
		/** Same ID for the same kind of section of every element type, so its open state applies to all */
		id: string;
		title: string;
		children: Snippet;
	}

	let { id, title, children }: Props = $props();

	const search = getInspectorSearch();
	const matches = new FieldMatches();
	const titleMatches = $derived(search.active && matchesQuery(search.query, title));
	setSectionScope({
		matches,
		get titleMatches() {
			return titleMatches;
		}
	});

	// While searching, only sections with matches show, always open
	const visible = $derived(!search.active || titleMatches || matches.any);
	const open = $derived(search.active || sectionState.isOpen(id));
</script>

<!-- Fields stay mounted while hidden, so they keep reporting whether they match -->
<section class={['border-base-300 flex flex-col border-t pt-2', { hidden: !visible }]}>
	<button
		class="flex items-center gap-1 text-left text-xs font-semibold opacity-70 hover:opacity-100"
		aria-expanded={open}
		disabled={search.active}
		onclick={() => sectionState.toggle(id)}
	>
		<span class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', { 'rotate-90': open }]} aria-hidden="true"></span>
		{title}
	</button>
	<div class={['mt-3 flex flex-col gap-4', { hidden: !open }]}>
		{@render children()}
	</div>
</section>
