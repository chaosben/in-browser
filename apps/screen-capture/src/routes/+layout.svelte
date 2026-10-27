<script lang="ts">
	import './layout.css';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import { setLocale } from '@in-browser/brand/i18n/index.svelte.js';
	import { initPwa } from '@in-browser/brand/pwa.svelte.js';
	import UpdateBanner from '@in-browser/brand/UpdateBanner.svelte';
	import { BRAND } from '#lib/brand.js';
	import Toasts from '#lib/components/Toasts.svelte';
	import { locale, m } from '#lib/i18n/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Pass the language on to the brand components and the document
	setLocale(locale);
	initPwa();
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
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<div class="flex h-full flex-col">
	<BrandBar tool={BRAND.tool} />
	<div class="min-h-0 flex-1 overflow-auto">
		{@render children()}
	</div>
</div>
<Toasts />
<UpdateBanner />
