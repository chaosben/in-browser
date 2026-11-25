<script lang="ts">
	// Layout of the tool Fonts (used by src/routes/fonts/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { HelpState } from '@in-browser/brand/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('fonts');
</script>

<ToolLayout
	slug="fonts"
	{locale}
	description={m.brand.description}
	home={resolve('/fonts')}
	helpPage={resolve('/help/fonts')}
	icon={asset('fonts/favicon.svg')}
	manifests={{ en: asset('fonts/manifest.webmanifest'), de: asset('fonts/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
>
	{@render children()}
</ToolLayout>
