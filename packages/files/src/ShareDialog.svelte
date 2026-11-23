<script lang="ts">
	// Sharing with a guest – a folder, or one file or package: first what the guest may and how long it lasts, then
	// the link and QR code, four words for a computer without a camera (`p2p/words.ts`), the guest's state and when it
	// ends. One dialog in every tool (`share-dialog.svelte.ts`, placed by `ToolLayout`).
	import { onMount } from 'svelte';
	import Modal from '@in-browser/brand/Modal.svelte';
	import { lang } from '@in-browser/brand/i18n/index.svelte.js';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { basename } from './path.js';
	import { endShare, p2pStatus, shareFolder, shareWords } from './p2p/p2p.svelte.js';
	import { DEFAULT_DURATION, SHARE_DURATIONS } from './p2p/shares.js';
	import { wordLists, wordsOf } from './p2p/words.js';
	import type { ShareTarget } from './share-dialog.svelte.js';
	import QrCode from './QrCode.svelte';

	let { target, onclose }: { target: ShareTarget; onclose: () => void } = $props();

	const t = $derived(filesMessages().shareDialog);

	let mode = $state<'view' | 'edit'>('view');
	let duration = $state<number | null>(DEFAULT_DURATION);
	let busy = $state(false);
	// svelte-ignore state_referenced_locally
	let id = $state<string | null>('id' in target ? target.id : null);
	let words = $state<{ text: string[]; expires: number } | null>(null);
	let now = $state(Date.now());

	const share = $derived(p2pStatus.view.shares.find((s) => s.id === id) ?? null);
	const path = $derived(share?.folder ?? ('path' in target ? target.path : ''));
	const single = $derived(share ? !!share.single : 'path' in target && !!target.single);
	const link = $derived(share ? `${location.origin}/files#share=${share.code}` : '');
	const wordsLeft = $derived(words ? Math.ceil((words.expires - now) / 60_000) : 0);

	onMount(() => {
		const tick = setInterval(() => (now = Date.now()), 5000);
		return () => clearInterval(tick);
	});

	async function create() {
		if (!('path' in target)) return;
		busy = true;
		try {
			id = (await shareFolder(target.path, mode, { single: !!target.single, duration })).id;
		} catch (e) {
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			busy = false;
		}
	}

	async function showWords() {
		if (!share) return;
		busy = true;
		try {
			const [{ code, expires }, lists] = await Promise.all([shareWords(share.id), wordLists()]);
			words = { text: wordsOf(code, lists, lang.current), expires };
			now = Date.now();
		} catch (e) {
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			busy = false;
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toast(t.copied, 'success', 2000);
		} catch (e) {
			toast(filesErrorText(e), 'error');
		}
	}

	async function end() {
		if (!share) return;
		const ok = await ask({ title: t.endTitle, message: t.endMessage(basename(share.folder)), confirm: t.end, danger: true });
		if (!ok) return;
		await endShare(share.id);
		onclose();
	}
</script>

<Modal {onclose}>
	<div class="modal-box flex max-w-md flex-col gap-4">
		<h3 class="text-lg font-bold">{t.title(basename(path))}</h3>
		{#if !share}
			<p class="text-sm">{single ? t.introFile : t.introFolder}</p>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-1 text-sm font-semibold">{t.mode}</legend>
				{#each [['view', t.view, t.viewHint], ['edit', t.edit, t.editHint]] as const as [value, label, hint] (value)}
					<label class="flex cursor-pointer items-start gap-2">
						<input type="radio" class="radio radio-sm mt-0.5" name="share-mode" {value} bind:group={mode} />
						<span class="flex flex-col">
							<span>{label}</span>
							<span class="text-xs opacity-70">{hint}</span>
						</span>
					</label>
				{/each}
			</fieldset>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold">{t.duration}</span>
				<select class="select select-sm w-full" bind:value={duration}>
					{#each SHARE_DURATIONS as value, i (i)}
						<option {value}>{t.durations[i]}</option>
					{/each}
				</select>
			</label>
			<a class="link text-sm" href="/help/connected#share" target="_blank" rel="noopener">{t.help}</a>
			<div class="modal-action mt-0">
				<button type="button" class="btn btn-ghost" onclick={onclose}>{t.cancel}</button>
				<button type="button" class="btn btn-primary" onclick={create} disabled={busy}>{t.create}</button>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-3">
				<QrCode text={link} label={t.qr} />
				<label class="flex w-full flex-col gap-1">
					<span class="text-sm font-semibold">{t.link}</span>
					<input class="input input-sm w-full font-mono text-xs" readonly value={link} onfocus={(e) => e.currentTarget.select()} />
				</label>
				<div class="flex w-full flex-wrap gap-2">
					<button type="button" class="btn btn-sm" onclick={copy}>
						<span class="icon-[material-symbols-light--content-copy] size-5" aria-hidden="true"></span>{t.copy}
					</button>
					<button type="button" class="btn btn-sm" onclick={showWords} disabled={busy}>
						<span class="icon-[material-symbols-light--password] size-5" aria-hidden="true"></span>{words && wordsLeft > 0 ? t.newWords : t.showWords}
					</button>
				</div>
				{#if words}
					<section class="bg-base-200 rounded-box flex w-full flex-col gap-1 p-3" aria-label={t.wordsLabel}>
						{#if wordsLeft > 0}
							<p class="text-center font-mono text-xl font-semibold tracking-wide" data-testid="share-words">{words.text.join(' ')}</p>
							<p class="text-center text-xs opacity-70">{t.wordsLeft(wordsLeft)}</p>
						{:else}
							<p class="text-center text-sm">{t.wordsUsed}</p>
						{/if}
						<p class="text-xs opacity-70">{t.wordsHint}</p>
					</section>
				{/if}
			</div>
			<p class="flex items-center gap-2 text-sm" role="status">
				{#if share.connected}
					<span class="icon-[material-symbols-light--check-circle-outline] text-success size-5 shrink-0" aria-hidden="true"></span>{t.connected}
				{:else if share.used}
					<span class="icon-[material-symbols-light--link-off] size-5 shrink-0 opacity-70" aria-hidden="true"></span>{t.away}
				{:else}
					<span class="loading loading-dots loading-xs shrink-0"></span>{t.waiting}
				{/if}
			</p>
			<p class="text-xs opacity-70">
				{share.mode === 'edit' ? t.edit : t.view} · {share.expires ? t.endsAt(new Date(share.expires)) : t.untilEnded}
			</p>
			<div class="modal-action mt-0">
				<button type="button" class="btn" onclick={end}>{t.end}</button>
				<button type="button" class="btn" onclick={onclose}>{t.close}</button>
			</div>
		{/if}
	</div>
</Modal>
