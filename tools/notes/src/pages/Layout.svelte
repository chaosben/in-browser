<script lang="ts">
	// Layout of Notes (used by src/routes/notes/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { HelpState } from '@in-browser/brand/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('notes');
</script>

<ToolLayout
	slug="notes"
	{locale}
	description={m.brand.description}
	home={resolve('/notes')}
	helpPage={resolve('/help/notes')}
	icon={asset('notes/favicon.svg')}
	manifests={{ en: asset('notes/manifest.webmanifest'), de: asset('notes/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
>
	{@render children()}
</ToolLayout>
