<script lang="ts">
	// Layout of all Screen Capture pages (used by src/routes/screen-capture/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import ToolLayout from '@in-browser/files/ToolLayout.svelte';
	import { help } from '#lib/ui/help.svelte.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();
</script>

<!-- The pages set the title; the help opens left of the editor's properties panel -->
<ToolLayout
	slug="screen-capture"
	{locale}
	description={m.brand.description}
	home={resolve('/screen-capture')}
	helpPage={resolve('/help/screen-capture')}
	icon={asset('screen-capture/favicon.svg')}
	manifests={{ en: asset('screen-capture/manifest.webmanifest'), de: asset('screen-capture/manifest.de.webmanifest') }}
	{help}
	helpContent={m.help}
	title={false}
	scroll
	helpAnchor="right: 21rem; top: 4rem"
>
	{@render children()}
</ToolLayout>
