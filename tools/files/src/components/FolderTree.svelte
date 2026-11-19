<script lang="ts">
	import { untrack } from 'svelte';
	import FileIcon from '@in-browser/files/FileIcon.svelte';
	import { list } from '@in-browser/files/fs.js';
	import { filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { basename } from '@in-browser/files/path.js';
	import { acceptsDrag, dropOnFolder } from '#lib/dnd.js';
	import { sortItems, toItem, type Item } from '#lib/items.js';
	import { expanded, treeVersion } from '#lib/manager.svelte.js';
	import FolderTree from './FolderTree.svelte';

	interface Props {
		path: string;
		/** Open folder (highlighted) */
		current: string;
		onnavigate: (path: string) => void;
		ondropitems: (paths: string[], folder: string, copy: boolean) => void;
		ondropfiles: (data: DataTransfer, folder: string) => void;
		/** Roots only: own name (default: “My files” for `/`) */
		label?: string;
		/** Roots only: a connected folder (live, not in My files) */
		connected?: boolean;
		/** Roots only: menu of the row (right-click / long press) */
		onmenu?: (e: MouseEvent) => void;
		/** Menu of every folder below the root (the same actions as in the list) */
		onfoldermenu?: (e: MouseEvent, path: string) => void;
		/** Opened live from another device (cloud icon) */
		remote?: boolean;
		/** Roots only: a folder another device shares with this browser (guest), possibly only for viewing */
		shared?: boolean;
		readOnly?: boolean;
	}

	let { path, current, onnavigate, ondropitems, ondropfiles, label: rootLabel, connected = false, onmenu, onfoldermenu, remote = false, shared = false, readOnly = false }: Props = $props();
	/** Roots have their own menu; a folder below them gets the folder's actions */
	const rowMenu = $derived(onmenu ?? (onfoldermenu && !rootLabel && path !== '/' ? (e: MouseEvent) => onfoldermenu(e, path) : undefined));

	let children = $state<Item[] | null>(null);
	let target = $state(false);

	const open = $derived(expanded.has(path));
	const label = $derived(rootLabel ?? (path === '/' ? filesMessages().root : basename(path)));

	async function load() {
		try {
			const entries = (await list(path)).map(toItem).filter((i) => i.folder && !i.name.startsWith('.'));
			children = sortItems(entries, 'name', false);
		} catch {
			children = [];
		}
	}

	// Children while open; again after every change in the file system
	$effect(() => {
		void treeVersion.current;
		if (open) untrack(load);
	});

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (open) expanded.delete(path);
		else expanded.add(path);
	}

	function dragOver(e: DragEvent) {
		if (!acceptsDrag(e)) return;
		e.preventDefault();
		target = true;
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		target = false;
		dropOnFolder(e, path, ondropitems, ondropfiles);
	}
</script>

<li>
	<div
		class={[
			'rounded-field flex items-center gap-0.5 pr-2 text-sm',
			path === current ? 'bg-selection/20 font-semibold' : 'hover:bg-base-300',
			target && 'outline-selection outline-2'
		]}
		ondragover={dragOver}
		ondragleave={() => (target = false)}
		ondrop={drop}
		oncontextmenu={rowMenu &&
			((e) => {
				e.preventDefault();
				rowMenu(e);
			})}
		role="treeitem"
		tabindex="-1"
		aria-selected={path === current}
		aria-expanded={children?.length ? open : undefined}
	>
		<button class="grid size-6 shrink-0 place-items-center" onclick={toggle} tabindex="-1" aria-hidden="true">
			{#if !open || children === null || children.length > 0}
				<span
					class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', open && children?.length && 'rotate-90']}
				></span>
			{/if}
		</button>
		<button class="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left" onclick={() => onnavigate(path)}>
			{#if path === '/'}
				<span class="icon-[material-symbols-light--hard-drive-outline] size-5 shrink-0" aria-hidden="true"></span>
			{:else if shared}
				<span class="icon-[material-symbols-light--share-outline] size-5 shrink-0" aria-hidden="true"></span>
			{:else if connected}
				<span class="icon-[material-symbols-light--link] size-5 shrink-0" aria-hidden="true"></span>
			{:else}
				<FileIcon name={label} kind="directory" {remote} />
			{/if}
			<span class="truncate">{label}</span>
			{#if readOnly}
				<span class="icon-[material-symbols-light--lock-outline] size-4 shrink-0 opacity-60" title={filesMessages().share.viewOnly} aria-label={filesMessages().share.viewOnly}></span>
			{/if}
		</button>
	</div>
	{#if open && children?.length}
		<ul class="ml-3" role="group">
			{#each children as child (child.path)}
				<FolderTree path={child.path} remote={child.remote} {current} {onnavigate} {ondropitems} {ondropfiles} {onfoldermenu} />
			{/each}
		</ul>
	{/if}
</li>
