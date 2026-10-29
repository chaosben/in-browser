<script lang="ts">
	import { previewKind, type Item } from '#lib/items.js';

	let { item, size = 'size-5' }: { item: Item; size?: string } = $props();

	const kind = $derived(item.folder ? null : previewKind(item.name));
</script>

{#if item.formats[0]}
	<img src={item.formats[0].icon} alt="" class="{size} shrink-0" />
{:else if item.folder}
	<span class="icon-[material-symbols-light--folder-outline] text-warning {size} shrink-0" aria-hidden="true"></span>
{:else if kind === 'image'}
	<span class="icon-[material-symbols-light--image-outline] {size} shrink-0" aria-hidden="true"></span>
{:else if kind === 'video'}
	<span class="icon-[material-symbols-light--movie-outline] {size} shrink-0" aria-hidden="true"></span>
{:else if kind === 'audio'}
	<span class="icon-[material-symbols-light--music-note] {size} shrink-0" aria-hidden="true"></span>
{:else if kind === 'text'}
	<span class="icon-[material-symbols-light--description-outline] {size} shrink-0" aria-hidden="true"></span>
{:else}
	<span class="icon-[material-symbols-light--draft-outline] {size} shrink-0" aria-hidden="true"></span>
{/if}
