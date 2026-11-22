<script lang="ts">
	// The comment of a sticky note – or what an insertion mark inserts –, written in a field below it – open while the note is placed, pressed with "Note",
	// double-clicked with "Select" or opened with "Edit comment" on the tab "Note". Leaving it (Esc, a press
	// elsewhere, another selection) writes the comment into the note as one step.
	import { untrack } from 'svelte';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { isCaret } from '#lib/render/caret.js';
	import { isCommented } from '#lib/render/markup.js';
	import type { PdfSelection } from '#lib/render/surface.js';

	interface Props {
		selection: PdfSelection;
		doc: PdfDocument;
		/** The note being written (it is the selection) */
		editing: string | null;
		ondone: () => void;
	}

	let { selection, doc, editing, ondone }: Props = $props();

	const note = $derived.by(() => {
		const [first] = selection.items;
		return editing && selection.items.length === 1 && isCommented(first) && first.id === editing ? first : null;
	});
	let draft = $state('');

	/** Writes the typed comment into the note (one undo step; nothing when it is unchanged) */
	function commit(n: { id: string; text: string }, page: number) {
		const text = draft;
		if (text === n.text) return;
		doc.items.change(page, new Set([n.id]), (item) => (isCommented(item) && item.id === n.id ? { ...item, text } : null));
	}

	// The note's text; leaving it saves what was typed
	$effect(() => {
		const n = note;
		const page = selection.pageIndex;
		if (!n) return;
		untrack(() => (draft = n.text));
		return () =>
			untrack(() => {
				commit(n, page);
				ondone();
			});
	});

	const rect = $derived(selection.rect);
	const WIDTH = 288;
</script>

{#if note && rect}
	<!-- Below the note (above it near the bottom of the window), inside the window -->
	{@const below = rect.y + rect.h + 8 + 120 < window.innerHeight}
	<textarea
		class="textarea bg-base-100 border-base-300 pointer-events-auto absolute z-10 min-h-24 resize-y text-sm shadow-lg"
		style="left: {Math.max(8, Math.min(rect.x, window.innerWidth - WIDTH - 8))}px; {below ? `top: ${rect.y + rect.h + 8}px` : `top: ${rect.y - 8}px; transform: translateY(-100%)`}; width: {WIDTH}px; max-width: calc(100vw - 1rem)"
		bind:value={draft}
		placeholder={isCaret(note) ? m.caret.placeholder : m.note.placeholder}
		aria-label={isCaret(note) ? m.caret.label : m.note.label}
		{@attach (el) => {
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		}}
	></textarea>
{/if}
