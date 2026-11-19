<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND } from '@in-browser/brand/brand.js';
import { recentTools } from '@in-browser/brand/recent-tools.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import { sections } from '#lib/launcher.js';
	import Shell from '#lib/Shell.svelte';
	import { REQUIREMENTS, TOOLS, type Requirement, type Tool } from '#lib/tools.js';

	const PRINCIPLES = ['local', 'account', 'tracking', 'devices', 'offline'] as const;
	const FOCUS = 'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2';

	let query = $state('');
	const searching = $derived(query.trim() !== '');
	const shown = $derived(sections(TOOLS, query));

	// Browser only (the page is prerendered): recently used tools and what this browser lacks
	let recent = $state<Tool[]>([]);
	let missing = $state<Requirement[]>([]);
	/** Badges in the legend: only those a shown tool carries */
	const legend = $derived(missing.filter((need) => shown.some((section) => section.tools.some((tool) => tool.requires === need))));

	onMount(() => {
		missing = (Object.keys(REQUIREMENTS) as Requirement[]).filter((need) => !REQUIREMENTS[need]());
		recent = recentTools().flatMap((url) => TOOLS.find((tool) => tool.url === url) ?? []);
	});

const lacks = (tool: Tool) => (tool.requires && missing.includes(tool.requires) ? tool.requires : null);
</script>

{#snippet badge(need: Requirement)}
	<span class="bg-base-100 border-base-300 grid size-5.5 place-items-center rounded-full border">
		{#if need === 'displayCapture'}
			<span class="icon-[material-symbols-light--desktop-windows-outline] size-4" aria-hidden="true"></span>
		{/if}
	</span>
{/snippet}

<Shell>
	<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:py-12">
		<section class="flex flex-col gap-2">
			<h1 class="text-2xl font-bold text-balance sm:text-4xl">{m.home.title}</h1>
			<p class="text-base-content/70 sm:text-lg">{m.home.tagline}</p>
		</section>

		<label class="input h-11 w-full text-base sm:h-12 sm:max-w-xl">
			<span class="icon-[material-symbols-light--search] size-6 opacity-70" aria-hidden="true"></span>
			<span class="sr-only">{m.home.searchLabel}</span>
			<input type="search" bind:value={query} placeholder={m.home.searchPlaceholder} class="placeholder:text-base-content/70" />
		</label>

		{#if recent.length && !searching}
			<section class="flex flex-col gap-2" aria-labelledby="recent-heading">
				<h2 id="recent-heading" class="text-base-content/70 text-sm font-semibold">{m.home.recent}</h2>
				<!-- Phones: one row that scrolls to the screen edge; wider: wraps -->
				<ul class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
					{#each recent as tool (tool.id)}
						<li class="shrink-0">
							<a
								href={tool.url}
								data-sveltekit-reload
								class="border-base-300 bg-base-100 hover:bg-base-200 flex h-11 items-center gap-2 rounded-full border ps-1.5 pe-4 text-sm font-medium {FOCUS}"
							>
								<img src={tool.icon} alt="" class="size-8" width="32" height="32" />
								{m.tools[tool.id].name}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="flex flex-col gap-8">
			{#each shown as section (section.category)}
				<section class="flex flex-col gap-3" aria-labelledby="category-{section.category}">
					<h2 id="category-{section.category}" class="text-lg font-semibold">
						{m.categories[section.category]}
						<span class="text-base-content/70 font-normal">· {section.tools.length}</span>
					</h2>
					<!-- Phones: icon grid like a home screen; wider: tiles with a one-line summary -->
					<ul class="grid grid-cols-4 gap-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-3">
						{#each section.tools as tool (tool.id)}
							{@const text = m.tools[tool.id]}
							{@const need = lacks(tool)}
							<li class="flex">
								<!-- Tools load as a fresh page (own layout, language and Service Worker) -->
								<a
									href={tool.url}
									data-sveltekit-reload
									class="hover:bg-base-200 sm:border-base-300 sm:bg-base-100 flex min-h-24 w-full flex-col items-center gap-1.5 rounded-xl px-1 pt-2 pb-1 text-center sm:min-h-18 sm:flex-row sm:gap-3 sm:border sm:p-3 sm:text-start {FOCUS}"
								>
									<span class="relative shrink-0">
										<img src={tool.icon} alt="" class="size-14 sm:size-11" width="56" height="56" />
										{#if need}<span class="absolute -right-1 -bottom-1">{@render badge(need)}</span>{/if}
									</span>
									<span class="flex min-w-0 flex-col">
										<span class="line-clamp-2 text-xs sm:line-clamp-1 sm:text-[15px] sm:font-semibold">
											{text.name}{#if need}<span class="sr-only"> {m.requires[need].label}</span>{/if}
										</span>
										<span class="text-base-content/70 hidden truncate text-[13px] sm:block">{text.summary}</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
			<!-- Always present, so screen readers announce when nothing matches -->
			<p class="text-base-content/70 empty:hidden" role="status">{#if !shown.length}{m.home.noMatch(query.trim())}{/if}</p>

			{#if legend.length}
				<ul class="text-base-content/70 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-hidden="true">
					{#each legend as need (need)}
						<li class="flex items-center gap-2">{@render badge(need)}{m.requires[need].legend}</li>
					{/each}
				</ul>
			{/if}
		</div>

		<section class="border-base-300 border-t pt-6" aria-labelledby="principles-heading">
			<h2 id="principles-heading" class="sr-only">{m.home.principlesHeading}</h2>
			<ul class="text-base-content/70 flex flex-wrap gap-x-6 gap-y-2 text-sm">
				{#each PRINCIPLES as key (key)}
					<li><strong class="text-base-content font-semibold">{m.principles[key].title}</strong> – {m.principles[key].text}</li>
				{/each}
				<li>
					<strong class="text-base-content font-semibold">{m.principles.openSource.title}</strong> –
					{m.principles.openSource.text},
					<a class="link" href={BRAND.repoUrl} target="_blank" rel="noopener">{m.principles.openSource.link}</a>
				</li>
			</ul>
		</section>
	</main>
</Shell>
