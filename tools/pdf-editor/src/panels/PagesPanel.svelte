<script lang="ts">
	// All pages as small pictures (a grid when the panel is wide); the current one marked, a click goes there. Pages can
	// be picked (Ctrl/Shift+click, Ctrl+A; on touch the selection mode of `ui.md`: a long press opens the page's menu and
	// starts it, taps then pick) – page commands (rotate, move, delete …, also in the menu of a page: right click, long
	// press or ⋯) act on the picked ones. On the desktop picked pages are dragged to another place.
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { openContextMenu } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import Thumbnail from './Thumbnail.svelte';

	let { context, close }: PanelProps<EditorState> = $props();

	const WIDTH = 120;
	let list = $state<HTMLElement>();
	/** While dragging: where the pages would go (index they stand before) */
	let dropAt = $state<number | null>(null);
	let dragging = $state<Set<string> | null>(null);

	const picked = $derived(context.pagePick);
	const editable = $derived(context.doc?.editable === 'yes');
	const order = $derived((context.doc?.pages ?? []).map((p) => p.id));

	// The current page stays in sight
	$effect(() => {
		const index = context.current;
		list?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	function go(index: number) {
		context.goTo(index);
		// On a phone the panel covers the page: back to it
		if (matchMedia('(pointer: coarse), (max-width: 639px)').matches) close();
	}

	function click(e: MouseEvent, index: number, id: string) {
		// The current page is tinted: with nothing picked, Ctrl and Shift start from it
		const result = picked.click(e, id, order, order[context.current] ?? null);
		// A plain click (a tap outside the selection mode) goes there; nothing picked – commands act on that page
		if (result === 'open' || result === 'plain') {
			if (result === 'plain') picked.clear();
			go(index);
		}
	}

	function menu(e: MouseEvent, index: number, id: string) {
		const before = picked.has(id);
		picked.menu(e, id);
		// Right click on a page not picked (desktop): it alone, and the view goes there
		if (!before && !picked.marking) context.goTo(index);
		const all = coarsePointer.current ? [{ separator: true } as const, { label: m.commands.pickAll, icon: 'icon-[material-symbols-light--select-all]', run: () => context.pickAllPages() }] : [];
		openContextMenu(e, [...context.pageMenu(), ...all]);
	}

	/** Ctrl+A picks every page, Esc clears the pick (while the panel has the focus) */
	function keydown(e: KeyboardEvent) {
		if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
			e.preventDefault();
			e.stopPropagation();
			context.pickAllPages();
		} else if (e.key === 'Escape' && picked.selected.size) {
			e.stopPropagation();
			context.clearPagePick();
		}
	}

	// Dragging (desktop): the picked pages, or the one dragged
	function dragStart(e: DragEvent, id: string) {
		if (!editable) return e.preventDefault();
		dragging = picked.has(id) ? new Set(picked.selected) : new Set([id]);
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function dragOver(e: DragEvent, index: number) {
		if (!dragging) return;
		e.preventDefault();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Before or after this page, by the half the pointer is in (along the row in a grid)
		const grid = box.width * 1.5 < (list?.clientWidth ?? 0);
		const after = grid ? e.clientX > box.left + box.width / 2 : e.clientY > box.top + box.height / 2;
		dropAt = index + (after ? 1 : 0);
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		const doc = context.doc;
		if (doc && dragging && dropAt !== null) {
			const ids = dragging;
			const to = dropAt;
			context.selection?.clear();
			doc.movePages(ids, to);
			const first = doc.pages.findIndex((p) => ids.has(p.id));
			if (first >= 0) context.goTo(first);
		}
		dragEnd();
	}

	function dragEnd() {
		dragging = null;
		dropAt = null;
	}
</script>

{#if context.doc}
	{@const doc = context.doc}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="flex h-full flex-col" onkeydown={keydown} onpointerdown={(e) => picked.pointerdown(e)}>
		<!-- Always there, so picking never moves the pages -->
		<div class="border-base-300 flex items-center gap-2 border-b px-3 py-1 text-xs">
			<span class="flex-1">{m.commands.picked(picked.selected.size, context.current + 1)}</span>
			<button class="btn btn-ghost btn-xs" disabled={!picked.selected.size} onclick={() => context.clearPagePick()}>{m.commands.clearPick}</button>
		</div>
		<ul
			bind:this={list}
			class="grid min-h-0 flex-1 content-start justify-center gap-3 overflow-y-auto p-3"
			style="grid-template-columns: repeat(auto-fill, minmax({WIDTH + 16}px, 1fr))"
			ondragover={(e) => dragging && e.preventDefault()}
			ondrop={drop}
		>
			{#each doc.pages as page, index (page.id)}
				{@const isPicked = picked.has(page.id)}
				<li
					data-index={index}
					class={['relative flex justify-center', dropAt === index && 'before:bg-selection before:absolute before:-top-2 before:right-0 before:left-0 before:h-0.5', dropAt === index + 1 && index === doc.pages.length - 1 && 'after:bg-selection after:absolute after:right-0 after:-bottom-2 after:left-0 after:h-0.5']}
					draggable={editable && !coarsePointer.current}
					ondragstart={(e) => dragStart(e, page.id)}
					ondragover={(e) => dragOver(e, index)}
					ondragend={dragEnd}
					oncontextmenu={(e) => menu(e, index, page.id)}
				>
					<!-- The page and, on touch, its marks sit together, so they stay on the page's corners -->
					<div class="relative">
						<button
							class={[
								'flex flex-col items-center gap-1 rounded p-1.5',
								isPicked ? 'bg-selection/20' : index === context.current ? 'bg-selection/10' : 'hover:bg-base-200',
								dragging?.has(page.id) && 'opacity-50'
							]}
							onclick={(e) => click(e, index, page.id)}
							aria-current={index === context.current ? 'page' : undefined}
							aria-pressed={isPicked}
							aria-label={m.panels.pageLabel(String(index + 1))}
						>
							<Thumbnail {doc} {page} width={WIDTH} />
							<span class="text-xs tabular-nums opacity-70">{index + 1}</span>
						</button>
						{#if picked.marking}
							<!-- Touch: the marks of the selection mode -->
							<PickMark picked={isPicked} class="absolute top-2.5 left-2.5" />
						{/if}
						{#if coarsePointer.current}
							<!-- Touch: the page's menu without a long press -->
							<MoreButton
								name={m.panels.pageLabel(String(index + 1))}
								class="bg-base-100/80 absolute top-2.5 right-2.5"
								entries={() => {
									// In the selection mode it joins the pick; otherwise it alone
									if (picked.marking) picked.selected.add(page.id);
									else if (!picked.has(page.id)) picked.only(page.id);
									return context.pageMenu();
								}}
							/>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}
