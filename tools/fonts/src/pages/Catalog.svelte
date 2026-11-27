<script lang="ts">
	import { navigate } from '@in-browser/brand/navigate.js';
	// The catalog of free fonts (Fontsource): nothing is asked before the user searches. The list comes once from its
	// API, a font's files (TrueType, one set of characters each) from jsDelivr; installing puts its regular, bold,
	// italic and bold italic files into the user's fonts (`addFontBytes`), from then on offline like every other one.
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { resolve } from '$app/paths';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { RibbonTab } from '@in-browser/brand/ribbon.js';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { addFontBytes, loadUserFonts, userFonts } from '@in-browser/graphics/user-fonts.svelte.js';
	import { familyUrl } from '#lib/brand.js';
	import { m } from '#lib/i18n/index.js';

	const API = 'https://api.fontsource.org/v1/fonts';
	/** Results shown at most (type more to narrow it down) */
	const SHOWN = 150;

	interface Entry {
		id: string;
		family: string;
		category: string;
		subsets: string[];
		weights: number[];
		styles: string[];
		defSubset: string;
		license: string;
	}
	interface Details extends Entry {
		/** weight → style → subset → file URLs */
		variants: Record<string, Record<string, Record<string, { url: { ttf?: string } }>>>;
	}

	/** Fontsource's kinds of fonts, in this order; `all` none chosen */
	const CATEGORIES = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace', 'other'] as const;
	type Category = (typeof CATEGORIES)[number];
	const kept = loadJson<{ category?: unknown }>('fonts:catalog', {});

	let query = $state('');
	let category = $state<Category>(CATEGORIES.includes(kept.category as Category) ? (kept.category as Category) : 'all');
	$effect(() => storeJson('fonts:catalog', { category }));
	let list = $state.raw<Entry[] | null>(null);
	/** What was searched last: a name (may be empty when a kind is chosen) – null before the first search */
	let searched = $state<string | null>(null);
	let searching = $state(false);
	let failed = $state<string | null>(null);
	/** A kind chosen alone lists all of it; nothing is asked before the first search or kind chosen */
	const results = $derived(
		searched === null || (!searched && category === 'all')
			? []
			: (list ?? []).filter((f) => f.family.toLowerCase().includes(searched!.toLowerCase()) && (category === 'all' || (CATEGORIES.includes(f.category as Category) ? f.category : 'other') === category))
	);

	let chosen = $state.raw<Details | null>(null);
	let subset = $state('latin');
	let preview = $state<string | null>(null);
	let installing = $state(false);

	$effect(() => setBrandBar({ crumbs: [{ label: m.catalog.title }] }));
	$effect(() => void loadUserFonts());

	async function fetchJson<T>(url: string): Promise<T> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
		return response.json() as Promise<T>;
	}

	async function search(e?: SubmitEvent) {
		e?.preventDefault();
		const q = query.trim();
		if (!q && category === 'all') return;
		failed = null;
		searching = true;
		try {
			list ??= await fetchJson<Entry[]>(API);
			searched = q;
		} catch (err) {
			failed = m.catalog.failed(err instanceof Error ? err.message : String(err));
		} finally {
			searching = false;
		}
	}

	/** A kind chosen: its fonts at once (the first time, that is the request to the catalog) */
	function pick(c: Category) {
		category = c;
		if (c !== 'all' || query.trim()) void search();
	}

	async function fileOf(details: Details, weight: number, style: string, set: string): Promise<Uint8Array | null> {
		const url = details.variants[String(weight)]?.[style]?.[set]?.url.ttf;
		if (!url) return null;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
		return new Uint8Array(await response.arrayBuffer());
	}

	/** Of a font's weights the one nearest to `target` (bold: only 600 and above) */
	const nearest = (weights: number[], target: number) => [...weights].filter((w) => (target >= 600 ? w >= 600 : w < 600)).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];

	async function choose(entry: Entry) {
		failed = null;
		preview = null;
		try {
			const details = await fetchJson<Details>(`${API}/${encodeURIComponent(entry.id)}`);
			chosen = details;
			subset = details.subsets.includes('latin') ? 'latin' : details.defSubset;
			await showPreview();
		} catch (err) {
			failed = m.catalog.failed(err instanceof Error ? err.message : String(err));
		}
	}

	async function showPreview() {
		const details = chosen;
		if (!details) return;
		preview = null;
		const weight = nearest(details.weights, 400) ?? details.weights[0];
		const bytes = await fileOf(details, weight, details.styles.includes('normal') ? 'normal' : details.styles[0], subset).catch(() => null);
		if (!bytes || chosen !== details) return;
		const face = await new FontFace(`InBrowserCatalog${Date.now()}`, bytes.slice().buffer).load();
		document.fonts.add(face);
		preview = face.family;
	}

	async function install() {
		const details = chosen;
		if (!details) return;
		installing = true;
		try {
			const faces: [number | undefined, string][] = [
				[nearest(details.weights, 400), 'normal'],
				[nearest(details.weights, 700), 'normal'],
				[nearest(details.weights, 400), 'italic'],
				[nearest(details.weights, 700), 'italic']
			];
			// Every file first, then into the fonts: nothing is installed by halves
			const files: { name: string; bytes: Uint8Array }[] = [];
			for (const [weight, style] of faces) {
				if (weight === undefined || !details.styles.includes(style)) continue;
				const bytes = await fileOf(details, weight, style, subset);
				if (bytes) files.push({ name: `${details.id}-${subset}-${weight}-${style}.ttf`, bytes });
			}
			for (const f of files) await addFontBytes(f.name, f.bytes);
			toast(m.catalog.installed(details.family), 'success', 8000, { label: m.commands.open, run: () => navigate(familyUrl(details.family)) });
		} catch (err) {
			failed = m.catalog.failed(err instanceof Error ? err.message : String(err));
		} finally {
			installing = false;
		}
	}

	const installed = (family: string) => userFonts.families.some((f) => f.family === family);
	const tabs: RibbonTab[] = [
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [{ id: 'add', label: m.ribbon.groups.add, items: [{ id: 'myFonts', label: m.commands.myFonts, icon: 'icon-[material-symbols-light--font-download-outline]', run: () => navigate(resolve('/fonts')) }] }]
		}
	];
