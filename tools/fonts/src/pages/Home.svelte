<script lang="ts">
	// The user's fonts (`@in-browser/graphics/user-fonts.svelte.js`) as cards, each written in itself: a click opens
	// its page, Ctrl/Shift pick several (`Picker`), the menu (right click, long press, ⋯) opens or deletes. Font files
	// are added from the files, from the computer or dropped; the catalog has its own page.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { installCommandKeys, type Command } from '@in-browser/brand/commands.js';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { GroupSize, RibbonTab } from '@in-browser/brand/ribbon.js';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFiles } from '@in-browser/files/dialog.svelte.js';
	import { showError } from '@in-browser/files/errors.js';
	import NumberField from '@in-browser/graphics/NumberField.svelte';
	import { fontFamilyCss, loadFonts } from '@in-browser/graphics/fonts.js';
	import { addFonts, FONT_TYPES, loadUserFonts, removeFamilies, userFonts, watchUserFonts, type UserFamily } from '@in-browser/graphics/user-fonts.svelte.js';
	import { familyUrl } from '#lib/brand.js';
	import { m } from '#lib/i18n/index.js';
	import type { Snippet } from 'svelte';

	const stored = loadJson<{ sample?: unknown; size?: unknown }>('fonts:preview', {});
	let sample = $state(typeof stored.sample === 'string' ? stored.sample : '');
	let size = $state(typeof stored.size === 'number' && stored.size >= 8 && stored.size <= 96 ? stored.size : 28);
	$effect(() => storeJson('fonts:preview', { sample, size }));

	let query = $state('');
	const shown = $derived(userFonts.families.filter((f) => f.family.toLowerCase().includes(query.trim().toLowerCase())));
	const order = $derived(shown.map((f) => f.id as string));
	const picker = new Picker<string>();
	let input = $state<HTMLInputElement>();

	$effect(() => {
		void loadUserFonts();
		return watchUserFonts();
	});
	// Each card is written in its font
	$effect(() => {
		void loadFonts(userFonts.families.map((f) => f.id));
	});

	const picked = () => userFonts.families.filter((f) => picker.has(f.id));

	async function add(from: Parameters<typeof addFonts>[0]) {
		try {
			const added = await addFonts(from);
			if (added.length) toast(m.home.added(added.length), 'success');
			else toast(m.home.notFonts, 'warning', 8000);
		} catch (e) {
			showError(e, { context: '[fonts] add' });
		}
	}

	async function addFromFiles() {
		const paths = await chooseFiles({ mode: 'open', folder: '/', accept: FONT_TYPES, multiple: true, title: m.commands.addFromFiles });
		if (paths?.length) await add({ paths });
	}

	function remove(ids: readonly string[]) {
		void removeFamilies(ids as UserFamily['id'][]).then(() => picker.clear());
	}

	const commands = {
		addFromFiles: { id: 'addFromFiles', label: m.commands.addFromFiles, tip: m.commands.addFromFilesTip, icon: 'icon-[material-symbols-light--add]', run: () => void addFromFiles() },
		addFromComputer: { id: 'addFromComputer', label: m.commands.addFromComputer, icon: 'icon-[material-symbols-light--upload]', run: () => input?.click() },
		catalog: { id: 'catalog', label: m.commands.catalog, tip: m.commands.catalogTip, icon: 'icon-[material-symbols-light--travel-explore]', run: () => void goto(resolve('/fonts/catalog')) },
		remove: { id: 'remove', label: m.commands.remove, icon: 'icon-[material-symbols-light--delete-outline]', shortcut: { key: 'Delete' }, enabled: () => picker.selected.size > 0, run: () => remove(picked().map((f) => f.id)) },
		selectAll: { id: 'selectAll', label: m.commands.selectAll, icon: 'icon-[material-symbols-light--select-all]', shortcut: { key: 'a', ctrl: true }, enabled: () => order.length > 0, run: () => picker.selectAll(order) },
		clearSelection: { id: 'clearSelection', label: m.commands.clearSelection, icon: 'icon-[material-symbols-light--deselect]', enabled: () => picker.selected.size > 0, run: () => picker.clear() }
	} satisfies Record<string, Command>;

	$effect(() => installCommandKeys(() => Object.values(commands)));

	const tabs: RibbonTab[] = [
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'add', label: m.ribbon.groups.add, items: [commands.addFromFiles, commands.addFromComputer, commands.catalog] },
				{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.remove] },
				{ id: 'select', label: m.ribbon.groups.select, items: [commands.selectAll, commands.clearSelection] },
				{
					id: 'preview',
					label: m.ribbon.groups.preview,
					items: [
						{ id: 'sample', label: m.commands.sample, custom: sampleField },
						{ id: 'size', label: m.commands.size, custom: sizeField }
					]
				}
			]
		}
	];

	function menu(family: UserFamily): MenuEntry[] {
		return [
			{ label: m.commands.open, icon: 'icon-[material-symbols-light--open-in-new]', href: familyUrl(family.family), run: () => void goto(familyUrl(family.family)) },
			{ separator: true },
			{ label: m.commands.remove, icon: 'icon-[material-symbols-light--delete-outline]', keys: 'Del', run: () => remove(picker.has(family.id) ? picked().map((f) => f.id) : [family.id]) }
		];
	}

	function click(e: MouseEvent, family: UserFamily) {
		if (picker.click(e, family.id, order) === 'open') {
			e.preventDefault();
			void goto(familyUrl(family.family));
		} else e.preventDefault();
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		const files = [...(e.dataTransfer?.files ?? [])].filter((f) => FONT_TYPES.some((t) => f.name.toLowerCase().endsWith(t)));
		if (files.length) void add({ files });
	}

	$effect(() => setBrandFooter({ status: footer as Snippet }));
