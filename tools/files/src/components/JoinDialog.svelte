<script lang="ts">
	import { untrack } from 'svelte';
	import { parseInviteCode } from '@in-browser/files/p2p/auth.js';
	import { groupBase32 } from '@in-browser/files/p2p/base32.js';
	import { joinGroup } from '@in-browser/files/p2p/p2p.svelte.js';
	import { openDevicesDialog, suggestedName } from '#lib/devices.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import NameStep from './NameStep.svelte';

	// Connecting this device with a key (typed, or from a pairing link `/files#pair=…`)

	let { code: initial = '', onclose }: { code?: string; onclose: () => void } = $props();

	// The key from the link fills the field once; then it is the user's
	let key = $state(untrack(() => (initial ? groupBase32(initial) : '')));
	let name = $state(suggestedName());
	let phase = $state<'form' | 'connecting'>('form');
	let error = $state<string | null>(null);

	const code = $derived(parseInviteCode(key));

	async function join() {
		if (!code || !name.trim()) return;
		phase = 'connecting';
		error = null;
		try {
			await joinGroup(code, name.trim());
			// Look first, then sync: straight on to the folder choice
			onclose();
			openDevicesDialog('scopeSetup');
		} catch (e) {
			phase = 'form';
			const message = e instanceof Error ? e.message : String(e);
			error = message === 'timeout' ? m.join.timeout : m.devices.failed(message);
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
		if (phase !== 'connecting') onclose();
	}}
>
	<form
		class="modal-box flex flex-col gap-4"
		onsubmit={(e) => {
			e.preventDefault();
			join();
		}}
	>
		<h3 class="text-lg font-bold">{m.join.title}</h3>
		<p class="text-sm">{m.join.confirm}</p>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">{m.join.keyLabel}</span>
			<input
				class={['input w-full font-mono tracking-wider', key && !code && 'input-error']}
				bind:value={key}
				placeholder={m.join.keyPlaceholder}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				disabled={phase === 'connecting'}
			/>
			{#if key && !code}<span class="text-error text-xs">{m.join.invalidKey}</span>{/if}
		</label>
		<NameStep bind:value={name} autofocus={!!initial} />
		{#if error}<p role="alert" class="text-error text-sm">{error}</p>{/if}
		{#if phase === 'connecting'}
			<p class="flex items-center gap-2 text-sm opacity-80">
				<span class="loading loading-spinner loading-sm"></span>
				{m.join.connecting}
			</p>
		{/if}
		<div class="modal-action">
			<button type="button" class="btn" onclick={onclose} disabled={phase === 'connecting'}>{m.devices.cancel}</button>
			<button class="btn btn-primary" disabled={!code || !name.trim() || phase === 'connecting'}>{m.devices.start}</button>
		</div>
	</form>
</dialog>
