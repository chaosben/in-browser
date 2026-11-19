<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import DevicesPanel from './DevicesPanel.svelte';
	import LogSection from './LogSection.svelte';
import SyncPanel from './SyncPanel.svelte';

	// Everything about syncing in one dialog: your other devices and the folder on this computer. Opened from the
	// sidebar entry, the button on narrow screens and “Manage …” in the footer of every tool (`/files?panel=sync`).

	let { onclose }: { onclose: () => void } = $props();

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
	<div class="modal-box flex max-w-lg flex-col gap-5">
		<h3 class="text-lg font-bold">{m.syncHub.title}</h3>
		<DevicesPanel />
		<div class="divider my-0"></div>
<SyncPanel />
		<div class="divider my-0"></div>
		<LogSection />
		<div class="modal-action">
			<button class="btn" onclick={onclose}>{m.devices.close}</button>
		</div>
	</div>
</dialog>
