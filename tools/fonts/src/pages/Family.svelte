<script lang="ts">
	// One of the user's fonts (`?name=` its family): each face in a sample, and every file with what it says about
	// itself. “Delete” moves its files into the trash.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import type { Command } from '@in-browser/brand/commands.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { RibbonTab } from '@in-browser/brand/ribbon.js';
	import { FONT_FACES, fontFamilyCss, loadFonts } from '@in-browser/graphics/fonts.js';
	import { loadUserFonts, removeFamilies, userFonts, watchUserFonts } from '@in-browser/graphics/user-fonts.svelte.js';
	import FontFacts from '#lib/components/FontFacts.svelte';
	import { m } from '#lib/i18n/index.js';

	const name = $derived(page.url.searchParams.get('name') ?? '');
	const family = $derived(userFonts.families.find((f) => f.family === name) ?? null);

	$effect(() => {
		void loadUserFonts();
		return watchUserFonts();
	});
	$effect(() => {
		if (family) void loadFonts([family.id]);
	});
	$effect(() => setBrandBar({ crumbs: [{ label: name }] }));

	const commands = {
		remove: {
			id: 'remove',
			label: m.commands.remove,
			icon: 'icon-[material-symbols-light--delete-outline]',
			enabled: () => !!family,
			run: async () => {
				if (family && (await removeFamilies([family.id]))) void goto(resolve('/fonts'));
			}
		}
	} satisfies Record<string, Command>;
	const tabs: RibbonTab[] = [{ id: 'home', label: m.ribbon.tabs.home, groups: [{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.remove] }] }];
</script>

<div class="flex h-full min-h-0 flex-col">
	<Ribbon {tabs} storage="fonts" />
	<main class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
		{#if !userFonts.loaded}
			<span class="loading loading-spinner"></span>
		{:else if !family}
			<p class="text-sm opacity-70">{m.family.missing}</p>
		{:else}
			<section class="flex flex-col gap-3">
				{#each FONT_FACES as face (face)}
					{@const file = family.faces[face]}
					<div class="flex flex-col gap-1">
						<span class="text-xs opacity-70">{m.family.faces[face]} – {file ? file.style : m.family.notUsed}</span>
						<span
							class={['text-3xl break-words', !file && 'opacity-40']}
							style="font-family: {fontFamilyCss(family.id)}; font-weight: {face.startsWith('bold') ? 700 : 400}; font-style: {face.toLowerCase().includes('italic') ? 'italic' : 'normal'}"
							>{m.commands.sampleDefault}</span
						>
					</div>
				{/each}
			</section>
			<section class="flex flex-col gap-4">
				{#each family.files as info (info.path)}
					<div class="border-base-300 rounded-box border p-3"><FontFacts {info} /></div>
				{/each}
				<p class="max-w-prose text-xs opacity-70">{m.family.embeddingHint}</p>
			</section>
		{/if}
	</main>
</div>
