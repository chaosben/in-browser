<script lang="ts">
	// Asks for the password of a PDF that needs one to open (`model/password.svelte.ts`): shown while a question is
	// open, wherever the page placing it opens PDFs. “Remember on this device” only for files of the shared file system.
	import Modal from '@in-browser/brand/Modal.svelte';
	import { m } from '#lib/i18n/index.js';
	import { passwordRequest } from '#lib/model/password.svelte.js';

	let password = $state('');
	let shown = $state(false);
	let remember = $state(false);

	const request = $derived(passwordRequest.current);

	function answer(value: { password: string; remember: boolean } | null) {
		const r = passwordRequest.current;
		passwordRequest.current = null;
		password = '';
		shown = false;
		r?.resolve(value);
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (password) answer({ password, remember });
	}
</script>

{#if request}
	{#key request}
		<Modal onclose={() => answer(null)} labelledby="password-title">
			<form class="modal-box flex max-w-sm flex-col gap-3" onsubmit={submit}>
				<h3 id="password-title" class="flex items-center gap-2 text-lg font-bold">
					<span class="icon-[material-symbols-light--lock-outline] size-6" aria-hidden="true"></span>
					{m.password.title}
				</h3>
				<p class="text-sm">{m.password.hint(request.name)}</p>
				<label class="flex flex-col gap-1 text-sm">
					{m.password.field}
					<div class="flex items-center gap-1">
						<!-- svelte-ignore a11y_autofocus -->
						<input class="input input-sm min-w-0 flex-1" type={shown ? 'text' : 'password'} autocomplete="off" bind:value={password} autofocus />
						<button type="button" class="btn btn-ghost btn-sm btn-square" title={m.password.show} aria-label={m.password.show} aria-pressed={shown} onclick={() => (shown = !shown)}>
							<span class={[shown ? 'icon-[material-symbols-light--visibility-off-outline]' : 'icon-[material-symbols-light--visibility-outline]', 'size-5']} aria-hidden="true"></span>
						</button>
					</div>
				</label>
				<label class="flex items-start gap-2 text-sm">
					<input type="checkbox" class="checkbox checkbox-sm mt-0.5" bind:checked={remember} disabled={!request.canRemember} />
					<span>
						{m.password.remember}
						<span class="block text-xs opacity-70">{m.password.rememberHint}</span>
					</span>
				</label>
				<!-- Always there, so nothing jumps -->
				<p class={['text-error text-sm', !request.wrong && 'invisible']} role={request.wrong ? 'alert' : undefined}>{m.password.wrong}</p>
				<div class="modal-action mt-0">
					<button type="button" class="btn btn-ghost" onclick={() => answer(null)}>{m.common.cancel}</button>
					<button type="submit" class="btn btn-primary" disabled={!password}>{m.password.open}</button>
				</div>
			</form>
		</Modal>
	{/key}
{/if}
