<script lang="ts" module>
	export interface ScopeFolder {
		path: string;
		name: string;
		/** Bytes per side or device (the caller decides what the keys mean) */
		sizes: Record<string, number>;
	}
</script>

<script lang="ts">
	import { intlLocale } from '#lib/i18n/index.js';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	// Which folders a sync target takes part in: a tree with checkboxes, sizes and a note per folder; subfolders load
	// when opened. One tree for every folder choice of the sync (devices, the synced folder, the setup of both).

	interface Props {
		/** The subfolders of `folder` with their sizes */
		load: (folder: string) => Promise<ScopeFolder[]>;
		isOn: (path: string) => boolean;
		/** A folder whose checkbox can't change (e.g. it exists only here, so leaving it out would delete it) */
		locked?: (folder: ScopeFolder) => boolean;
		ontoggle: (folder: ScopeFolder, on: boolean) => void;
		/** Sizes and where the folder is, next to its name */
		detail: (folder: ScopeFolder) => string;
		/** A note that stands out (in `hint`), e.g. “large” */
		mark?: (folder: ScopeFolder) => string | null;
		/** Shown when the top level has no folders */
		empty: string;
		/** Called with the top level once it is loaded */
		onroot?: (folders: ScopeFolder[]) => void;
	}

	let { load, isOn, locked, ontoggle, detail, mark, empty, onroot }: Props = $props();

	const children = new SvelteMap<string, ScopeFolder[]>();
	const expanded = new SvelteSet<string>();

	async function fill(folder: string) {
		try {
			const folders = (await load(folder)).sort((a, b) => a.name.localeCompare(b.name, intlLocale));
			children.set(folder, folders);
			if (folder === '/') onroot?.(folders);
		} catch (e) {
			console.error(e);
			children.set(folder, []);
		}
	}

	$effect(() => {
		void fill('/');
	});

	function toggleOpen(path: string) {
		if (expanded.has(path)) expanded.delete(path);
		else {
			expanded.add(path);
			if (!children.has(path)) void fill(path);
		}
	}
</script>

{#snippet tree(folder: string, depth: number)}
	{#each children.get(folder) ?? [] as child (child.path)}
		{@const parentOff = folder !== '/' && !isOn(folder)}
		{@const on = isOn(child.path)}
		{@const note = mark?.(child)}
		<li>
			<div class="hover:bg-base-200 rounded-box flex items-center gap-2 py-1 pr-2" style:padding-left="{depth * 1.25}rem">
				<button
					class="btn btn-ghost btn-xs btn-square"
					onclick={() => toggleOpen(child.path)}
					aria-label={child.name}
					aria-expanded={expanded.has(child.path)}
				>
					<span
						class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', expanded.has(child.path) && 'rotate-90']}
						aria-hidden="true"
					></span>
				</button>
				<label class="flex min-w-0 flex-1 items-center gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						checked={on}
						disabled={parentOff || !!locked?.(child)}
						onchange={(e) => {
							const checked = e.currentTarget.checked;
							e.currentTarget.checked = on;
							ontoggle(child, checked);
						}}
					/>
					<span class="icon-[material-symbols-light--folder-outline] text-folder size-5 shrink-0" aria-hidden="true"></span>
					<span class="min-w-0 truncate">{child.name}</span>
					{#if note}<span class="text-hint shrink-0 text-xs">{note}</span>{/if}
				</label>
				<span class="shrink-0 text-right text-xs opacity-60">{detail(child)}</span>
			</div>
			{#if expanded.has(child.path)}
				<ul>{@render tree(child.path, depth + 1)}</ul>
			{/if}
		</li>
	{/each}
{/snippet}

<ul class="max-h-[55vh] overflow-y-auto text-sm">
	{#if children.get('/')?.length === 0}
		<li class="opacity-60">{empty}</li>
	{:else if children.has('/')}
		{@render tree('/', 0)}
	{:else}
		<li><span class="loading loading-spinner loading-sm"></span></li>
	{/if}
</ul>
