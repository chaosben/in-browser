<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import type { HelpContent } from '@in-browser/brand/help.js';
	import HelpEntry from '@in-browser/brand/HelpEntry.svelte';
	import { lang, m } from '#lib/i18n/index.svelte.js';
	import Shell from '#lib/Shell.svelte';

	interface Props {
		title: string;
		summary: string;
		/** Address of this page (canonical URL) */
		path: string;
		content: HelpContent;
		/** Below the heading, e.g. a link to the tool */
		actions?: Snippet;
	}

	let { title, summary, path, content, actions }: Props = $props();

	// BrandBar: in-browser / Help (the page title is the heading; again after the switch to the browser language:
	// `m` is no state)
	$effect(() => {
		void lang.current;
		return setBrandBar({ crumbs: [{ label: m.help.title, href: resolve('/help') }] });
	});
</script>

<!-- One help page: all topics below each other, with a table of contents and an anchor per topic (`#<topic>`) -->
<Shell {title} description={summary} {path}>
	<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
		<header class="flex flex-col gap-2">
			<h1 class="text-2xl font-bold text-balance sm:text-4xl">{title}</h1>
			<p class="text-base-content/70 sm:text-lg">{summary}</p>
			{@render actions?.()}
		</header>

		<div class="flex flex-col gap-8 lg:flex-row lg:items-start">
			<nav class="lg:sticky lg:top-4 lg:w-56 lg:shrink-0" aria-label={m.help.contents}>
				<h2 class="mb-1 text-sm font-semibold opacity-70">{m.help.contents}</h2>
				<ul class="menu menu-sm w-full p-0">
					{#each Object.entries(content) as [id, topic] (id)}
						<li><a href="#{id}">{topic.title}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="flex min-w-0 flex-1 flex-col gap-10">
				{#each Object.entries(content) as [id, topic] (id)}
					<section {id} class="flex scroll-mt-4 flex-col gap-5">
						<h2 class="border-base-300 border-b pb-1 text-xl font-semibold">{topic.title}</h2>
						{#each Object.entries(topic.items) as [key, item] (key)}
							<div class="flex max-w-3xl flex-col gap-1"><HelpEntry {item} /></div>
						{/each}
					</section>
				{/each}
			</div>
		</div>
	</main>
</Shell>
