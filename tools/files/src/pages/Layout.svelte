<script lang="ts">
	// Layout of the Files pages (used by src/routes/files/+layout.svelte of the app)
	import type { Snippet } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import ConfirmDialog from '@in-browser/brand/ConfirmDialog.svelte';
	import ContextMenu from '@in-browser/brand/ContextMenu.svelte';
	import { setLocale } from '@in-browser/brand/i18n/index.svelte.js';
	import { initPwa } from '@in-browser/brand/pwa.svelte.js';
	import Toasts from '@in-browser/brand/Toasts.svelte';
	import UpdateBanner from '@in-browser/brand/UpdateBanner.svelte';
	import { startSync } from '@in-browser/files/sync/sync.svelte.js';
	import { BRAND } from '#lib/brand.js';
	import { locale, m } from '#lib/i18n/index.js';

	let { children }: { children: Snippet } = $props();

	// Pass the language on to the brand components and the document
	setLocale(locale);
	initPwa();
	startSync();
</script>

<svelte:head>
	<title>{BRAND.tool} · {BRAND.suite}</title>
	<meta name="description" content={m.brand.description} />
	<meta name="application-name" content={BRAND.tool} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={BRAND.suite} />
	<meta property="og:title" content="{BRAND.tool} · {BRAND.suite}" />
	<meta property="og:description" content={m.brand.description} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1d232a" />
	<link rel="icon" href={asset('files/favicon.svg')} type="image/svg+xml" />
	<link rel="manifest" href={asset('files/manifest.webmanifest')} />
</svelte:head>

<div class="flex h-full flex-col">
	<BrandBar tool={BRAND.tool} home={resolve('/files')} />
	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
</div>
<Toasts />
<ConfirmDialog />
<ContextMenu />
<UpdateBanner />
