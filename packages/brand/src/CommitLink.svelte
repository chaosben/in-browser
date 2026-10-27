<script lang="ts">
	import { BRAND } from './brand.js';
	import { COMMIT } from './build.js';
	import { brandMessages } from './i18n/index.svelte.js';

	// Version of the deployed app, linked to the repository as of that commit (`dev`: the repository itself)
	const t = $derived(brandMessages());
	const sha = COMMIT.replace(/-dirty$/, '');
	const href = COMMIT === 'dev' ? BRAND.repoUrl : `${BRAND.repoUrl}/tree/${sha}`;
</script>

<a class="link link-hover text-xs opacity-60" {href} target="_blank" rel="noopener" title={t.build.sourceHint}>
	{t.build.version(COMMIT)}
</a>
