<script lang="ts">
	// Save state of the current document as an icon of fixed size (left in the BrandFooter): changing state never
	// moves anything. The text is the tooltip and what screen readers announce.
	import type { SaveState } from './brand-footer.svelte.js';

	let { save }: { save: SaveState } = $props();
</script>

<span class="flex size-4 shrink-0 items-center justify-center" role="status" aria-label={save.text} title={save.text} data-save={save.state}>
	{#if save.state === 'saving'}
		<span class="loading loading-spinner size-3.5 opacity-70" aria-hidden="true"></span>
	{:else if save.state === 'saved'}
		<span class="icon-[material-symbols-light--cloud-done-outline] size-4 opacity-70" aria-hidden="true"></span>
	{:else if save.state === 'unsaved'}
		<span class="icon-[material-symbols-light--fiber-manual-record] size-2.5 opacity-70" aria-hidden="true"></span>
	{:else}
		<span class="icon-[material-symbols-light--error-outline] text-error size-4" aria-hidden="true"></span>
	{/if}
</span>
