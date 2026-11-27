<script lang="ts">
	// The password of an encrypted folder (`vault-dialog.svelte.ts`), asked from any page. Unlocking takes a moment
	// (scrypt), so the dialog stays busy meanwhile. “Remember on this device” keeps the key sealed in this browser.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
	import { unlockWith } from './sources/connections.svelte.js';
	import { VaultFormatError, WrongPassword } from './sources/vault/formats.js';
	import { closeUnlock, unlockDialog } from './vault-dialog.svelte.js';

	const t = $derived(filesMessages().vault);
	let password = $state('');
	let remember = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	const focus = (input: HTMLInputElement) => input.focus();

	function close(unlocked: boolean) {
		password = '';
		remember = false;
		error = null;
		closeUnlock(unlocked);
	}

	async function unlock(e: SubmitEvent) {
		e.preventDefault();
		const asking = unlockDialog.current;
		if (!asking || !password) return;
		busy = true;
		error = null;
		try {
			await unlockWith(asking.id, password, remember);
			close(true);
		} catch (err) {
			if (err instanceof WrongPassword) error = t.wrongPassword;
			else if (err instanceof VaultFormatError) error = err.reason === 'unsupported' ? t.unsupported : t.invalid;
			else {
				console.error(err);
				error = filesErrorText(err);
			}
		} finally {
			busy = false;
		}
	}
</script>

{#if unlockDialog.current}
	<Modal onclose={() => close(false)} {busy} labelledby="unlock-title">
		<form class="modal-box flex max-w-md flex-col gap-3" onsubmit={unlock}>
			<h3 id="unlock-title" class="text-lg font-bold">{t.unlockTitle}</h3>
			<p class="text-sm">{t.unlockIntro(unlockDialog.current.name, unlockDialog.current.format)}</p>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold">{t.password}</span>
				<input type="password" class="input w-full" autocomplete="current-password" bind:value={password} disabled={busy} {@attach focus} />
			</label>
			<label class="flex items-start gap-2">
				<input type="checkbox" class="checkbox checkbox-sm mt-0.5" bind:checked={remember} disabled={busy} />
				<span class="flex flex-col">
					<span class="text-sm">{t.remember}</span>
					<span class="text-xs opacity-70">{t.rememberHint}</span>
				</span>
			</label>
			<p class="min-h-5 text-sm" class:text-error={!!error} role={error ? 'alert' : 'status'}>
				{#if busy}<span class="loading loading-spinner loading-xs mr-1"></span>{t.unlocking}{:else if error}{error}{/if}
			</p>
			<div class="modal-action mt-0">
				<button type="button" class="btn btn-ghost" onclick={() => close(false)} disabled={busy}>{t.cancel}</button>
				<button type="submit" class="btn btn-primary" disabled={busy || !password}>{t.unlock}</button>
			</div>
		</form>
	</Modal>
{/if}
