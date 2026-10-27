<script lang="ts">
	import { resolve } from '$app/paths';
	import { BRAND } from './brand.js';
	import { brandMessages } from './i18n/index.svelte.js';
	import { install, pwa } from './pwa.svelte.js';
	import ThemeSwitch from './ThemeSwitch.svelte';

	interface Props {
		/** Tool name; without it (overview) the brand links to its own home page. */
		tool?: string;
	}

	let { tool }: Props = $props();

	const t = $derived(brandMessages());
</script>

<!-- Shared header of the in-browser.de apps: brand (and tool) on the left, privacy note and theme on the right -->
<header class="bg-base-300 text-base-content flex h-9 shrink-0 items-center gap-2 px-3 text-sm">
	<a
		href={tool ? BRAND.suiteUrl : resolve('/')}
		class={['flex items-center gap-1.5 font-semibold', tool && 'opacity-80 hover:opacity-100']}
		title={tool ? t.brand.allTools : t.brand.home}
	>
		<!-- in-browser.de logo: browser window with cursor brackets -->
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
			<rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" />
			<path d="M2 8.5h20" stroke="currentColor" stroke-width="1.8" />
			<path d="M9 12l-2.5 2.5L9 17M15 12l2.5 2.5L15 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		{BRAND.suite}
	</a>
	{#if tool}
		<span class="opacity-40" aria-hidden="true">/</span>
		<a href={resolve('/')} class="font-semibold hover:underline" title={t.brand.toolHome(tool)}>{tool}</a>
	{/if}

	<div class="ml-auto flex items-center gap-2">
		<span
			class="badge badge-ghost badge-sm tooltip tooltip-left hidden gap-1 sm:inline-flex"
			data-tip={t.brand.localOnlyHint}
		>
			<span class="icon-[material-symbols-light--lock-outline] size-4" aria-hidden="true"></span>
			{t.brand.localOnly}
		</span>
		<!-- Only in apps with initPwa() and only when the browser offers installation -->
		{#if pwa.installable}
			<button class="btn btn-ghost btn-xs gap-1" onclick={install} title={t.pwa.installHint}>
				<span class="icon-[material-symbols-light--install-desktop] size-5" aria-hidden="true"></span>
				<span class="hidden sm:inline">{t.pwa.install}</span>
			</button>
		{/if}
		<ThemeSwitch />
	</div>
</header>
