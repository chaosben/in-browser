<script lang="ts">
	// Layout of the PDF Editor (used by src/routes/pdf-editor/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { HelpState } from '@in-browser/brand/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('pdf-editor');
</script>

<ToolLayout
	slug="pdf-editor"
	{locale}
	description={m.brand.description}
	home={resolve('/pdf-editor')}
	helpPage={resolve('/help/pdf-editor')}
	icon={asset('pdf-editor/favicon.svg')}
	manifests={{ en: asset('pdf-editor/manifest.webmanifest'), de: asset('pdf-editor/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
>
	{@render children()}
</ToolLayout>
