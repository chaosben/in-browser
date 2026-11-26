<script lang="ts" generics="T extends { id: string }">
	// The list every view of JWL Files shows its entries in, picked like everywhere (`ui.md` Selection, `Picker`): a
	// click picks, Ctrl/Shift+click add, Ctrl+A all, arrows move; double click or Enter opens; right click, a long
	// press or the ⋯ (touch) open the entry's menu. `ondrop` (desktop only): entries dragged to another place.
	import type { Snippet } from 'svelte';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import PickMark from '@in-browser/brand/PickMark.svelte';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import type { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';

	interface Props {
		rows: T[];
		pick: Picker<string>;
		label: string;
		/** One sentence when there are none */
		empty: string;
		/** Name of an entry (for its ⋯) */
		name: (row: T) => string;
		row: Snippet<[T]>;
		menu: (row: T) => MenuEntry[];
		onopen?: (row: T) => void;
		/** Entries dragged before `index` (mouse only) */
		ondrop?: (ids: string[], index: number) => void;
	}

	let { rows, pick, label, empty, name, row, menu, onopen, ondrop }: Props = $props();

	let listEl = $state<HTMLElement>();
	let dropAt = $state<number | null>(null);
	const order = $derived(rows.map((r) => r.id));

	function click(e: MouseEvent, r: T) {
		if (pick.click(e, r.id, order) === 'open') onopen?.(r);
	}

	function context(e: MouseEvent, r: T) {
		pick.menu(e, r.id);
		openContextMenu(e, menu(r));
	}

	function key(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
			e.preventDefault();
			pick.selectAll(order);
			return;
		}
		const step = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number>)[e.key];
		if (!step || !listEl) return;
		e.preventDefault();
		const items = [...listEl.querySelectorAll<HTMLElement>('[role="option"]')];
		const at = items.indexOf(document.activeElement as HTMLElement);
		const next = Math.max(0, Math.min(rows.length - 1, at < 0 ? 0 : at + step));
		items[next]?.focus();
		if (e.shiftKey) pick.extend(rows[next].id, order);
		else pick.only(rows[next].id);
	}

	function dragStart(e: DragEvent, r: T) {
		if (!ondrop || coarsePointer.current) return;
		if (!pick.has(r.id)) pick.only(r.id);
		e.dataTransfer?.setData('application/x-jwl-entries', JSON.stringify(pick.ordered(order)));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function dragOver(e: DragEvent, index: number) {
		if (!ondrop || !e.dataTransfer?.types.includes('application/x-jwl-entries')) return;
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dropAt = e.clientY > rect.top + rect.height / 2 ? index + 1 : index;
	}

	function drop(e: DragEvent) {
		const data = e.dataTransfer?.getData('application/x-jwl-entries');
		const at = dropAt;
		dropAt = null;
		if (!data || at === null || !ondrop) return;
		e.preventDefault();
		ondrop(JSON.parse(data), at);
	}
</script>

{#if rows.length === 0}
	<p class="p-6 text-center text-sm opacity-60">{empty}</p>
{:else}
	<ul
		bind:this={listEl}
		class="flex flex-col gap-0.5 p-1"
		role="listbox"
		aria-label={label}
		aria-multiselectable="true"
		tabindex="-1"
		onkeydown={key}
		onpointerdown={(e) => pick.pointerdown(e)}
		ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropAt = null)}
		ondrop={drop}
	>
		{#each rows as r, i (r.id)}
			<li
				role="option"
				aria-selected={pick.has(r.id)}
				tabindex={i === 0 ? 0 : -1}
				draggable={!!ondrop && !coarsePointer.current}
				class={[
					'relative flex items-center gap-2 rounded px-2 py-1.5',
					pick.has(r.id) ? 'bg-selection/20' : 'hover:bg-base-200',
					dropAt === i && 'shadow-[inset_0_2px_0_0_var(--color-selection)]',
					dropAt === i + 1 && i === rows.length - 1 && 'shadow-[inset_0_-2px_0_0_var(--color-selection)]'
				]}
				onclick={(e) => click(e, r)}
				ondblclick={() => onopen?.(r)}
				oncontextmenu={(e) => context(e, r)}
				onkeydown={(e) => {
					if (e.key === 'Enter' && e.target === e.currentTarget) {
						e.preventDefault();
						onopen?.(r);
					}
				}}
				ondragstart={(e) => dragStart(e, r)}
				ondragover={(e) => dragOver(e, i)}
			>
				{#if pick.marking}<PickMark picked={pick.has(r.id)} />{/if}
				<div class="min-w-0 flex-1">{@render row(r)}</div>
				{#if coarsePointer.current}
					<MoreButton
						name={name(r)}
						entries={() => {
							if (!pick.has(r.id)) pick.only(r.id);
							return menu(r);
						}}
					/>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
