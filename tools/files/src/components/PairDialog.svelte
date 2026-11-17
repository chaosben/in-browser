<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { groupBase32 } from '@in-browser/files/p2p/base32.js';
	import { invite, onP2pEvent, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import QrCode from './QrCode.svelte';

	// A one-time key for a new device: as QR code (the phone's camera opens the link) and as text to type in.
	// Shows live when the new device was added.

	let { onclose }: { onclose: () => void } = $props();

	let code = $state<string | null>(p2pStatus.view.invite?.code ?? null);
	let added = $state<string | null>(null);
	let failed = $state<string | null>(null);

	const link = $derived(code ? `${location.origin}/files#pair=${code}` : '');

	async function newKey() {
		added = null;
		failed = null;
		try {
			code = (await invite()).code;
		} catch (e) {
			failed = e instanceof Error ? e.message : String(e);
		}
	}

	// A key right away, unless one is still valid
	$effect(() => {
		if (!code) untrack(() => void newKey());
	});

	$effect(() =>
		onP2pEvent((event) => {
			if (event.type === 'added') added = event.name;
		})
	);

	async function copy() {
		await navigator.clipboard.writeText(link);
		toast(m.pair.copied, 'success');
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
	<div class="modal-box flex flex-col items-center gap-4 text-center">
		<h3 class="self-start text-lg font-bold">{m.pair.title}</h3>
		{#if failed}
			<p class="text-error">{m.devices.failed(failed)}</p>
		{:else if added}
			<p class="flex items-center gap-2 text-lg">
				<span class="icon-[material-symbols-light--check-circle-outline] text-success size-8" aria-hidden="true"></span>
				{m.pair.added(added)}
			</p>
			<button class="btn" onclick={newKey}>{m.pair.addAnother}</button>
		{:else if code}
			<QrCode text={link} label={m.pair.yourKey} />
			<div class="flex flex-col items-center gap-1">
				<span class="flex items-center gap-1 text-sm font-medium">
					<span class="icon-[material-symbols-light--lock-outline] size-5" aria-hidden="true"></span>
					{m.pair.yourKey}
				</span>
				<code class="bg-base-200 rounded-box px-3 py-2 font-mono text-lg tracking-wider select-all">{groupBase32(code)}</code>
			</div>
			<button class="btn btn-sm" onclick={copy}>
				<span class="icon-[material-symbols-light--content-copy-outline] size-4" aria-hidden="true"></span>
				{m.pair.copyLink}
			</button>
			<p class="text-sm opacity-80">{m.pair.scan}</p>
			<p class="text-xs opacity-60">{m.pair.validity}</p>
			<p class="text-warning text-xs">{m.pair.warning}</p>
			<p class="flex items-center gap-2 text-sm opacity-70">
				<span class="loading loading-dots loading-sm"></span>
				{m.pair.waiting}
			</p>
		{:else}
			<span class="loading loading-spinner"></span>
		{/if}
		<div class="modal-action self-stretch">
			<button class="btn" onclick={onclose}>{m.devices.close}</button>
		</div>
	</div>
</dialog>
