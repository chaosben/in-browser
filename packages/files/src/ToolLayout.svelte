<script lang="ts">
	// The frame of a tool's pages (its `pages/Layout.svelte` wraps the app's route in it): language, “Recently
	// used”, head tags, BrandBar, BrandFooter with the sync indicator, help window and keys. What lives as long as
	// the tab – the syncs, the overlays every page uses – is `Suite.svelte` in the app's root layout. Addresses come
	// from the tool (`resolve`/`asset` of the app).
	import { untrack, type Snippet } from 'svelte';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import BrandFooter from '@in-browser/brand/BrandFooter.svelte';
	import { BRAND } from '@in-browser/brand/brand.js';
	import type { HelpContent } from '@in-browser/brand/help.js';
	import { installHelpKeys, type HelpState } from '@in-browser/brand/help.svelte.js';
	import HelpWindow from '@in-browser/brand/HelpWindow.svelte';
	import { setLocale, toolName, type Locale, type ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
	import { recordToolUse } from '@in-browser/brand/recent-tools.js';
	import { startSuite } from './suite.js';
	import { openSettings } from './suite-settings.svelte.js';
	import SyncIndicator from './SyncIndicator.svelte';

	interface Props {
		slug: ToolSlug;
		/** Language of the tool (fixed for the session) */
		locale: Locale;
		/** One sentence for search engines and link previews */
		description: string;
		/** Start page (`resolve('/<tool>')`) and help page (`resolve('/help/<tool>')`) */
		home: string;
		helpPage: string;
		/** `asset('<tool>/favicon.svg')` and the web app manifest per language (installed apps carry the name in it) */
		icon: string;
		manifests: Record<Locale, string>;
		help: HelpState;
		helpContent: HelpContent;
		/** Desktop: where the help window opens (e.g. left of a side panel) */
		helpAnchor?: string;
		/** `false`: the pages set the title themselves */
		title?: boolean;
		/** The content scrolls (otherwise the pages manage their own scrolling) */
		scroll?: boolean;
		children: Snippet;
	}

	let { slug, locale, description, home, helpPage, icon, manifests, help, helpContent, helpAnchor, title = true, scroll = false, children }: Props = $props();

	// Whenever the tool is entered: pass its language on to the brand components and the document, and count it for
	// “Recently used” on the overview
	untrack(() => {
		setLocale(locale);
		recordToolUse(home);
	});
	// The tab's services, at once: the tool's pages read the connections and the sync state right away
	startSuite();
	// Help window (BrandBar button, F1, ?)
	$effect(() => installHelpKeys(help));

	const name = $derived(toolName(slug));
</script>

<svelte:head>
	{#if title}<title>{name} · {BRAND.suite}</title>{/if}
	<meta name="description" content={description} />
	<meta name="application-name" content={name} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={BRAND.suite} />
	<meta property="og:title" content="{name} · {BRAND.suite}" />
	<meta property="og:description" content={description} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content={BRAND.themeColor.light} />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content={BRAND.themeColor.dark} />
	<link rel="icon" href={icon} type="image/svg+xml" />
	<link rel="manifest" href={manifests[locale]} />
</svelte:head>

<div class="flex h-full flex-col">
	<BrandBar tool={name} {home} {help} onsettings={() => openSettings()} />
	<div class={['min-h-0 flex-1', scroll && 'overflow-auto']}>
		{@render children()}
	</div>
	<BrandFooter>
		{#snippet indicators()}<SyncIndicator />{/snippet}
	</BrandFooter>
</div>
<HelpWindow content={helpContent} {help} page={helpPage} anchor={helpAnchor} />
