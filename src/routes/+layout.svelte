<script lang="ts">
	// The root of every page – the overview's (frame `#lib/Shell.svelte`) and every tool's (`/<tool>/+layout.svelte`,
	// frame `ToolLayout`). It holds what lives as long as the tab: `Suite.svelte` (the syncs, the overlays any page
	// asks for) and the way pages change – without reloading, so the connections of the syncs stay.
	import './layout.css';
	import { onMount, type Component } from 'svelte';
	import { goto, onNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import type { ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
	import { setNavigation } from '@in-browser/brand/navigate.js';
	import { leavePage } from '@in-browser/brand/ui/page-scope.js';
	import { tabStarted } from '#lib/i18n/index.svelte.js';
	import { TOOLS } from '#lib/tools.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Packages and tools go to other pages through this (`navigate`), never by loading the page anew
	setNavigation({
		go: (url, options) => goto(url, options?.replace ? { replace: true } : {}),
		readdress: (url) => replaceState(url, page.state)
	});

	// What a page asked and left open goes with it (`page-scope.ts`); the same page under another address (a folder
	// in Files, a parameter taken away) stays as it is
	onNavigate(({ from, to }) => {
		if (from?.url.pathname !== to?.url.pathname) leavePage();
	});

	const tool = $derived((TOOLS.find((t) => page.url.pathname === t.url || page.url.pathname.startsWith(`${t.url}/`))?.url.slice(1) ?? null) as ToolSlug | null);

	// The files modules load in the browser only: the overview is prerendered without them
	let Suite = $state<Component<{ received: string | null; tool: ToolSlug | null }> | null>(null);
	onMount(() => {
		tabStarted();
		void import('@in-browser/files/Suite.svelte').then((module) => (Suite = module.default));
	});
</script>

{@render children()}
{#if Suite}<Suite received={page.url.searchParams.get('received')} {tool} />{/if}
