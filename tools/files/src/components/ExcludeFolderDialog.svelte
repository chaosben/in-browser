<script lang="ts">
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { remove } from '@in-browser/files/fs.js';
	import { basename } from '@in-browser/files/path.js';
	import { excludeFolder } from '@in-browser/files/p2p/p2p.svelte.js';
	import { m } from '#lib/i18n/index.js';

	// Stop syncing a folder on this device: keep the local copy or delete it here (never on the other devices)

	let { path, onclose }: { path: string; onclose: () => void } = $props();

	let busy = $state(false);

	async function exclude(deleteCopy: boolean) {
		busy = true;
		try {
			// Excluded first, so deleting the copy isn't passed on
			await excludeFolder(path);
			if (deleteCopy) await remove(path);
			onclose();
		} catch (e) {
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		} finally {
			busy = false;
		}
	}

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
	}
</script>

<dialog
	class="modal"
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="modal-box flex flex-col gap-4">
		<h3 class="text-lg font-bold">{m.scope.excludeTitle(basename(path))}</h3>
		<p class="text-sm">{m.scope.excludeMessage}</p>
		<div class="modal-action flex-wrap">
			<button class="btn" onclick={onclose} disabled={busy}>{m.devices.cancel}</button>
			<button class="btn btn-error btn-outline" onclick={() => exclude(true)} disabled={busy}>{m.scope.deleteCopy}</button>
			<button class="btn btn-primary" onclick={() => exclude(false)} disabled={busy}>{m.scope.keepCopy}</button>
		</div>
	</div>
</dialog>
