<script lang="ts">
	import { SUITE_PAGES, type SuitePage } from '#lib/help.js';
	import HelpPage from '#lib/HelpPage.svelte';
	import { m } from '#lib/i18n/index.svelte.js';

	let { page }: { page: SuitePage } = $props();

	const path = $derived(SUITE_PAGES.find((p) => p.id === page)?.path ?? '/help');
</script>

<!-- A help page of the whole suite (storage, sync, p2p-node, install) -->
<HelpPage title={m.help.pages[page].title} summary={m.help.pages[page].summary} {path} content={m.help.pages[page].topics} />
