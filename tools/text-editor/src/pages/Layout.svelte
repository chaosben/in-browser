<script lang="ts">
	// Layout of the Text Editor (used by src/routes/text-editor/+layout.svelte of the app)
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
	import { HelpState, installHelpKeys } from '@in-browser/brand/help.svelte.js';
	import HelpWindow from '@in-browser/brand/HelpWindow.svelte';
	import Toasts from '@in-browser/brand/Toasts.svelte';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Pass the language on to the brand components and the document
	setLocale(locale);
	initPwa();
	// For “Recently used” on the overview
	recordToolUse(resolve('/text-editor'));
	// Keeps the shared file system in sync with the folder on disk while the tool is open (if connected in Files)
	startSync();
	// Help window (BrandBar button, F1, ?)
	const help = new HelpState('text-editor');
	$effect(() => installHelpKeys(help));
</script>

<svelte:head>
	<title>{BRAND.tool} · {BRAND.suite}</title>
	<meta name="description" content={m.brand.description} />
	<meta name="application-name" content={BRAND.tool} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={BRAND.suite} />
	<meta property="og:title" content="{BRAND.tool} · {BRAND.suite}" />
	<meta property="og:description" content={m.brand.description} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content={BRAND.themeColor.light} />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content={BRAND.themeColor.dark} />
	<link rel="icon" href={asset('text-editor/favicon.svg')} type="image/svg+xml" />
	<link rel="manifest" href={asset('text-editor/manifest.webmanifest')} />
</svelte:head>

<div class="flex h-full flex-col">
	<BrandBar tool={BRAND.tool} home={resolve('/text-editor')} {help} />
	<div class="min-h-0 flex-1">
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
<HelpWindow content={m.help} {help} page={resolve('/help/text-editor')} />
