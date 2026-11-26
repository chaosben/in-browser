<script lang="ts">
	// Layout of the JWL Files (used by src/routes/jwl-files/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { HelpState } from '@in-browser/brand/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('jwl-files');
</script>

<ToolLayout
	slug="jwl-files"
	{locale}
	description={m.brand.description}
	home={resolve('/jwl-files')}
	helpPage={resolve('/help/jwl-files')}
	icon={asset('jwl-files/favicon.svg')}
	manifests={{ en: asset('jwl-files/manifest.webmanifest'), de: asset('jwl-files/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
>
	{@render children()}
</ToolLayout>
