<script lang="ts">
	// The bookmarks of the PDF (`model/outline.ts`) as a tree: a click goes to a bookmark's place and makes it the
	// current one, Ctrl/Shift pick several (`Picker`), the arrows move through the tree as everywhere (`ui/tree.ts`).
	// In a PDF that can be changed: F2 or a click on the current one's name renames it in place, Del deletes, the menu
	// (right click, long press, ⋯) holds every command, and with a mouse bookmarks are dragged before, after or into
	// another. Before the file is parsed for writing, and in one that can't be changed, they are only shown.
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { openContextMenu } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { treeKey } from '@in-browser/brand/ui/tree.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { find, mapTree, moveTo, visible, type Bookmark } from '#lib/model/outline.js';

	let { context, close }: PanelProps<EditorState> = $props();

	const doc = $derived(context.doc);
	const editable = $derived(!!doc?.canEditBookmarks);
	const rows = $derived(doc ? visible(doc.bookmarks, doc.bookmarksOpen) : []);
	const order = $derived(rows.map((r) => r.bookmark.id));
	const picker = $derived(context.bookmarkPick);
	let list = $state<HTMLUListElement>();

	async function go(bookmark: Bookmark) {
		const target = bookmark.target;
		if (target?.kind === 'file' && target.uri) return;
		const place = await doc?.bookmarkPlace(target);
		if (!place) return;
		context.goTo(place.index, place.y);
		// Phones: the panel is a sheet over the page – the jump shows it
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
	}

	function toggle(id: string) {
		if (!doc) return;
		const open = new Set(doc.bookmarksOpen);
		if (!open.delete(id)) open.add(id);
		doc.setBookmarksOpen(open);
	}

	function click(e: MouseEvent, bookmark: Bookmark, onName: boolean) {
		const id = bookmark.id;
		// A click on the name of the one current bookmark renames it
		if (onName && editable && id === context.bookmarkCurrent && !picker.selected.size && !e.ctrlKey && !e.metaKey && !e.shiftKey && !picker.marking) {
			context.bookmarkRename = { id, fresh: false };
			return;
		}
		const result = picker.click(e, id, order, context.bookmarkCurrent);
		context.bookmarkCurrent = id;
		if (result === 'open') void go(bookmark);
	}

	function menu(e: MouseEvent, id: string) {
		picker.menu(e, id);
		context.bookmarkCurrent = id;
		const entries = context.bookmarkCommands?.menu();
		if (entries) openContextMenu(e, entries);
	}

	function keydown(e: KeyboardEvent) {
		if ((e.target as Element).closest('input')) return;
		const commands = context.bookmarkCommands;
		const index = order.indexOf(context.bookmarkCurrent ?? '');
		const step = treeKey(
			e.key,
			rows.map((r) => ({ id: r.bookmark.id, parent: r.parent, container: r.bookmark.items.length > 0, open: !!doc?.bookmarksOpen.has(r.bookmark.id) })),
			index
		);
		if (step && rows.length) {
			e.preventDefault();
			e.stopPropagation();
			if ('go' in step) {
				const id = order[step.go];
				if (!id) return;
				if (e.shiftKey) picker.extend(id, order);
				else picker.clear();
				context.bookmarkCurrent = id;
				list?.querySelector<HTMLElement>(`[data-bookmark="${CSS.escape(id)}"]`)?.focus();
			} else if ('open' in step || 'close' in step) toggle('open' in step ? step.open : step.close);
			return;
		}
		const current = context.bookmarkCurrent && doc ? find(doc.bookmarks, context.bookmarkCurrent) : null;
		const handled = () => (e.preventDefault(), e.stopPropagation());
		if (e.key === 'Enter' && current) return handled(), void go(current);
		if (e.key === 'F2' && commands?.renameBookmark.enabled()) return handled(), commands.renameBookmark.run();
		if ((e.key === 'Delete' || e.key === 'Backspace') && commands?.removeBookmarks.enabled()) return handled(), commands.removeBookmarks.run();
		if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) return handled(), picker.selectAll(order);
		if (e.key === 'Escape' && picker.selected.size) return handled(), picker.clear();
	}

	// Renaming in place: Enter or leaving keeps, Esc puts back
	let renameField = $state('');
	$effect(() => {
		const r = context.bookmarkRename;
		if (r && doc) renameField = find(doc.bookmarks, r.id)?.title ?? '';
	});
	function commitRename() {
		const r = context.bookmarkRename;
		if (!r || !doc) return;
		context.bookmarkRename = null;
		const title = renameField.trim();
		if (!title) return;
		doc.changeBookmarks(
			mapTree(doc.bookmarks, (b) => (b.id === r.id && b.title !== title ? { ...b, title } : null)),
			r.fresh
		);
	}
	function renameKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
		else if (e.key === 'Escape') {
			e.preventDefault();
			context.bookmarkRename = null;
		}
	}
	const focus = (el: HTMLInputElement) => {
		el.focus();
		el.select();
	};

	// Dragging (mouse): the picked bookmarks, or the one dragged, before, after or into another (by the third of the
	// row the pointer is in)
	let dragging = $state<Set<string> | null>(null);
	let drop = $state<{ id: string; where: 'before' | 'after' | 'inside' } | null>(null);

	function dragStart(e: DragEvent, id: string) {
		if (!editable || context.bookmarkRename) return e.preventDefault();
		dragging = picker.has(id) ? new Set(picker.selected) : new Set([id]);
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function dragOver(e: DragEvent, id: string) {
		if (!dragging) return;
		e.preventDefault();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const at = (e.clientY - box.top) / box.height;
		drop = dragging.has(id) ? null : { id, where: at < 1 / 3 ? 'before' : at > 2 / 3 ? 'after' : 'inside' };
	}
	function dropped(e: DragEvent) {
		e.preventDefault();
		if (doc && dragging && drop) {
			doc.changeBookmarks(moveTo(doc.bookmarks, dragging, drop.id, drop.where));
			if (drop.where === 'inside' && !doc.bookmarksOpen.has(drop.id)) toggle(drop.id);
		}
		dragEnd();
	}
	function dragEnd() {
		dragging = null;
		drop = null;
	}

	/** What a bookmark says about where it leads (tooltip) */
	function where(b: Bookmark): string {
		if (b.target?.kind === 'file' && b.target.uri) return m.bookmarks.webAddress(b.target.uri);
		return doc?.leadsSomewhere(b.target) ? b.title : m.bookmarks.noTarget;
	}
</script>

{#if doc}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="flex h-full flex-col" onkeydown={keydown} onpointerdown={(e) => picker.pointerdown(e)}>
		{#if rows.length}
			<ul bind:this={list} role="tree" aria-label={m.panels.outline} aria-multiselectable="true" class="min-h-0 flex-1 overflow-y-auto p-2" ondragover={(e) => dragging && e.preventDefault()} ondrop={dropped}>
				{#each rows as { bookmark, depth } (bookmark.id)}
					{@const isPicked = picker.has(bookmark.id)}
					{@const current = bookmark.id === context.bookmarkCurrent}
					{@const leads = doc.leadsSomewhere(bookmark.target)}
					{@const open = doc.bookmarksOpen.has(bookmark.id)}
					<li
						role="treeitem"
						aria-level={depth + 1}
						aria-selected={isPicked || (current && !picker.selected.size)}
						aria-expanded={bookmark.items.length ? open : undefined}
						class={[
							'group relative flex items-center rounded',
							isPicked ? 'bg-selection/20' : current ? 'bg-selection/10' : 'hover:bg-base-200',
							dragging?.has(bookmark.id) && 'opacity-50',
							drop?.id === bookmark.id && drop.where === 'inside' && 'outline-selection outline-2',
							drop?.id === bookmark.id && drop.where === 'before' && 'before:bg-selection before:absolute before:-top-px before:right-0 before:left-0 before:h-0.5',
							drop?.id === bookmark.id && drop.where === 'after' && 'after:bg-selection after:absolute after:right-0 after:-bottom-px after:left-0 after:h-0.5'
						]}
						style="padding-left: {depth * 14}px"
						draggable={editable && !coarsePointer.current && context.bookmarkRename?.id !== bookmark.id}
						ondragstart={(e) => dragStart(e, bookmark.id)}
						ondragover={(e) => dragOver(e, bookmark.id)}
						ondragend={dragEnd}
						oncontextmenu={(e) => menu(e, bookmark.id)}
					>
						{#if picker.marking}
							<PickMark picked={isPicked} class="ml-1" />
						{/if}
						{#if bookmark.items.length}
							<button class="btn btn-ghost btn-xs btn-square shrink-0" tabindex="-1" onclick={() => toggle(bookmark.id)} aria-label={bookmark.title}>
								<span class={['icon-[material-symbols-light--chevron-right] size-4 transition-transform', open && 'rotate-90']} aria-hidden="true"></span>
							</button>
						{:else}
							<span class="w-6 shrink-0"></span>
						{/if}
						{#if context.bookmarkRename?.id === bookmark.id}
							<input
								class="input input-xs min-w-0 flex-1"
								aria-label={m.bookmarks.name}
								bind:value={renameField}
								onkeydown={renameKey}
								onblur={commitRename}
								{@attach focus}
							/>
						{:else}
							<button
								data-bookmark={bookmark.id}
								class={['flex min-w-0 flex-1 items-center gap-1 truncate rounded px-1.5 py-1 text-left text-sm', bookmark.bold && 'font-bold', bookmark.italic && 'italic', !leads && 'opacity-60']}
								style:color={bookmark.color}
								tabindex={current || (!context.bookmarkCurrent && depth === 0 && rows[0].bookmark === bookmark) ? 0 : -1}
								title={where(bookmark)}
								onclick={(e) => click(e, bookmark, true)}
							>
								{#if !leads}<span class="icon-[material-symbols-light--link-off] size-4 shrink-0" aria-hidden="true"></span>{/if}
								<span class="truncate">{bookmark.title}</span>
							</button>
						{/if}
						{#if editable}
							<MoreButton
								name={bookmark.title}
								class={coarsePointer.current ? 'shrink-0' : 'shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}
								entries={() => {
									if (picker.marking) picker.selected.add(bookmark.id);
									else if (!picker.has(bookmark.id)) picker.clear();
									context.bookmarkCurrent = bookmark.id;
									return context.bookmarkCommands?.menu() ?? [];
								}}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="p-4 text-sm opacity-70">{editable ? m.bookmarks.emptyEditable : m.panels.noOutline}</p>
		{/if}
	</div>
{/if}
