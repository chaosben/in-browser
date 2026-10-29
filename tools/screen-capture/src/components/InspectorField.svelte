<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { matchesQuery } from '#lib/ui/inspector-search.js';
	import { getInspectorSearch, getSectionScope } from '#lib/ui/inspector.svelte.js';

	interface Props {
		/** Visible label the search looks at */
		label: string;
		/** Further words that should find the field (e.g. the labels of its parts) */
		keywords?: string[];
		children: Snippet;
	}

	let { label, keywords = [], children }: Props = $props();

	const search = getInspectorSearch();
	const section = getSectionScope();
	const id = Symbol();
	const matched = $derived(!search.active || section.titleMatches || matchesQuery(search.query, label, ...keywords));

	$effect(() => {
		const value = matched;
		// Only write the registries; reading them here would rerun this effect on every change
		untrack(() => {
			section.matches.set(id, value);
			search.matches.set(id, value);
		});
		return () =>
			untrack(() => {
				section.matches.delete(id);
				search.matches.delete(id);
			});
	});
</script>

{#if matched}
	{@render children()}
{/if}
