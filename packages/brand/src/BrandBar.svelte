<script lang="ts">
	import { resolve } from '$app/paths';
	import { BRAND } from './brand.js';
	import { brandBar, startRename } from './brand-bar.svelte.js';
	import { brandMessages } from './i18n/index.svelte.js';
	import ThemeSwitch from './ThemeSwitch.svelte';
	import { openMenuBelow, type MenuEntry } from './ui/context-menu.svelte.js';

	interface Props {
		/** Tool name; without it (overview) the brand links to its own home page. */
		tool?: string;
		/** Start page of the tool (e.g. `/screen-capture`), linked from the tool name */
		home?: string;
	}

	let { tool, home }: Props = $props();

	const t = $derived(brandMessages());

	/** Rename field: whole name selected; Enter keeps, Esc cancels, leaving keeps */
	function renameField(input: HTMLInputElement) {
		input.focus();
		input.select();
	}

	function commit(input: HTMLInputElement, rename: (name: string) => void, label: string) {
		if (!brandBar.renaming) return;
		brandBar.renaming = false;
		const name = input.value.trim();
		if (name && name !== label) rename(name);
	}
</script>

{#snippet menuButton(name: string, entries: MenuEntry[])}
	<button
		class="btn btn-ghost btn-xs btn-square"
		onclick={(e) => openMenuBelow(e, entries)}
		title={t.bar.actions(name)}
		aria-label={t.bar.actions(name)}
	>
		<span class="icon-[material-symbols-light--keyboard-arrow-down] size-5" aria-hidden="true"></span>
	</button>
{/snippet}

<!--
	Shared header of the in-browser.de apps. Left: brand / tool / the navigation inside the tool (`setBrandBar`,
	the current object with the menu of all its actions), then its main actions as buttons (from `md`); right: the
	less important actions of the tool and the theme.
-->
<header class="bg-base-300 text-base-content flex h-10 shrink-0 items-center gap-2 px-3 text-sm">
	<!-- From a tool, load the overview as a fresh page (separate layout and language handling) -->
	<a
		href={resolve('/')}
		data-sveltekit-reload={tool ? '' : undefined}
		class={['flex shrink-0 items-center gap-1.5 font-semibold', tool && 'opacity-80 hover:opacity-100']}
		title={tool ? t.brand.allTools : t.brand.home}
	>
		<!-- in-browser.de logo: browser window with cursor brackets -->
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
		{#if brandBar.menu?.length && brandBar.crumbs.length === 0}{@render menuButton(tool, brandBar.menu)}{/if}
	{/if}

	<nav class="flex min-w-0 flex-1 items-center gap-2">
		{#each brandBar.crumbs as crumb, i (i)}
			{@const last = i === brandBar.crumbs.length - 1}
			<span class="opacity-40" aria-hidden="true">/</span>
			<span class={['flex min-w-0 items-center gap-1', last ? 'shrink-0' : 'shrink']}>
				{#if last && crumb.rename && brandBar.renaming}
					{@const rename = crumb.rename}
					<input
						class="input input-xs w-56 font-semibold"
						value={crumb.label}
						aria-label={crumb.label}
						{@attach renameField}
						onkeydown={(e) => {
							if (e.key === 'Enter') commit(e.currentTarget, rename, crumb.label);
							else if (e.key === 'Escape') brandBar.renaming = false;
						}}
						onblur={(e) => commit(e.currentTarget, rename, crumb.label)}
					/>
				{:else if crumb.href}
					<a href={crumb.href} class="truncate hover:underline">{crumb.label}</a>
				{:else if crumb.onclick || (last && crumb.rename)}
					<button
						class={['truncate hover:underline', last && 'font-semibold']}
						title={last && crumb.rename ? t.bar.rename : undefined}
						onclick={() => (crumb.onclick ? crumb.onclick() : startRename())}
					>
						{crumb.label}
					</button>
				{:else}
					<span class={['truncate', last && 'font-semibold']}>{crumb.label}</span>
				{/if}
				{#if crumb.menu?.length}{@render menuButton(crumb.label, crumb.menu)}{/if}
				{#if crumb.status}<span class="shrink-0 text-xs opacity-50">{crumb.status}</span>{/if}
			</span>
		{/each}
		{#if brandBar.primary}
			<div class="hidden shrink-0 items-center gap-1 md:flex">
				<span class="bg-base-content/20 mx-1 h-5 w-px" aria-hidden="true"></span>
				{@render brandBar.primary()}
			</div>
		{/if}
	</nav>

	<div class="flex shrink-0 items-center gap-1">
		{@render brandBar.actions?.()}
		<ThemeSwitch />
	</div>
</header>
