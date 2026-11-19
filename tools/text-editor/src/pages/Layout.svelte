<script lang="ts">
	// Layout of the Text Editor (used by src/routes/text-editor/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { HelpState } from '@in-browser/brand/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('text-editor');
</script>

<ToolLayout
	slug="text-editor"
	{locale}
	description={m.brand.description}
	home={resolve('/text-editor')}
	helpPage={resolve('/help/text-editor')}
	icon={asset('text-editor/favicon.svg')}
	manifests={{ en: asset('text-editor/manifest.webmanifest'), de: asset('text-editor/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
>
	{@render children()}
</ToolLayout>