</script>

{#snippet footer()}
	<span>{picker.selected.size ? m.home.picked(picker.selected.size) : m.home.count(userFonts.families.length)}</span>
{/snippet}

{#snippet sampleField(_size: GroupSize)}
	<input class="input input-sm w-40 lg:w-64" bind:value={sample} placeholder={m.commands.sampleDefault} aria-label={m.commands.sample} />
{/snippet}

{#snippet sizeField(_size: GroupSize)}
	<div class="w-32"><NumberField label={m.commands.size} value={size} unit="px" min={8} max={96} oninput={(v) => (size = v)} /></div>
{/snippet}

<div class="flex h-full min-h-0 flex-col">
	<Ribbon {tabs} storage="fonts" />
	<input bind:this={input} type="file" accept={FONT_TYPES.join(',')} multiple hidden onchange={(e) => add({ files: [...(e.currentTarget.files ?? [])] })} />
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<main class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" ondragover={(e) => e.preventDefault()} ondrop={drop} onpointerdown={(e) => picker.pointerdown(e)}>
		<label class="input input-sm w-full max-w-sm">
			<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
			<input type="search" bind:value={query} placeholder={m.home.search} aria-label={m.home.search} />
		</label>
		{#if !userFonts.loaded}
			<span class="loading loading-spinner m-6"></span>
		{:else if !userFonts.families.length}
			<p class="max-w-prose text-sm opacity-70">{m.home.empty} {m.home.dropHint}</p>
		{:else if !shown.length}
			<p class="text-sm opacity-70">{m.home.noMatch}</p>
		{:else}
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each shown as family (family.id)}
					{@const isPicked = picker.has(family.id)}
					<li class="relative" oncontextmenu={(e) => (picker.menu(e, family.id), openContextMenu(e, menu(family)))}>
						<a
							href={familyUrl(family.family)}
							class={['border-base-300 flex h-full flex-col gap-2 rounded-box border p-4', isPicked ? 'bg-selection/20' : 'hover:bg-base-200']}
							aria-current={isPicked || undefined}
							onclick={(e) => click(e, family)}
						>
							<span class="flex items-baseline gap-2 pr-8">
								<span class="truncate font-medium">{family.family}</span>
								<span class="shrink-0 text-xs opacity-70">{m.home.faces(family.files.length)}</span>
							</span>
							<span class="line-clamp-2 break-words" style="font-family: {fontFamilyCss(family.id)}; font-size: {size}px; line-height: 1.2">{sample || m.commands.sampleDefault}</span>
						</a>
						{#if picker.marking}<PickMark picked={isPicked} class="absolute top-3 left-3" />{/if}
						<MoreButton
							name={family.family}
							class={coarsePointer.current ? 'absolute top-2 right-2' : 'absolute top-2 right-2 opacity-60 hover:opacity-100'}
							entries={() => {
								if (picker.marking) picker.selected.add(family.id);
								else if (!picker.has(family.id)) picker.clear();
								return menu(family);
							}}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
