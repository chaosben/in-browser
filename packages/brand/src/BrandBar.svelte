<script lang="ts">
	import { resolve } from '$app/paths';
	import { BRAND } from './brand.js';
	import { brandBar } from './brand-bar.svelte.js';
	import type { HelpState } from './help.svelte.js';
	import { brandMessages } from './i18n/index.svelte.js';
	import ThemeSwitch from './ThemeSwitch.svelte';

	interface Props {
		/** Tool name; without it (overview) the brand links to its own home page. */
		tool?: string;
		/** Start page of the tool (e.g. `/screen-capture`), linked from the tool name */
		home?: string;
		/** Help window of the tool: the help button toggles it */
		help?: HelpState;
		/** Without a help window (overview): the help button links to this page */
		helpHref?: string;
		/** Opens the suite settings (the gear at the right end) */
		onsettings?: () => void;
	}

	let { tool, home, help, helpHref, onsettings }: Props = $props();

	const t = $derived(brandMessages());
</script>

<!--
	Shared header of the in-browser apps. Left: brand / tool / where you are in the tool (`setBrandBar`: levels to go
	back to, the current one last). No actions of the tool (decided by the user: they are in its ribbon); right only
	what belongs to the suite: help, the theme and the settings.
-->
<header class="bg-base-300 text-base-content flex h-10 shrink-0 items-center gap-2 px-3 text-sm">
	<!-- From a tool, load the overview as a fresh page (separate layout and language handling) -->
	<a
		href={resolve('/')}
		data-sveltekit-reload={tool ? '' : undefined}
		class={['flex shrink-0 items-center gap-1.5 font-semibold', tool && 'opacity-80 hover:opacity-100']}
		title={tool ? t.brand.allTools : t.brand.home}
	>
		<!-- in-browser logo: browser window with cursor brackets -->
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
			<rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" />
			<path d="M2 8.5h20" stroke="currentColor" stroke-width="1.8" />
			<path d="M9 12l-2.5 2.5L9 17M15 12l2.5 2.5L15 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		<span class="hidden sm:inline">{BRAND.suite}</span>
	</a>
	{#if tool}
		<span class="opacity-40" aria-hidden="true">/</span>
		<a href={home} class="shrink-0 font-semibold hover:underline" title={t.brand.toolHome(tool)}>{tool}</a>
	{/if}

	<nav class="flex min-w-0 flex-1 items-center gap-2">
		{#each brandBar.crumbs as crumb, i (i)}
			{@const last = i === brandBar.crumbs.length - 1}
			<span class="opacity-40" aria-hidden="true">/</span>
			<!-- Earlier levels give way first; on narrow screens the current one truncates too -->
			<span class={['flex min-w-0 items-center', last ? 'shrink' : 'shrink-[4]']}>
				{#if crumb.href}
					<a href={crumb.href} class={['truncate hover:underline', last && 'font-semibold']}>{crumb.label}</a>
				{:else if crumb.onclick}
					<button class={['truncate hover:underline', last && 'font-semibold']} onclick={crumb.onclick}>{crumb.label}</button>
				{:else}
					<span class={['truncate', last && 'font-semibold']}>{crumb.label}</span>
				{/if}
			</span>
		{/each}
	</nav>

	<div class="flex shrink-0 items-center gap-1">
		{#if help}
			<button
				class={['btn btn-sm btn-ghost', help.open && 'btn-active']}
				onclick={() => help.toggle()}
				aria-pressed={help.open}
				title={t.help.buttonTitle}
			>
				<span class="icon-[material-symbols-light--help-outline] size-5" aria-hidden="true"></span>
				<span class="hidden md:inline">{t.help.button}</span>
			</button>
		{:else if helpHref}
			<a class="btn btn-sm btn-ghost" href={helpHref} title={t.help.title}>
				<span class="icon-[material-symbols-light--help-outline] size-5" aria-hidden="true"></span>
				<span class="hidden md:inline">{t.help.button}</span>
			</a>
		{/if}
		<ThemeSwitch />
		{#if onsettings}
			<button class="btn btn-sm btn-ghost btn-square" onclick={onsettings} title={t.bar.settings} aria-label={t.bar.settings}>
				<span class="icon-[material-symbols-light--settings-outline] size-5" aria-hidden="true"></span>
			</button>
		{/if}
	</div>
</header>
