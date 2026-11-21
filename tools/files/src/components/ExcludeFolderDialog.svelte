<script lang="ts">
	import Modal from '@in-browser/brand/Modal.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { remove } from '@in-browser/files/opfs.js';
	import { basename } from '@in-browser/files/path.js';
	import { excludeFolder } from '@in-browser/files/p2p/p2p.svelte.js';
	import { m } from '#lib/i18n/index.js';

	// Stop syncing a folder on this device: the copy here goes (never on the other devices); from then on the folder
	// opens live from a device that has it

	let { path, onclose }: { path: string; onclose: () => void } = $props();

	let busy = $state(false);

	async function exclude() {
		busy = true;
		try {
			// Excluded first, so deleting the copy isn't passed on; only the copy on this device (opfs.ts, not routed)
			await excludeFolder(path);
			await remove(path);
			onclose();
		} catch (e) {
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		} finally {
			busy = false;
		}
	}

</script>

<Modal onclose={onclose}>
	<div class="modal-box flex flex-col gap-4">
		<h3 class="text-lg font-bold">{m.scope.excludeTitle(basename(path))}</h3>
		<p class="text-sm">{m.scope.excludeMessage}</p>
		<div class="modal-action flex-wrap">
			<button class="btn" onclick={onclose} disabled={busy}>{m.devices.cancel}</button>
			<button class="btn btn-primary" onclick={exclude} disabled={busy}>{m.scope.exclude}</button>
		</div>
	</div>
</Modal>
