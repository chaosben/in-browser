<script lang="ts">
	// Layout of the Files pages (used by src/routes/files/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { HelpState } from '@in-browser/brand/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('files');
</script>

<ToolLayout
	slug="files"
	{locale}
	description={m.brand.description}
	home={resolve('/files')}
	helpPage={resolve('/help/files')}
	icon={asset('files/favicon.svg')}
	manifests={{ en: asset('files/manifest.webmanifest'), de: asset('files/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
>
	{@render children()}
</ToolLayout>
