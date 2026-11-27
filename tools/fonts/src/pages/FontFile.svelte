<script lang="ts">
	import { navigate } from '@in-browser/brand/navigate.js';
	// A font file of the user's files (opened with “Open with”, `?path=`): a sample and what it says about itself, and
	// “Add to my fonts”.
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import type { Command } from '@in-browser/brand/commands.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { RibbonTab } from '@in-browser/brand/ribbon.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { showError } from '@in-browser/files/errors.js';
	import { read } from '@in-browser/files/fs.js';
	import { basename } from '@in-browser/files/path.js';
	import { addFonts, describeFont, FONT_FOLDER, type FontFileInfo } from '@in-browser/graphics/user-fonts.svelte.js';
	import FontFacts from '#lib/components/FontFacts.svelte';
	import { familyUrl } from '#lib/brand.js';
	import { m } from '#lib/i18n/index.js';

	const path = $derived(page.url.searchParams.get('path') ?? '');
	let info = $state<FontFileInfo | null>(null);
	let problem = $state<string | null>(null);
	let face = $state<FontFace | null>(null);
	let adding = $state(false);

	$effect(() => setBrandBar({ crumbs: [{ label: basename(path) }] }));
	$effect(() => {
		const p = path;
		let gone = false;
		info = null;
		problem = null;
		(async () => {
			try {
				const bytes = new Uint8Array(await (await read(p)).arrayBuffer());
				const found = await describeFont(bytes, p, 0);
				if (gone) return;
				if (!found) return void (problem = m.file.notFont);
				info = found.info;
				const loaded = await new FontFace(`InBrowserPreview${Date.now()}`, bytes.slice().buffer).load();
				document.fonts.add(loaded);
				if (!gone) face = loaded;
			} catch (e) {
				if (!gone) problem = m.file.missing;
				console.warn('[fonts] file', e);
			}
		})();
		return () => {
			gone = true;
		};
	});

	const inFolder = $derived(path.startsWith(`${FONT_FOLDER}/`));
	const commands = {
		install: {
			id: 'install',
			label: m.file.install,
			icon: 'icon-[material-symbols-light--add]',
			enabled: () => !!info && !inFolder && !adding,
			run: async () => {
				adding = true;
				try {
					await addFonts({ paths: [path] });
					toast(m.file.added(info!.family), 'success', 8000, { label: m.commands.open, run: () => navigate(familyUrl(info!.family)) });
				} catch (e) {
					showError(e, { context: '[fonts] add' });
				} finally {
					adding = false;
				}
			}
		}
	} satisfies Record<string, Command>;
	const tabs: RibbonTab[] = [{ id: 'home', label: m.ribbon.tabs.home, groups: [{ id: 'add', label: m.ribbon.groups.add, items: [commands.install] }] }];
</script>

<div class="flex h-full min-h-0 flex-col">
	<Ribbon {tabs} storage="fonts" />
	<main class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
		{#if problem}
			<p class="text-sm">{problem}</p>
		{:else if !info}
			<span class="loading loading-spinner"></span>
		{:else}
			<span class="text-3xl break-words" style:font-family={face ? face.family : undefined}>{m.commands.sampleDefault}</span>
			{#if inFolder}<p class="text-sm opacity-70">{m.file.already}</p>{/if}
			<FontFacts {info} />
			<p class="max-w-prose text-xs opacity-70">{m.family.embeddingHint}</p>
		{/if}
	</main>
</div>
