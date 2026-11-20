<script lang="ts">
	// A section of the inspector: a title that folds it (kept per tool), its fields below. While searching, only
	// sections with matches show, always open.
	import type { Snippet } from 'svelte';
	import { FieldMatches, getInspector, setSectionScope } from './inspector.svelte.js';
	import { matchesQuery } from './ui/search.js';

	interface Props {
		/** The same id for the same kind of section of every selection, so folding it applies to all */
		id: string;
		title: string;
		children: Snippet;
	}

	let { id, title, children }: Props = $props();

	const inspector = getInspector();
	const search = inspector.search;
	const matches = new FieldMatches();
	const titleMatches = $derived(search.active && matchesQuery(search.query, title));
	setSectionScope({
		matches,
		get titleMatches() {
			return titleMatches;
		}
	});

	const visible = $derived(!search.active || titleMatches || matches.any);
	const open = $derived(search.active || inspector.isOpen(id));
</script>

<!-- Fields stay mounted while hidden, so they keep reporting whether they match -->
<section class={['border-base-300 flex flex-col border-t pt-2', { hidden: !visible }]}>
	<button
		class="flex items-center gap-1 text-left text-xs font-semibold opacity-70 hover:opacity-100"
		aria-expanded={open}
		disabled={search.active}
		onclick={() => inspector.toggleSection(id)}
	>
		<span class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', { 'rotate-90': open }]} aria-hidden="true"></span>
		{title}
	</button>
	<div class={['mt-3 flex flex-col gap-4', { hidden: !open }]}>
		{@render children()}
	</div>
</section>
