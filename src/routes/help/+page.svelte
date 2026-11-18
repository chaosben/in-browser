<script lang="ts">
	import { resolve } from '$app/paths';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { helpSearchTexts, type HelpContent, type HelpItem } from '@in-browser/brand/help.js';
	import HelpEntry from '@in-browser/brand/HelpEntry.svelte';
	import { matchesQuery } from '@in-browser/brand/ui/search.js';
	import { SUITE_PAGES, TOOL_HELP, toolHelpPath } from '#lib/help.js';
	import { lang, locale, m } from '#lib/i18n/index.svelte.js';
	import Shell from '#lib/Shell.svelte';
	import { TOOLS } from '#lib/tools.js';

	let query = $state('');

	// Again after the switch to the browser language (`m` is no state)
	$effect(() => {
		void lang.current;
		return setBrandBar({ crumbs: [{ label: m.help.title }] });
	});

	/** Every help page in the current language: title, address, topics */
	function pages(): { title: string; path: string; content: HelpContent }[] {
		return [
			...SUITE_PAGES.map((page) => ({ title: m.help.pages[page.id].title, path: page.path, content: m.help.pages[page.id].topics })),
			...TOOLS.map((tool) => ({ title: m.tools[tool.id].name, path: toolHelpPath(tool), content: TOOL_HELP[tool.id][locale] }))
		];
	}

	/** Matching entries of all pages (functions, not $derived: `m` is no state – the frame re-renders on a switch) */
	function results(): { id: string; page: string; topic: string; href: string; item: HelpItem }[] {
		return pages().flatMap((page) =>
			Object.entries(page.content).flatMap(([topicId, topic]) =>
				Object.entries(topic.items)
					.filter(([, item]) => matchesQuery(query, page.title, topic.title, ...helpSearchTexts(item)))
					.map(([key, item]) => ({ id: `${page.path}#${topicId}.${key}`, page: page.title, topic: topic.title, href: `${page.path}#${topicId}`, item }))
			)
		);
	}
</script>

{#snippet card(href: string, title: string, summary: string, icon: string | null, image: string | null)}
	<a
		{href}
		class="bg-base-100 border-base-300 rounded-box hover:border-primary flex gap-3 border p-4 transition-colors"
	>
		{#if image}
			<img src={image} alt="" class="size-8 shrink-0" width="32" height="32" />
		{:else if icon}
			<span class="{icon} text-primary size-8 shrink-0" aria-hidden="true"></span>
		{/if}
		<span class="flex flex-col gap-0.5">
			<span class="font-semibold">{title}</span>
			<span class="text-base-content/70 text-sm">{summary}</span>
		</span>
	</a>
{/snippet}

<Shell title={m.help.title} description={m.help.intro} path="/help">
	<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:py-12">
		<section class="flex flex-col gap-2">
			<h1 class="text-2xl font-bold text-balance sm:text-4xl">{m.help.title}</h1>
			<p class="text-base-content/70 sm:text-lg">{m.help.intro}</p>
		</section>

		<label class="input h-11 w-full text-base sm:h-12 sm:max-w-xl">
			<span class="icon-[material-symbols-light--search] size-6 opacity-70" aria-hidden="true"></span>
			<input type="search" class="grow" placeholder={m.help.searchPlaceholder} aria-label={m.help.searchLabel} bind:value={query} />
		</label>

		{#if query.trim()}
			<section class="flex flex-col gap-3" aria-live="polite">
				{#each results() as r (r.id)}
					<div class="border-base-300 rounded-box flex max-w-3xl flex-col gap-1 border p-3">
						<a class="link link-hover w-fit text-xs opacity-70" href={r.href}>{r.page} › {r.topic}</a>
						<HelpEntry item={r.item} />
					</div>
				{:else}
					<p class="opacity-70">{m.help.noMatch(query)}</p>
				{/each}
			</section>
		{:else}
			<section class="flex flex-col gap-3">
				<h2 class="text-lg font-semibold">{m.help.suite}</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each SUITE_PAGES as page (page.id)}
						{@render card(page.path, m.help.pages[page.id].title, m.help.pages[page.id].summary, page.icon, null)}
					{/each}
				</div>
			</section>
			<section class="flex flex-col gap-3">
				<h2 class="text-lg font-semibold">{m.help.tools}</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each TOOLS as tool (tool.id)}
						{@render card(toolHelpPath(tool), m.tools[tool.id].name, m.help.toolSummary(m.tools[tool.id].name), null, tool.icon)}
					{/each}
				</div>
			</section>
		{/if}
		<p class="text-sm opacity-70"><a class="link" href={resolve('/')}>{m.error.back}</a></p>
	</main>
</Shell>
