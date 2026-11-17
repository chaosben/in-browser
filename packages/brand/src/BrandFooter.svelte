<script lang="ts">
	import type { Snippet } from 'svelte';
	import { brandFooter } from './brand-footer.svelte.js';
	import SaveIndicator from './SaveIndicator.svelte';

	interface Props {
		/** Suite-wide indicators on the right (e.g. the sync status), passed in by the tool's layout */
		indicators?: Snippet;
	}

	let { indicators }: Props = $props();
</script>

<!--
	Shared footer of the tools, once in each tool's layout. Left: the save state of the current document (fixed place)
	and the status of the current page (`setBrandFooter`); right: suite-wide indicators. (The version is shown on the
	overview.)
-->
<!-- Hidden while it has nothing to show (no page status, no indicator rendered) -->
<footer class="border-base-300 bg-base-200 hidden h-7 shrink-0 pointer-coarse:h-10 items-center justify-end gap-1 border-t px-2 text-xs has-[>*]:flex">
	{#if brandFooter.status || brandFooter.save}
		<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
			{#if brandFooter.save}<SaveIndicator save={brandFooter.save} />{/if}
			{@render brandFooter.status?.()}
		</div>
	{/if}
	{@render indicators?.()}
</footer>
