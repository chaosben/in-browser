<script lang="ts">
	// “New encrypted folder …”: name and password, then the master key to write down (shown once, never kept). The
	// folder is made in the open folder of My files and opens decrypted under “Connected” (`onopen`).
	import Modal from '@in-browser/brand/Modal.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { exists } from '@in-browser/files/fs.js';
	import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import { join, nameProblem, uniqueName } from '@in-browser/files/path.js';
	import { createVault } from '@in-browser/files/sources/connections.svelte.js';
	import { DEFAULT_VAULT_FORMAT, VAULT_FORMATS, type VaultFormatId } from '@in-browser/files/sources/vault/formats.js';
	import { m } from '#lib/i18n/index.js';

	interface Props {
		/** Folder of My files it is made in */
		folder: string;
		/** Names taken in that folder */
		taken: string[];
		onopen: (root: string) => void;
		onclose: () => void;
	}

	let { folder, taken, onopen, onclose }: Props = $props();

	const MIN_LENGTH = 8;
	const fm = $derived(filesMessages().vault);
	// svelte-ignore state_referenced_locally
	let name = $state(uniqueName(m.vault.defaultName, taken));
	let password = $state('');
	let repeat = $state('');
	let remember = $state(false);
	/** The technology of the new folder (decided by the user: a choice, even while there is one) */
	let format = $state<VaultFormatId>(DEFAULT_VAULT_FORMAT);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let created = $state<{ root: string; masterKey: string } | null>(null);
	const focus = (input: HTMLInputElement) => input.select();

	async function create(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		const trimmed = name.trim();
		if (nameProblem(trimmed)) return void (error = filesMessages().errors.invalidName(trimmed));
		if (password.length < MIN_LENGTH) return void (error = m.vault.tooShort(MIN_LENGTH));
		if (password !== repeat) return void (error = m.vault.mismatch);
		busy = true;
		try {
			const path = join(folder, trimmed);
			if (await exists(path)) throw new Error(filesMessages().errors.exists(trimmed));
			const result = await createVault(path, password, remember, format);
			password = repeat = '';
			// Without a key to write down (Cryptomator: its recovery key is made in Cryptomator) the folder opens at once
			if (result.masterKey === null) {
				onopen(result.root);
				onclose();
				return;
			}
			created = { root: result.root, masterKey: result.masterKey };
		} catch (err) {
			console.error(err);
			error = filesErrorText(err);
		} finally {
			busy = false;
		}
	}

	async function copy() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created.masterKey);
			toast(m.vault.copied, 'success', 4000);
		} catch (err) {
			console.error(err);
			toast(filesErrorText(err), 'error', 8000);
		}
	}

	function finish() {
		if (created) onopen(created.root);
		onclose();
	}
</script>

<Modal onclose={() => (created ? finish() : onclose())} {busy} labelledby="new-vault-title">
	{#if created}
		<div class="modal-box flex max-w-md flex-col gap-3">
			<h3 id="new-vault-title" class="text-lg font-bold">{m.vault.keyTitle}</h3>
			<p class="text-sm">{m.vault.keyIntro}</p>
			<code class="bg-base-200 rounded p-3 text-center font-mono text-sm break-all select-all" data-master-key>{created.masterKey}</code>
			<div class="modal-action mt-0">
				<button type="button" class="btn btn-ghost" onclick={copy}>
					<span class="icon-[material-symbols-light--content-copy-outline] size-5" aria-hidden="true"></span>{m.vault.copy}
				</button>
				<button type="button" class="btn btn-primary" onclick={finish}>{m.vault.done}</button>
			</div>
		</div>
	{:else}
		<form class="modal-box flex max-w-md flex-col gap-3" onsubmit={create}>
			<h3 id="new-vault-title" class="text-lg font-bold">{m.vault.newTitle}</h3>
			<p class="text-sm">{m.vault.newIntro}</p>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold">{m.vault.name}</span>
				<input class="input w-full" bind:value={name} disabled={busy} {@attach focus} />
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold">{m.vault.format}</span>
				<select class="select w-full" bind:value={format} disabled={busy}>
					{#each Object.values(VAULT_FORMATS) as option (option.id)}
						<option value={option.id}>{m.vault.formatOption(option.name, option.id === DEFAULT_VAULT_FORMAT)}</option>
					{/each}
				</select>
				<span class="text-xs opacity-70">{m.vault.formats[format]}</span>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold">{m.vault.password}</span>
				<input type="password" class="input w-full" autocomplete="new-password" bind:value={password} disabled={busy} />
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold">{m.vault.repeat}</span>
				<input type="password" class="input w-full" autocomplete="new-password" bind:value={repeat} disabled={busy} />
			</label>
			<label class="flex items-start gap-2">
				<input type="checkbox" class="checkbox checkbox-sm mt-0.5" bind:checked={remember} disabled={busy} />
				<span class="flex flex-col">
					<span class="text-sm">{fm.remember}</span>
					<span class="text-xs opacity-70">{fm.rememberHint}</span>
				</span>
			</label>
			<p class="min-h-5 text-sm" class:text-error={!!error} role={error ? 'alert' : 'status'}>
				{#if busy}<span class="loading loading-spinner loading-xs mr-1"></span>{m.vault.creating}{:else if error}{error}{/if}
			</p>
			<div class="modal-action mt-0">
				<button type="button" class="btn btn-ghost" onclick={onclose} disabled={busy}>{m.vault.cancel}</button>
				<button type="submit" class="btn btn-primary" disabled={busy || !password || !repeat}>{m.vault.create}</button>
			</div>
		</form>
	{/if}
</Modal>
