<script lang="ts">
	// Frame of the overview pages (home page and error page): header, footer, metadata, language switch
	import { onMount, type Snippet } from 'svelte';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import { BRAND } from '@in-browser/brand/brand.js';
	import { applyBrowserLocale, lang, m } from '#lib/i18n/index.svelte.js';

	let { children }: { children: Snippet } = $props();

	// Prerendered in English; if the browser language differs, {#key} re-renders everything once
	onMount(applyBrowserLocale);
</script>

<svelte:head>
	<link rel="canonical" href="{BRAND.suiteUrl}/" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={BRAND.suite} />
	<meta property="og:url" content="{BRAND.suiteUrl}/" />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1d232a" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	{#key lang.current}
		<title>{BRAND.suite} – {m.brand.claim}</title>
		<meta name="description" content={m.brand.description} />
		<meta property="og:title" content="{BRAND.suite} – {m.brand.claim}" />
		<meta property="og:description" content={m.brand.description} />
	{/key}
</svelte:head>

{#key lang.current}
	<div class="flex min-h-full flex-col">
		<BrandBar />
		{@render children()}
		<footer
			class="border-base-300 mx-auto mt-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-4 border-t px-4 py-6 text-sm opacity-70"
		>
			<span><span class="font-semibold">{BRAND.suite}</span> – {m.brand.claim}</span>
			<a class="link link-hover ml-auto" href={BRAND.repoUrl} target="_blank" rel="noopener">
				{m.footer.openSource}
			</a>
		</footer>
	</div>
{/key}
