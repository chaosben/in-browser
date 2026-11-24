<script lang="ts">
	// "Barcode …" and "Edit barcode" of every tool: a code of what is typed, which the tool places as a picture
	// (vectors, so it stays sharp at every size). The fields are `BarcodeFields`; the tool keeps the spec with what it
	// placed, so it can be changed later.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';
	import { loadJson, storeJson } from '@in-browser/brand/storage.js';
	import BarcodeFields from './BarcodeFields.svelte';
	import { barcodeSpec, type BarcodeDrawing, type BarcodeSpec } from './barcode.js';
	import { graphicsMessages } from './i18n/index.svelte.js';

	const t = $derived(graphicsMessages().barcode);

	/** `spec`: the code to change; without it a new one is made */
	let { spec, oninsert, onclose }: { spec?: BarcodeSpec; oninsert: (spec: BarcodeSpec) => Promise<void>; onclose: () => void } = $props();

	// Kind, colors and options chosen last are kept for all tools; the content never is
	const STORE = 'graphics:barcode';
	// svelte-ignore state_referenced_locally
	let choice = $state<BarcodeSpec>(spec ? { ...spec } : { ...barcodeSpec(loadJson<unknown>(STORE, {})), text: '' });
	let drawing = $state.raw<BarcodeDrawing | null>(null);
	let busy = $state(false);
	// svelte-ignore state_referenced_locally
	const editing = !!spec;

	async function insert(e: SubmitEvent) {
		e.preventDefault();
		if (!drawing) return;
		busy = true;
		const made = $state.snapshot(choice);
		storeJson(STORE, { ...made, text: '' });
		try {
			await oninsert(made);
			onclose();
		} finally {
			busy = false;
		}
	}
</script>

<Modal {onclose} {busy} labelledby="barcode-title">
	<form class="modal-box flex max-w-md flex-col gap-3" onsubmit={insert}>
		<h3 id="barcode-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--qr-code-2] size-6" aria-hidden="true"></span>
			{editing ? t.edit : t.title}
		</h3>
		<BarcodeFields bind:spec={choice} bind:drawing />
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-ghost" onclick={onclose} disabled={busy}>{brandMessages().common.cancel}</button>
			<button type="submit" class="btn btn-primary" disabled={busy || !drawing}>
				{#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
				{editing ? t.apply : t.insert}
			</button>
		</div>
	</form>
</Modal>
