<script lang="ts">
	import { filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { extname, stem } from '@in-browser/files/path.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';
	import { acceptsDrag, copyKey, droppedPaths, startDrag } from '#lib/dnd.js';
	import type { Item, SortKey } from '#lib/items.js';
	import { clipboard, type Manager } from '#lib/manager.svelte.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';

	interface Props {
		manager: Manager;
		onopen: (item: Item) => void;
		/** Right-click on an entry, or on the free area (`null`) */
		onmenu: (e: MouseEvent, item: Item | null) => void;
		/** Own entries dropped onto a folder */
		ondropitems: (paths: string[], folder: string, copy: boolean) => void;
		/** The computer's files dropped onto a folder */
		ondropfiles: (data: DataTransfer, folder: string) => void;
		onrename: (item: Item, name: string) => void;
	}

	let { manager, onopen, onmenu, ondropitems, ondropfiles, onrename }: Props = $props();

	const t = $derived(filesMessages());
	/** Folder that is the current drop target */
	let target = $state<string | null>(null);

	const cut = $derived(clipboard.current?.mode === 'cut' ? new Set(clipboard.current.paths) : new Set<string>());

	function kindOf(item: Item) {
		if (item.folder) return t.kinds.folder;
		if (item.formats[0]) return t.kinds.package(item.formats[0].toolName);
		const ext = extname(item.name).slice(1).toUpperCase();
		return ext ? t.kinds.fileType(ext) : t.kinds.file;
	}

	function click(e: MouseEvent, item: Item) {
		e.stopPropagation();
		manager.select(item.path, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
	}

	function menu(e: MouseEvent, item: Item) {
		e.stopPropagation();
		if (!manager.selection.has(item.path)) manager.select(item.path);
		onmenu(e, item);
	}

	function dragStart(e: DragEvent, item: Item) {
		if (!manager.selection.has(item.path)) manager.select(item.path);
		startDrag(e, [...manager.selection]);
	}

	function dragOver(e: DragEvent, item: Item) {
		if (!item.folder || !acceptsDrag(e)) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = copyKey(e) || e.dataTransfer.types.includes('Files') ? 'copy' : 'move';
		target = item.path;
	}

	function drop(e: DragEvent, item: Item) {
		if (!item.folder) return;
		e.preventDefault();
		e.stopPropagation();
		target = null;
		const paths = droppedPaths(e);
		if (paths) ondropitems(paths, item.path, copyKey(e));
		else if (e.dataTransfer) ondropfiles(e.dataTransfer, item.path);
	}

	/** Rename field: select the name without extension, Enter keeps, Esc cancels, leaving keeps */
	function renameField(input: HTMLInputElement) {
		input.focus();
		input.setSelectionRange(0, stem(input.value).length);
	}

	function renameKey(e: KeyboardEvent, item: Item) {
		e.stopPropagation();
		if (e.key === 'Enter') onrename(item, e.currentTarget instanceof HTMLInputElement ? e.currentTarget.value : item.name);
		else if (e.key === 'Escape') manager.renaming = null;
	}

	const columns: { key: SortKey; label: () => string; class: string }[] = [
		{ key: 'name', label: () => m.columns.name, class: 'flex-1' },
		{ key: 'kind', label: () => m.columns.kind, class: 'hidden w-44 lg:flex' },
		{ key: 'size', label: () => m.columns.size, class: 'hidden w-24 justify-end sm:flex' },
		{ key: 'modified', label: () => m.columns.modified, class: 'hidden w-44 md:flex' }
	];
</script>

{#snippet name(item: Item, classes: string)}
	{#if manager.renaming === item.path}
		<input
			class="input input-xs min-w-0 {classes}"
			value={item.name}
			aria-label={m.common.rename}
			{@attach renameField}
			onkeydown={(e) => renameKey(e, item)}
			onblur={(e) => onrename(item, e.currentTarget.value)}
			onclick={(e) => e.stopPropagation()}
			ondblclick={(e) => e.stopPropagation()}
		/>
	{:else}
		<span class="min-w-0 {classes}" title={item.name}>{item.name}</span>
	{/if}
{/snippet}

{#if manager.view === 'list'}
	<div class="border-base-300 bg-base-100 sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-1 text-xs font-semibold">
		{#each columns as column (column.key)}
			<button class="hover:text-primary flex items-center gap-0.5 {column.class}" onclick={() => manager.sortBy(column.key)}>
				{column.label()}
				{#if manager.sortKey === column.key}
					{#if manager.desc}
						<span class="icon-[material-symbols-light--arrow-downward-alt] size-4" aria-hidden="true"></span>
					{:else}
						<span class="icon-[material-symbols-light--arrow-upward-alt] size-4" aria-hidden="true"></span>
					{/if}
				{/if}
			</button>
		{/each}
	</div>
{/if}

<ul
	class={manager.view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1 p-2' : 'flex flex-col py-1'}
	role="listbox"
	aria-multiselectable="true"
	aria-label={m.columns.name}
>
	{#each manager.visible as item (item.path)}
		{@const selected = manager.selection.has(item.path)}
		<!-- Keyboard: arrows, Enter, F2 … are handled for the whole page (see Home.svelte) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<li
			role="option"
			aria-selected={selected}
			draggable={manager.renaming !== item.path}
			class={[
				'rounded-field cursor-default select-none',
				manager.view === 'grid' ? 'flex flex-col items-center gap-1 p-2 text-center' : 'mx-1 flex items-center gap-3 px-2 py-1',
				selected ? 'bg-selection/20' : 'hover:bg-base-200',
				target === item.path && 'outline-selection outline-2',
				manager.focus === item.path && 'ring-base-content/30 ring-1',
				cut.has(item.path) && 'opacity-50'
			]}
			onclick={(e) => click(e, item)}
			ondblclick={() => onopen(item)}
			oncontextmenu={(e) => menu(e, item)}
			ondragstart={(e) => dragStart(e, item)}
			ondragover={(e) => dragOver(e, item)}
			ondragleave={() => target === item.path && (target = null)}
			ondrop={(e) => drop(e, item)}
		>
			{#if manager.view === 'grid'}
				<FileIcon name={item.name} kind={item.kind} size="size-12" />
				{@render name(item, 'line-clamp-2 w-full text-sm break-words')}
			{:else}
				<span class="flex min-w-0 flex-1 items-center gap-2">
					<FileIcon name={item.name} kind={item.kind} />
					{@render name(item, 'flex-1 truncate')}
				</span>
				<span class="hidden w-44 truncate text-sm opacity-70 lg:block">{kindOf(item)}</span>
				<span class="hidden w-24 text-right text-sm tabular-nums opacity-70 sm:block">
					{item.size === undefined || item.kind === 'directory' ? '' : formatSize(item.size, intlLocale)}
				</span>
				<span class="hidden w-44 text-sm opacity-70 md:block">{item.modified ? formatDateTime(item.modified) : ''}</span>
			{/if}
		</li>
	{/each}
</ul>
