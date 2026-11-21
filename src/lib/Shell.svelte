<script lang="ts">
	// Frame of the overview pages (home page, help pages and error page): header, footer, metadata, language switch, PWA
	// (the launcher installs as the app of the whole suite), the syncs like in every tool
	import { onMount, type Component, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import { BRAND } from '@in-browser/brand/brand.js';
	import { sourceUrl } from '@in-browser/brand/build.js';
	import CommitLink from '@in-browser/brand/CommitLink.svelte';
	import ContextMenu from '@in-browser/brand/ContextMenu.svelte';
	import { initPwa } from '@in-browser/brand/pwa.svelte.js';
	import Toasts from '@in-browser/brand/Toasts.svelte';
	import UpdateBanner from '@in-browser/brand/UpdateBanner.svelte';
	import { applyBrowserLocale, lang, m } from '#lib/i18n/index.svelte.js';

	interface Props {
		children: Snippet;
		/** Page title without the suite name; without it the home page title */
		title?: string;
		/** Meta description; without it the one of the suite */
		description?: string;
		/** Path of the page for the canonical URL */
		path?: string;
	}

	let { children, title, description, path = '/' }: Props = $props();

	// Functions, not $derived: `m` is no state, the {#key} below re-runs them after the language switch
	const fullTitle = () => (title ? `${title} · ${BRAND.suite}` : `${BRAND.suite} – ${m.brand.claim}`);
	const canonical = $derived(`${BRAND.suiteUrl}${path}`);

	// The suite settings (gear in the BrandBar), loaded on first use
	let SettingsDialog = $state<Component | null>(null);
	// Sync status in the footer; the files modules load only in the browser (prerendering never touches them)
	let SyncIndicator = $state<Component | null>(null);
	async function openSettings() {
		const [dialog, store] = await Promise.all([import('@in-browser/files/SettingsDialog.svelte'), import('@in-browser/files/suite-settings.svelte.js')]);
		SettingsDialog = dialog.default;
		store.openSettings();
	}

	// Prerendered in English; if the browser language differs, {#key} re-renders everything once
	onMount(() => {
		applyBrowserLocale();
		initPwa();
		// The syncs run while any page of the suite is open, so an open overview keeps the devices connected
		void Promise.all([
			import('@in-browser/files/sync/sync.svelte.js'),
			import('@in-browser/files/suite-settings.svelte.js'),
			import('@in-browser/files/SyncIndicator.svelte')
		]).then(([sync, settings, indicator]) => {
			sync.startSync();
			void settings.suiteSettings.load();
			SyncIndicator = indicator.default;
		});
	});
</script>

<svelte:head>
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={BRAND.suite} />
	<meta property="og:url" content={canonical} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content={BRAND.themeColor.light} />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content={BRAND.themeColor.dark} />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<!-- Installed, the suite carries the names in the browser's language -->
	<link rel="manifest" href={lang.current === 'de' ? '/manifest.de.webmanifest' : '/manifest.webmanifest'} />
	{#key lang.current}
		<title>{fullTitle()}</title>
		<meta name="description" content={description ?? m.brand.description} />
		<meta property="og:title" content={fullTitle()} />
		<meta property="og:description" content={description ?? m.brand.description} />
	{/key}
</svelte:head>

{#key lang.current}
	<div class="flex min-h-full flex-col">
		<BrandBar helpHref={resolve('/help')} onsettings={openSettings} />
		{@render children()}
		<footer
			class="border-base-300 mx-auto mt-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-4 border-t px-4 py-6 text-sm opacity-70"
		>
			<span><span class="font-semibold">{BRAND.suite}</span> – {m.brand.claim}</span>
			<span class="ml-auto">{#if SyncIndicator}<SyncIndicator />{/if}</span>
			<a class="link link-hover" href={resolve('/help')}>{m.help.title}</a>
			<a class="link link-hover" href={BRAND.repoUrl} target="_blank" rel="noopener">
				{m.footer.openSource}
			</a>
			<a class="link link-hover" href={sourceUrl('THIRD_PARTY_LICENSES.md')} target="_blank" rel="noopener">
				{m.footer.licenses}
			</a>
			<CommitLink />
		</footer>
	</div>
	{#if SettingsDialog}<SettingsDialog />{/if}
{/key}
<Toasts />
<ContextMenu />
<UpdateBanner />
