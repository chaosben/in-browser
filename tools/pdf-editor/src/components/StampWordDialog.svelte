<script lang="ts">
	// A word of the stamp tool: what it says and its color. A new one is added to the list, a changed one replaces
	// its entry; the list is kept with "My stamps".
	import Modal from '@in-browser/brand/Modal.svelte';
	import { showError } from '@in-browser/files/errors.js';
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import { m } from '#lib/i18n/index.js';
	import { saveWords, stampWords } from '#lib/model/stamps.svelte.js';
	import { wordText, type StampWord } from '#lib/model/stamp-words.js';
	import { setStamp } from '#lib/model/tools.svelte.js';

	let { word, onclose }: { word: StampWord | null; onclose: () => void } = $props();

	// svelte-ignore state_referenced_locally
	let text = $state(word ? wordText(word, m.stamps.names) : '');
	// svelte-ignore state_referenced_locally
	let color = $state(word?.color ?? '#1d4ed8');
	let busy = $state(false);
	const said = $derived(text.trim());

	async function keep(e: SubmitEvent) {
		e.preventDefault();
		if (!said) return;
		busy = true;
		try {
			// A standard word keeps its name as long as it says what the standard says
			const entry: StampWord = word
				? { id: word.id, ...(word.name && { name: word.name }), ...(!(word.name && said === m.stamps.names[word.name]) && { text: said }), color }
				: { id: crypto.randomUUID(), text: said, color };
			await saveWords(word ? stampWords.list.map((w) => (w.id === word.id ? entry : w)) : [...stampWords.list, entry]);
			setStamp({ word: entry.id, custom: null });
			onclose();
		} catch (error) {
			showError(error, { context: '[pdf-editor] stamp words' });
		} finally {
			busy = false;
		}
	}
</script>

<Modal {onclose} {busy} labelledby="stamp-word-title">
	<form class="modal-box flex max-w-sm flex-col gap-4" onsubmit={keep}>
		<h3 id="stamp-word-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--approval-outline] size-6" aria-hidden="true"></span>
			{word ? m.stamps.editWordTitle : m.stamps.addWordTitle}
		</h3>
		<label class="flex flex-col gap-1">
			<span class="text-sm opacity-70">{m.stamps.wordText}</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input class="input input-sm w-full" bind:value={text} maxlength="40" autofocus />
		</label>
		<div class="flex flex-col gap-1">
			<span class="text-sm opacity-70">{m.stamps.wordColor}</span>
			<ColorField value={color} opaque onchange={(value) => value && (color = value.slice(0, 7))} />
		</div>
		<!-- As on the page: its own color on white -->
		<div class="flex min-h-12 items-center justify-center rounded bg-white p-2">
			<span class="rounded border-2 px-2 py-0.5 text-sm font-bold" style:color style:border-color={color}>{said || m.stamps.wordText}</span>
		</div>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose} disabled={busy}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={busy || !said}>{m.stamps.wordSave}</button>
		</div>
	</form>
</Modal>
