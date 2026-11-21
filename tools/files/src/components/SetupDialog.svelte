<script lang="ts">
	import Modal from '@in-browser/brand/Modal.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { createGroup } from '@in-browser/files/p2p/p2p.svelte.js';
	import { openDevicesDialog, suggestedName } from '#lib/devices.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import ExplainDialog from './ExplainDialog.svelte';
	import NameStep from './NameStep.svelte';

	// Connecting the first device: first how it works, then the name of this device; then a key for the next one

	let { onclose }: { onclose: () => void } = $props();

	let step = $state<'explain' | 'name'>('explain');
	let name = $state(suggestedName());
	let busy = $state(false);

	async function create() {
		if (!name.trim()) return;
		busy = true;
		try {
			await createGroup(name.trim());
			openDevicesDialog('pair');
		} catch (e) {
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		} finally {
			busy = false;
		}
	}
</script>

{#if step === 'explain'}
	<ExplainDialog {onclose} onnext={() => (step = 'name')} />
{:else}
	<Modal {onclose}>
		<form
			class="modal-box flex flex-col gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				create();
			}}
		>
			<h3 class="text-lg font-bold">{m.devices.connect}</h3>
			<NameStep bind:value={name} />
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => (step = 'explain')}>{m.devices.back}</button>
				<button class="btn btn-primary" disabled={busy || !name.trim()}>
					{#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
					{m.devices.next}
				</button>
			</div>
		</form>
	</Modal>
{/if}
