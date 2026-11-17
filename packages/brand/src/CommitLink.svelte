<script lang="ts">
	import { COMMIT, sourceUrl } from './build.js';
	import { brandMessages } from './i18n/index.svelte.js';

	// Version of the deployed app, linked to the repository as of that commit (`dev`: the repository itself)
	const t = $derived(brandMessages());
	const href = sourceUrl();
</script>

<a class="link link-hover text-xs opacity-60" {href} target="_blank" rel="noopener" title={t.build.sourceHint}>
	{t.build.version(COMMIT)}
</a>
