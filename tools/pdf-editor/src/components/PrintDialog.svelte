<script lang="ts">
	// "Print …": which pages, with or without the comments, how big, and optionally the comments as a list. The pages
	// are rendered one after the other (progress, "Cancel"), then the browser's print dialog takes over – paper,
	// copies and the printer are chosen there.
	import { tick } from 'svelte';
	import Modal from '@in-browser/brand/Modal.svelte';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import { printParts, type PrintPart } from '@in-browser/brand/ui/print.js';
	import { showError } from '@in-browser/files/errors.js';
	import { m } from '#lib/i18n/index.js';
	import type { EditorState } from '#lib/model/editor.svelte.js';
	import { parsePageRange } from '#lib/model/page-range.js';
	import { commentSheet, pageSheet, printedPage } from '#lib/model/print.js';

	type Which = 'all' | 'current' | 'picked' | 'range';

	let { ed, which: initial, onclose }: { ed: EditorState; which: Which; onclose: () => void } = $props();

	const STORE = 'pdf-editor:print';
	const stored = loadJson<{ comments?: unknown; list?: unknown; fit?: unknown }>(STORE, {});

	const count = $derived(ed.pageCount);
	/** Places of the pages picked in the panel "Pages" */
	const picked = $derived((ed.doc?.pages ?? []).flatMap((p, i) => (ed.pagePick.has(p.id) ? [i] : [])));
	// svelte-ignore state_referenced_locally
	let which = $state<Which>(initial === 'picked' && !ed.pagePick.selected.size ? 'current' : initial);
	let range = $state('');
	let comments = $state(stored.comments !== false);
	let list = $state(stored.list === true);
	let fit = $state(stored.fit !== false);
	/** Pages rendered so far while the job is prepared */
	let progress = $state<number | null>(null);
	let cancelled = false;

	const places = $derived(
		which === 'all' ? Array.from({ length: count }, (_, i) => i) : which === 'current' ? [ed.current] : which === 'picked' ? picked : parsePageRange(range, count)
	);

	async function print(e: SubmitEvent) {
		e.preventDefault();
		const doc = ed.doc;
		if (!doc || !places?.length) return;
		storeJson(STORE, { comments, list, fit });
		const urls: string[] = [];
		const parts: PrintPart[] = [];
		cancelled = false;
		progress = 0;
		try {
			for (const place of places) {
				const page = doc.pages[place];
				const url = URL.createObjectURL(await printedPage(doc, page, comments));
				urls.push(url);
				parts.push(await pageSheet(page, url));
				if (cancelled) return;
				progress++;
			}
			if (list) parts.push(commentSheet(doc, places));
			// The dialog goes first: it is not part of what is printed, and the print dialog would lie over it
			onclose();
			await tick();
			await printParts(parts, { fit });
		} catch (error) {
			showError(error, { text: m.print.failed });
		} finally {
			progress = null;
			for (const url of urls) URL.revokeObjectURL(url);
		}
	}

	function cancel() {
		if (progress === null) onclose();
		else cancelled = true;
	}
</script>

<Modal onclose={cancel} labelledby="print-title">
	<form class="modal-box flex max-w-md flex-col gap-4" onsubmit={print}>
		<h3 id="print-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--print-outline] size-6" aria-hidden="true"></span>
			{m.print.title}
		</h3>
		<fieldset class="flex flex-col gap-2" disabled={progress !== null}>
			<legend class="mb-1 text-sm opacity-70">{m.print.pages}</legend>
			<label class="flex items-center gap-2">
				<input type="radio" class="radio radio-sm" bind:group={which} value="all" />{m.print.all(count)}
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" class="radio radio-sm" bind:group={which} value="current" />{m.print.current(ed.current + 1)}
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" class="radio radio-sm" bind:group={which} value="picked" disabled={!picked.length} />
				<span class={[!picked.length && 'opacity-50']}>{m.print.picked(picked.length)}</span>
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" class="radio radio-sm" bind:group={which} value="range" aria-label={m.print.range} />
				<input
					class={['input input-sm min-w-0 flex-1', which === 'range' && range.trim() && !places && 'input-error']}
					placeholder={m.print.rangePlaceholder}
					aria-label={m.print.range}
					bind:value={range}
					onfocus={() => (which = 'range')}
				/>
			</label>
			<!-- Always there, so the buttons never jump -->
			<p class="text-error min-h-5 text-sm" aria-live="polite">{which === 'range' && range.trim() && !places ? m.print.rangeInvalid(count) : ''}</p>
		</fieldset>
		<fieldset class="flex flex-col gap-2" disabled={progress !== null}>
			<legend class="mb-1 text-sm opacity-70">{m.print.content}</legend>
			<label class="flex items-center gap-2"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={comments} />{m.print.comments}</label>
			<label class="flex items-center gap-2"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={list} />{m.print.list}</label>
		</fieldset>
		<fieldset class="flex flex-col gap-2" disabled={progress !== null}>
			<legend class="mb-1 text-sm opacity-70">{m.print.size}</legend>
			<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={fit} value={true} />{m.print.fit}</label>
			<label class="flex items-center gap-2"><input type="radio" class="radio radio-sm" bind:group={fit} value={false} />{m.print.actual}</label>
		</fieldset>
		<!-- Always there, so the buttons never jump -->
		<p class="min-h-5 text-sm opacity-70" role="status">{progress === null ? '' : m.print.preparing(Math.min(progress + 1, places?.length ?? 0), places?.length ?? 0)}</p>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={cancel}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={progress !== null || !places?.length}>
				{#if progress !== null}<span class="loading loading-spinner loading-sm"></span>{/if}
				{m.print.print}
			</button>
		</div>
	</form>
</Modal>
