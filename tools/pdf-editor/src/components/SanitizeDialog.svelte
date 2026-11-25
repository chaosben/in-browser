<script lang="ts">
	// “Sanitize …”: what the PDF holds that can be taken out (looked for first), each a choice; earlier versions and
	// unused objects always go. Applying writes the file anew (the editor does it and offers to undo it).
	import Modal from '@in-browser/brand/Modal.svelte';
	import type { HiddenData, Sanitize } from '@in-browser/pdf/write/incremental.js';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';

	let { doc, onapply, onclose }: { doc: PdfDocument; onapply: (what: Sanitize) => void; onclose: () => void } = $props();

	let found = $state<HiddenData | null>(null);
	let failed = $state<string | null>(null);
	let what = $state<Required<Sanitize>>({ metadata: true, attachments: true, scripts: true, bookmarks: false });
	// svelte-ignore state_referenced_locally
	doc.hiddenData().then(
		(f) => (found = f),
		(e: unknown) => (failed = e instanceof Error ? e.message : String(e))
	);

	const choices = $derived(
		found
			? ([
					['metadata', m.sanitize.metadata(found.metadata), found.metadata, null],
					['attachments', m.sanitize.attachments(found.attachments), found.attachments, null],
					['scripts', m.sanitize.scripts(found.scripts), found.scripts, m.sanitize.scriptsHint],
					['bookmarks', m.sanitize.bookmarks(found.bookmarks), found.bookmarks, null]
				] as const)
			: []
	);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!found) return;
		onapply({ metadata: what.metadata && found.metadata > 0, attachments: what.attachments && found.attachments > 0, scripts: what.scripts && found.scripts > 0, bookmarks: what.bookmarks && found.bookmarks > 0 });
	}
</script>

<Modal {onclose} labelledby="sanitize-title">
	<form class="modal-box flex max-w-md flex-col gap-3" onsubmit={submit}>
		<h3 id="sanitize-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--cleaning-services-outline] size-6" aria-hidden="true"></span>
			{m.sanitize.title}
		</h3>
		<p class="text-sm opacity-70">{m.sanitize.hint}</p>
		{#if found}
			{#each choices as [key, label, count, hint] (key)}
				<label class="flex items-start gap-2 text-sm">
					<input type="checkbox" class="checkbox checkbox-sm mt-0.5" bind:checked={what[key]} disabled={!count} />
					<span class={!count ? 'opacity-50' : ''}>
						{label}
						{#if hint}<span class="block text-xs opacity-70">{hint}</span>{/if}
					</span>
				</label>
			{/each}
			<p class="text-sm">{m.sanitize.versions(found.versions)}</p>
		{:else}
			<p class="flex items-center gap-2 text-sm">
				{#if failed}{failed}{:else}<span class="loading loading-spinner loading-sm"></span>{m.sanitize.checking}{/if}
			</p>
		{/if}
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={!found}>{m.sanitize.apply}</button>
		</div>
	</form>
</Modal>
