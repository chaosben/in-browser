<script lang="ts">
	// What a word stamp on the page says: its word and the line below it, typed in two fields at the stamp – opened by
	// a double click with "Select" or "Edit text" on the tab "Stamp". Enter or leaving keeps (one step), Esc puts
	// back what was there. The stamp gets as wide as its new lines need.
	import { untrack } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { isStamp, withStampText, type StampItem } from '#lib/render/stamp.js';
	import type { PdfSelection } from '#lib/render/surface.js';

	interface Props {
		selection: PdfSelection;
		doc: PdfDocument;
		/** The stamp being written (it is the selection) */
		editing: string | null;
		ondone: () => void;
	}

	let { selection, doc, editing, ondone }: Props = $props();

	const stamp = $derived.by(() => {
		const [first] = selection.items;
		return editing && selection.items.length === 1 && isStamp(first) && !first.image && first.id === editing ? first : null;
	});
	let text = $state('');
	let sub = $state('');
	let discard = false;

	function commit(s: StampItem, page: number) {
		const [said, below] = [text.trim(), sub.trim()];
		// A stamp says something: an emptied word stays as it was
		if (discard || !said || (said === (s.text ?? '') && below === (s.sub ?? ''))) return;
		doc.items.change(page, new Set([s.id]), (item) => (isStamp(item) && item.id === s.id ? withStampText(item, said, below || undefined) : null));
	}

	$effect(() => {
		const s = stamp;
		const page = selection.pageIndex;
		if (!s) return;
		untrack(() => {
			text = s.text ?? '';
			sub = s.sub ?? '';
			discard = false;
		});
		return () =>
			untrack(() => {
				commit(s, page);
				ondone();
			});
	});

	function keys(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		discard = e.key === 'Escape';
		ondone();
	}

	const rect = $derived(selection.rect);
	const WIDTH = 256;
</script>

{#if stamp && rect}
	<!-- Below the stamp (above it near the bottom of the window), inside the window -->
	{@const below = rect.y + rect.h + 8 + 96 < window.innerHeight}
	<div
		class="bg-base-100 border-base-300 pointer-events-auto absolute z-10 flex flex-col gap-1 rounded border p-2 shadow-lg"
		style="left: {Math.max(8, Math.min(rect.x, window.innerWidth - WIDTH - 8))}px; {below ? `top: ${rect.y + rect.h + 8}px` : `top: ${rect.y - 8}px; transform: translateY(-100%)`}; width: {WIDTH}px; max-width: calc(100vw - 1rem)"
		role="group"
		aria-label={m.stamps.editText}
	>
		<input
			class="input input-sm w-full"
			bind:value={text}
			maxlength="40"
			aria-label={m.stamps.wordText}
			placeholder={m.stamps.wordText}
			onkeydown={keys}
			{@attach (el) => {
				el.focus();
				el.select();
			}}
		/>
		<input class="input input-sm w-full" bind:value={sub} maxlength="60" aria-label={m.stamps.subText} placeholder={m.stamps.subText} onkeydown={keys} />
	</div>
{/if}
