<script lang="ts">
	// The PDF's bookmarks (outline): a tree; a click goes to the place, the arrows open and close sub-entries.
	import { SvelteSet } from 'svelte/reactivity';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { m } from '#lib/i18n/index.js';
	import type { OutlineEntry } from '#lib/model/document.svelte.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';

	let { context, close }: PanelProps<EditorState> = $props();

	const open = new SvelteSet<OutlineEntry>();

	async function go(entry: OutlineEntry) {
		const place = await context.doc?.destination(entry.dest);
		if (!place) return;
		context.goTo(place.index, place.y);
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
	}

	function toggle(entry: OutlineEntry) {
		if (open.has(entry)) open.delete(entry);
		else open.add(entry);
	}
</script>

{#snippet tree(entries: OutlineEntry[], depth: number)}
	<ul role={depth ? 'group' : 'tree'}>
		{#each entries as entry, i (i)}
			<li role="treeitem" aria-selected="false" aria-expanded={entry.items.length ? open.has(entry) : undefined}>
				<div class="flex items-center" style="padding-left: {depth * 14}px">
					{#if entry.items.length}
						<button class="btn btn-ghost btn-xs btn-square" onclick={() => toggle(entry)} aria-label={entry.title}>
							<span class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', open.has(entry) && 'rotate-90']} aria-hidden="true"></span>
						</button>
					{:else}
						<span class="w-6 shrink-0"></span>
					{/if}
					<button class="hover:bg-base-200 min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-sm" onclick={() => go(entry)} title={entry.title}>
						{entry.title}
					</button>
				</div>
				{#if entry.items.length && open.has(entry)}{@render tree(entry.items, depth + 1)}{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="p-2">
	{#if context.doc?.outline.length}
		{@render tree(context.doc.outline, 0)}
	{:else}
		<p class="p-2 text-sm opacity-70">{m.panels.noOutline}</p>
	{/if}
</div>
