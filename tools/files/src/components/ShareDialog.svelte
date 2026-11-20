<script lang="ts">
	import { resolve } from '$app/paths';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { basename } from '@in-browser/files/path.js';
	import { endShare, p2pStatus, shareFolder } from '@in-browser/files/p2p/p2p.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import QrCode from './QrCode.svelte';

	// Sharing a folder with a guest: first what they may, then the link and QR code with the state.
	// Opened with `path` (new share) or `id` (an existing one, from the list of shares).

	let { path, id: shown = null, onclose }: { path: string; id?: string | null; onclose: () => void } = $props();

	let mode = $state<'view' | 'edit'>('view');
	let busy = $state(false);
	let id = $state<string | null>(null);
	$effect.pre(() => {
		if (shown) id = shown;
	});

	const share = $derived(p2pStatus.view.shares.find((s) => s.id === id) ?? null);
	const link = $derived(share ? `${location.origin}/files#share=${share.code}` : '');

	async function create() {
		busy = true;
		try {
			id = (await shareFolder(path, mode)).id;
		} catch (e) {
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			busy = false;
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toast(m.share.copied, 'success', 2000);
		} catch (e) {
			toast(filesErrorText(e), 'error');
		}
	}

	async function end() {
		if (!share) return;
		const ok = await ask({ title: m.share.endTitle, message: m.share.endMessage(basename(share.folder)), confirm: m.share.end, danger: true });
		if (!ok) return;
		await endShare(share.id);
		onclose();
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
	<div class="modal-box flex max-w-md flex-col gap-4">
		<h3 class="text-lg font-bold">{m.share.title(basename(share?.folder ?? path))}</h3>
		{#if !share}
			<p class="text-sm">{m.share.intro}</p>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-1 text-sm font-semibold">{m.share.mode}</legend>
				{#each [['view', m.share.view, m.share.viewHint], ['edit', m.share.edit, m.share.editHint]] as const as [value, label, hint] (value)}
					<label class="flex cursor-pointer items-start gap-2">
						<input type="radio" class="radio radio-sm mt-0.5" name="share-mode" {value} bind:group={mode} />
						<span class="flex flex-col">
							<span>{label}</span>
							<span class="text-xs opacity-70">{hint}</span>
						</span>
					</label>
				{/each}
			</fieldset>
			<p class="text-xs opacity-70">{m.share.validity}</p>
			<a class="link text-sm" href="{resolve('/help/connected')}#share" target="_blank" rel="noopener">{m.share.help}</a>
			<div class="modal-action mt-0">
				<button class="btn btn-ghost" onclick={onclose}>{m.devices.cancel}</button>
				<button class="btn btn-primary" onclick={create} disabled={busy}>{m.share.create}</button>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-3">
				<QrCode text={link} label={m.share.qr} />
				<label class="flex w-full flex-col gap-1">
					<span class="text-sm font-semibold">{m.share.link}</span>
					<input class="input input-sm w-full font-mono text-xs" readonly value={link} onfocus={(e) => e.currentTarget.select()} />
				</label>
				<button class="btn btn-sm btn-primary self-start" onclick={copy}>
					<span class="icon-[material-symbols-light--content-copy] size-5" aria-hidden="true"></span>{m.share.copy}
				</button>
			</div>
			<p class="flex items-center gap-2 text-sm" role="status">
				{#if share.connected}
					<span class="icon-[material-symbols-light--check-circle-outline] text-success size-5 shrink-0" aria-hidden="true"></span>{m.share.connected}
				{:else if share.used}
					<span class="icon-[material-symbols-light--link-off] size-5 shrink-0 opacity-70" aria-hidden="true"></span>{m.share.away}
				{:else}
					<span class="loading loading-dots loading-xs shrink-0"></span>{m.share.waiting}
				{/if}
			</p>
			<p class="text-xs opacity-70">
				{share.mode === 'edit' ? m.share.edit : m.share.view} · {m.share.untilEnded}
			</p>
			<div class="modal-action mt-0">
				<button class="btn" onclick={end}>{m.share.end}</button>
				<button class="btn" onclick={onclose}>{m.devices.close}</button>
			</div>
		{/if}
	</div>
</dialog>
