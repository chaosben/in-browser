<script lang="ts">
	// A field of the inspector: shown while the search finds its label (or keywords, or its section's title)
	import { untrack, type Snippet } from 'svelte';
	import { getInspector, getSectionScope } from './inspector.svelte.js';
	import { matchesQuery } from './ui/search.js';

	interface Props {
		/** Visible label the search looks at */
		label: string;
		/** Further words that should find the field (e.g. the labels of its parts) */
		keywords?: string[];
		children: Snippet;
	}

	let { label, keywords = [], children }: Props = $props();

	const search = getInspector().search;
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
