<script lang="ts">
	import { filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { stem } from '@in-browser/files/path.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';
	import { acceptsDrag, copyKey, dropOnFolder, startDrag } from '#lib/dnd.js';
	import { kindLabel, type Item, type SortKey } from '#lib/items.js';
	import { clipboard, type Manager } from '#lib/manager.svelte.js';
	import FileIcon from '@in-browser/files/FileIcon.svelte';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';

	interface Props {
		manager: Manager;
		onopen: (item: Item) => void;
		/** Right-click or long press on an entry (it is picked by then) */
		onmenu: (e: MouseEvent, item: Item) => void;
		/** The menu of the selection (⋯ on touch) */
		entries: () => MenuEntry[];
		/** A click on the name of the only selected entry: rename it (if it may be) */
		onrenamestart: (item: Item) => void;
		/** Own entries dropped onto a folder */
		ondropitems: (paths: string[], folder: string, copy: boolean) => void;
		/** The computer's files dropped onto a folder */
		ondropfiles: (data: DataTransfer, folder: string) => void;
		onrename: (item: Item, name: string) => void;
		/** The entries of the trash: where they came from and when they were deleted, nothing to drag or rename */
		trash?: boolean;
		/** Middle mouse button: the entry in a new browser tab */
		onopentab?: (item: Item) => void;
	}

	let { manager, onopen, onmenu, entries, onrenamestart, ondropitems, ondropfiles, onrename, trash = false, onopentab }: Props = $props();

	/** The middle mouse button opens in a new tab (like a link) – not the browser's scrolling on press */
	function middle(e: MouseEvent, item: Item) {
		if (e.button !== 1 || trash || !onopentab) return;
		e.preventDefault();
		if (e.type === 'auxclick') onopentab(item);
	}

	const t = $derived(filesMessages());
	/** Folder that is the current drop target */
	let target = $state<string | null>(null);

	const cut = $derived(clipboard.current?.mode === 'cut' ? new Set(clipboard.current.paths) : new Set<string>());

	const kindOf = (item: Item) => kindLabel(item, t.kinds, toolName);

	const pick = $derived(manager.pick);

	/** A click on the name of the only selected entry renames it – after a moment, so a double click still opens */
	let renameTimer: ReturnType<typeof setTimeout> | undefined;
	const RENAME_DELAY = 500;

	function click(e: MouseEvent, item: Item) {
		e.stopPropagation();
		clearTimeout(renameTimer);
		const wasOnly = !pick.touch && manager.selected.length === 1 && pick.has(item.path);
		const result = pick.click(e, item.path, manager.order);
		if (result === 'open') return onopen(item);
		manager.focus = item.path;
		if (result === 'plain' && !trash && wasOnly && e.detail === 1 && (e.target as Element).closest('[data-name]')) {
			renameTimer = setTimeout(() => onrenamestart(item), RENAME_DELAY);
		}
	}

	function dblclick(item: Item) {
		clearTimeout(renameTimer);
		onopen(item);
	}

	function menu(e: MouseEvent, item: Item) {
		e.stopPropagation();
		clearTimeout(renameTimer);
		pick.menu(e, item.path);
		manager.focus = item.path;
		onmenu(e, item);
	}

	function dragStart(e: DragEvent, item: Item) {
		clearTimeout(renameTimer);
		if (!pick.has(item.path)) manager.select(item.path);
		startDrag(e, pick.ordered(manager.order));
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
		dropOnFolder(e, item.path, ondropitems, ondropfiles);
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
		{ key: 'kind', label: () => (trash ? m.columns.origin : m.columns.kind), class: 'hidden w-44 lg:flex' },
		{ key: 'size', label: () => m.columns.size, class: 'hidden w-24 justify-end sm:flex' },
		{ key: 'modified', label: () => (trash ? m.columns.deleted : m.columns.modified), class: 'hidden w-44 md:flex' }
	];

	/** The second column: what the entry is – in the trash where it came from */
	const second = (item: Item) => (item.origin === undefined ? kindOf(item) : item.origin === '/' ? t.root : item.origin);
</script>

{#snippet name(item: Item, classes: string)}
	{#if manager.renaming === item.path}
		<input
			class={['input input-sm min-w-0', !classes.includes('text-sm') && 'text-base', classes]}
			value={item.name}
			aria-label={m.common.rename}
			{@attach renameField}
			onkeydown={(e) => renameKey(e, item)}
			onblur={(e) => onrename(item, e.currentTarget.value)}
			onclick={(e) => e.stopPropagation()}
			ondblclick={(e) => e.stopPropagation()}
		/>
	{:else}
		<span class="min-w-0 {classes}" title={item.name} data-name>{item.name}</span>
	{/if}
{/snippet}

<!-- Touch: a button with the menu of the entry (instead of right-click); it picks the entry first -->
{#snippet more(item: Item, classes: string)}
	<MoreButton
		name={item.name}
		class={classes}
		entries={() => {
			if (pick.marking) pick.selected.add(item.path);
			else if (!pick.has(item.path)) manager.select(item.path);
			return entries();
		}}
	/>
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
		{@const selected = pick.has(item.path)}
		<!-- Keyboard: arrows, Enter, F2 … are handled for the whole page (see Home.svelte) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<li
			role="option"
			aria-selected={selected}
			draggable={!trash && !coarsePointer.current && manager.renaming !== item.path}
			class={[
				'rounded-field cursor-default select-none',
				manager.view === 'grid'
					? 'relative flex flex-col items-center gap-1 p-2 text-center'
					: 'mx-1 flex items-center gap-3 px-2 py-1 pointer-coarse:py-0.5',
				selected ? 'bg-selection/20' : 'hover:bg-base-200',
				target === item.path && 'outline-selection outline-2',
				manager.focus === item.path && 'ring-base-content/30 ring-1',
				cut.has(item.path) && 'opacity-50'
			]}
			onpointerdown={(e) => pick.pointerdown(e)}
			onclick={(e) => click(e, item)}
			ondblclick={() => dblclick(item)}
			onmousedown={(e) => middle(e, item)}
			onauxclick={(e) => middle(e, item)}
			oncontextmenu={(e) => menu(e, item)}
			ondragstart={(e) => dragStart(e, item)}
			ondragover={(e) => dragOver(e, item)}
			ondragleave={() => target === item.path && (target = null)}
			ondrop={(e) => drop(e, item)}
		>
			{#if manager.view === 'grid'}
				{#if pick.marking}<PickMark picked={selected} class="absolute top-1 left-1" />{/if}
				<FileIcon name={item.name} kind={item.kind} remote={item.remote} size="size-12" />
				{@render name(item, 'line-clamp-2 w-full text-sm break-words')}
				{#if coarsePointer.current}{@render more(item, 'absolute top-0 right-0')}{/if}
			{:else}
				<span class="flex min-w-0 flex-1 items-center gap-2">
					{#if pick.marking}<PickMark picked={selected} />{/if}
					<FileIcon name={item.name} kind={item.kind} remote={item.remote} />
					{@render name(item, 'flex-1 truncate')}
				</span>
				<span class="hidden w-44 truncate text-sm opacity-70 lg:block" title={item.origin}>{second(item)}</span>
				<span class="hidden w-24 text-right text-sm tabular-nums opacity-70 sm:block">
					{item.size === undefined || item.kind === 'directory' ? '' : formatSize(item.size, intlLocale)}
				</span>
				<span class="hidden w-44 text-sm opacity-70 md:block">{item.modified ? formatDateTime(item.modified) : ''}</span>
				{#if coarsePointer.current}{@render more(item, '')}{/if}
			{/if}
		</li>
	{/each}
</ul>
