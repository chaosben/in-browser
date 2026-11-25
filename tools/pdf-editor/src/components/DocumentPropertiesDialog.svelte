<script lang="ts">
	// “Properties …”: title, author, subject and keywords of the PDF (changed as one step to undo, saved into `/Info` and
	// its XMP metadata), and what the file says about itself – only shown.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { formatDateTime, intlLocale, m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';

	let { doc, size, onclose }: { doc: PdfDocument; size: number; onclose: () => void } = $props();

	const KEYS = ['title', 'author', 'subject', 'keywords'] as const;
	// The fields start with the properties as they are when the dialog opens
	const initial = () => Object.fromEntries(KEYS.map((k) => [k, doc.info[k] ?? ''])) as Record<(typeof KEYS)[number], string>;
	let values = $state(initial());
	const editable = $derived(doc.editable === 'yes' && !!doc.facts);

	const facts = $derived(doc.facts);
	const first = $derived(doc.pages[0]);
	const mm = (pt: number) => Math.round((pt * 25.4) / 72);
	const rows = $derived<[string, string][]>([
		[m.properties.facts.creator, facts?.creator ?? m.properties.none],
		[m.properties.facts.producer, facts?.producer ?? m.properties.none],
		[m.properties.facts.created, facts?.created ? formatDateTime(facts.created) : m.properties.none],
		[m.properties.facts.modified, facts?.modified ? formatDateTime(facts.modified) : m.properties.none],
		[m.properties.facts.version, facts?.version || m.properties.none],
		[m.properties.facts.pages, String(doc.pages.length)],
		[m.properties.facts.pageSize, first ? `${mm(first.w)} × ${mm(first.h)} mm` : m.properties.none],
		[m.properties.facts.fileSize, formatSize(size, intlLocale)],
		[m.properties.facts.protection, !doc.protection ? m.properties.unprotected : doc.protection.needsPassword ? m.properties.protectedOpen : m.properties.protectedRestricted],
		[m.properties.facts.signed, doc.signed ? m.properties.signed : m.properties.unsigned]
	]);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (editable) doc.setInfo(Object.fromEntries(KEYS.map((k) => [k, values[k].trim()])));
		onclose();
	}
</script>

<Modal {onclose} labelledby="properties-title">
	<form class="modal-box flex max-w-lg flex-col gap-3" onsubmit={submit}>
		<h3 id="properties-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--info-outline] size-6" aria-hidden="true"></span>
			{m.properties.title}
		</h3>
		<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
			{#each KEYS as key, i (key)}
				<label for="prop-{key}">{m.properties.fields[key]}</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input id="prop-{key}" class="input input-sm w-full" bind:value={values[key]} disabled={!editable} autofocus={i === 0} />
			{/each}
		</div>
		<dl class="border-base-300 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-3 text-sm">
			{#each rows as [label, value] (label)}
				<dt class="opacity-70">{label}</dt>
				<dd class="min-w-0 break-words">{value}</dd>
			{/each}
		</dl>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={!editable}>{m.properties.apply}</button>
		</div>
	</form>
</Modal>
