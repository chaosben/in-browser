<script lang="ts">
	// The frame of every tool (its `pages/Layout.svelte` wraps the app's route in it): language, PWA, “Recently
	// used”, the sync with the folder on disk, head tags, BrandBar, BrandFooter with the sync indicator, help
	// window and keys, the settings, and the overlays every tool uses. Addresses come from the tool (`resolve`/`asset` of the app).
	import { untrack, type Snippet } from 'svelte';
	import BrandBar from '@in-browser/brand/BrandBar.svelte';
	import BrandFooter from '@in-browser/brand/BrandFooter.svelte';
	import { BRAND } from '@in-browser/brand/brand.js';
	import ConfirmDialog from '@in-browser/brand/ConfirmDialog.svelte';
	import ContextMenu from '@in-browser/brand/ContextMenu.svelte';
	import type { HelpContent } from '@in-browser/brand/help.js';
	import { installHelpKeys, type HelpState } from '@in-browser/brand/help.svelte.js';
	import HelpWindow from '@in-browser/brand/HelpWindow.svelte';
	import { setLocale, toolName, type Locale, type ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
	import { initPwa } from '@in-browser/brand/pwa.svelte.js';
	import { recordToolUse } from '@in-browser/brand/recent-tools.js';
	import Toasts from '@in-browser/brand/Toasts.svelte';
	import UpdateBanner from '@in-browser/brand/UpdateBanner.svelte';
	import FileDialog from './FileDialog.svelte';
	import OpenShareDialog from './OpenShareDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import { shareDialog } from './share-dialog.svelte.js';
	import SettingsDialog from './SettingsDialog.svelte';
	import { openSettings, suiteSettings } from './suite-settings.svelte.js';
	import SyncIndicator from './SyncIndicator.svelte';
	import { startSync } from './sync/sync.svelte.js';

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

	// Once when the tool loads (the language and the start page never change): pass the language on to the brand
	// components and the document, and count the tool for “Recently used” on the overview
	untrack(() => {
		setLocale(locale);
		recordToolUse(home);
	});
	initPwa();
	// Keeps the shared file system in sync with the folder on disk while the tool is open (if connected in Files)
	startSync();
	// The suite settings (author name …) as the tool's pages read them
	void suiteSettings.load();
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
<Toasts />
<ConfirmDialog />
<ContextMenu />
<FileDialog />
<SettingsDialog />
<UpdateBanner />
<HelpWindow content={helpContent} {help} page={helpPage} anchor={helpAnchor} />
{#if shareDialog.target}
	{#key shareDialog.target}<ShareDialog target={shareDialog.target} onclose={() => (shareDialog.target = null)} />{/key}
{/if}
{#if shareDialog.opening}
	<OpenShareDialog
		onclose={() => (shareDialog.opening = false)}
		onopened={(root) => {
			shareDialog.opening = false;
			// Files shows it (and opens a single shared file in its tool)
			location.assign(`/files?path=${encodeURIComponent(root)}&open`);
		}}
	/>
{/if}
