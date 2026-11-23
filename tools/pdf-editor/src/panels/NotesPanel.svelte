<script lang="ts">
	// Speaker notes of the current page (`PdfDocument.notes`): written here, shown only to the presenter. Leaving the
	// field keeps the text (one undo step), Esc puts back what was there; another page keeps it for the page written on.
	import { untrack } from 'svelte';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';

	let { context }: PanelProps<EditorState> = $props();

	const page = $derived(context.doc?.pages[context.current] ?? null);
	const locked = $derived(context.doc?.editable !== 'yes');
	const saved = $derived(page ? (context.doc?.notes.get(page.id) ?? '') : '');

	/** What is typed, and the page it is for (null: the field shows the page's notes) */
	let draft = $state<{ page: string; text: string } | null>(null);
	const text = $derived(draft && draft.page === page?.id ? draft.text : saved);

	function keep() {
		const d = draft;
		draft = null;
		if (d) context.doc?.setNotes(d.page, d.text);
	}

	// Another page while typing: the text goes to the page it was written for
	$effect(() => {
		const id = page?.id;
		if (draft && draft.page !== id) untrack(keep);
	});
</script>

<div class="flex h-full flex-col gap-2 p-2">
	<label class="text-base-content/70 text-sm" for="pdf-notes">{m.present.notesOf(String(context.current + 1))}</label>
	<textarea
		id="pdf-notes"
		class="textarea textarea-sm min-h-40 w-full flex-1 resize-none text-sm leading-relaxed"
		placeholder={m.present.notesPlaceholder}
		readonly={locked || !page}
		value={text}
		oninput={(e) => page && (draft = { page: page.id, text: e.currentTarget.value })}
		onblur={keep}
		onkeydown={(e) => {
			if (e.key !== 'Escape') return;
			// Esc puts back what was there (and leaves the field)
			e.preventDefault();
			draft = null;
			e.currentTarget.value = saved;
			e.currentTarget.blur();
		}}
	></textarea>
	{#if locked && context.doc?.editable !== 'checking'}
		<p class="text-base-content/70 text-xs">{m.present.notesLocked}</p>
	{/if}
</div>
