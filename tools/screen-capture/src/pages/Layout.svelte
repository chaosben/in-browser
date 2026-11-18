<script lang="ts">
	// Layout of all Screen Capture pages (used by src/routes/screen-capture/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import BrandFooter from '@in-browser/brand/BrandFooter.svelte';
	import { setLocale } from '@in-browser/brand/i18n/index.svelte.js';
	import { initPwa } from '@in-browser/brand/pwa.svelte.js';
	import { recordToolUse } from '@in-browser/brand/recent-tools.js';
	import UpdateBanner from '@in-browser/brand/UpdateBanner.svelte';
	import FileDialog from '@in-browser/files/FileDialog.svelte';
	import SyncIndicator from '@in-browser/files/SyncIndicator.svelte';
	import { startSync } from '@in-browser/files/sync/sync.svelte.js';
	import { BRAND } from '#lib/brand.js';
	import ConfirmDialog from '@in-browser/brand/ConfirmDialog.svelte';
	import ContextMenu from '@in-browser/brand/ContextMenu.svelte';
	import { installHelpKeys } from '@in-browser/brand/help.svelte.js';
	import HelpWindow from '@in-browser/brand/HelpWindow.svelte';
	import Toasts from '@in-browser/brand/Toasts.svelte';
	import { locale, m } from '#lib/i18n/index.js';
	import { help } from '#lib/ui/help.svelte.js';

	let { children }: { children: Snippet } = $props();

	// Pass the language on to the brand components and the document
	setLocale(locale);
	initPwa();
	// For “Recently used” on the overview
	recordToolUse(resolve('/screen-capture'));
	// Keeps the shared file system in sync with the folder on disk while the tool is open (if connected in Files)
	startSync();
	$effect(() => installHelpKeys(help));
</script>

<svelte:head>
	<meta name="description" content={m.brand.description} />
	<meta name="application-name" content={BRAND.tool} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={BRAND.suite} />
	<meta property="og:title" content="{BRAND.tool} · {BRAND.suite}" />
	<meta property="og:description" content={m.brand.description} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content={BRAND.themeColor.light} />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content={BRAND.themeColor.dark} />
	<link rel="icon" href={asset('screen-capture/favicon.svg')} type="image/svg+xml" />
	<link rel="manifest" href={asset('screen-capture/manifest.webmanifest')} />
</svelte:head>

<div class="flex h-full flex-col">
	<BrandBar tool={BRAND.tool} home={resolve('/screen-capture')} {help} />
	<div class="min-h-0 flex-1 overflow-auto">
		{@render children()}
	</div>
	<BrandFooter>
		{#snippet indicators()}<SyncIndicator />{/snippet}
	</BrandFooter>
</div>
<Toasts />
<ConfirmDialog />
<ContextMenu />
<FileDialog />
<UpdateBanner />
<!-- Left of the editor's properties panel -->
<HelpWindow content={m.help} {help} page={resolve('/help/screen-capture')} anchor="right: 21rem; top: 4rem" />