</script>

<div class="flex h-full min-h-0 flex-col">
	<Ribbon {tabs} storage="fonts" />
	<!-- Phones: one column that scrolls, the chosen font sticks on top of the list. Wider: the list and the chosen
	     font scroll each on their own, so the preview never scrolls away with the list -->
	<main class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:grid md:grid-cols-[24rem_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
		<section class="flex min-w-0 flex-col gap-3 md:col-start-1 md:row-start-1">
			<p class="text-xs opacity-70">{m.catalog.privacy}</p>
			<form class="flex gap-2" onsubmit={search}>
				<input class="input input-sm min-w-0 flex-1" type="search" bind:value={query} placeholder={m.catalog.placeholder} aria-label={m.catalog.placeholder} />
				<button class="btn btn-primary btn-sm" type="submit" disabled={(!query.trim() && category === 'all') || searching}>{m.catalog.search}</button>
			</form>
			<div class="flex flex-wrap gap-1" role="group" aria-label={m.catalog.category}>
				{#each CATEGORIES as c (c)}
					<button type="button" class={['btn btn-xs', category === c ? 'btn-active' : 'btn-ghost']} aria-pressed={category === c} onclick={() => pick(c)}>
						{c === 'all' ? m.catalog.allCategories : m.catalog.categories[c]}
					</button>
				{/each}
			</div>
			<!-- Always there, so the list doesn't jump -->
			<p class="min-h-5 text-sm">
				{#if searching}{m.catalog.searching}{:else if failed}{failed}{:else if searched !== null && (searched || category !== 'all')}{results.length ? m.catalog.results(results.length) : m.catalog.none}{/if}
			</p>
		</section>
		{#if chosen}
			<section
				class="border-base-300 bg-base-100 sticky top-0 z-10 -mx-4 flex min-w-0 flex-col gap-3 border-b px-4 pb-3 md:static md:col-start-2 md:row-span-2 md:row-start-1 md:mx-0 md:overflow-y-auto md:border-b-0 md:border-l md:pr-0 md:pb-0"
			>
				<h2 class="text-lg font-medium">{chosen.family}</h2>
				<p class="text-sm opacity-70">
					{m.catalog.categories[chosen.category] ?? chosen.category} · {m.catalog.styles(chosen.weights.length * chosen.styles.length)} · {m.catalog.license(chosen.license)}
				</p>
				<span class="min-h-12 text-3xl break-words" style:font-family={preview ?? undefined}>{preview ? m.commands.sampleDefault : m.catalog.preview}</span>
				<label class="flex flex-col gap-1 text-sm">
					{m.catalog.subset}
					<select class="select select-sm w-auto" bind:value={subset} onchange={() => void showPreview()}>
						{#each chosen.subsets as s (s)}<option value={s}>{s}</option>{/each}
					</select>
					<span class="text-xs opacity-70">{m.catalog.subsetHint}</span>
				</label>
				<div class="flex items-center gap-2">
					<button class="btn btn-primary btn-sm" disabled={installing} onclick={install}>{installing ? m.catalog.installing : m.commands.install}</button>
					{#if installed(chosen.family)}<span class="text-sm opacity-70">{m.commands.installed}</span>{/if}
				</div>
			</section>
		{/if}
		<section class="min-w-0 md:col-start-1 md:row-start-2 md:min-h-0 md:overflow-y-auto">
			{#if results.length}
				<ul class="menu menu-sm w-full p-0">
					{#each results.slice(0, SHOWN) as entry (entry.id)}
						<li>
							<button type="button" class={chosen?.id === entry.id ? 'menu-active' : undefined} onclick={() => choose(entry)}>
								<span class="min-w-0 flex-1 truncate">{entry.family}</span>
								<span class="text-xs opacity-70">{m.catalog.categories[entry.category] ?? entry.category}</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if results.length > SHOWN}<p class="text-xs opacity-70">{m.catalog.more(SHOWN)}</p>{/if}
			{/if}
		</section>
	</main>
</div>
