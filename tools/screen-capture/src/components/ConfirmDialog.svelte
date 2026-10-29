<script lang="ts">
	import { m } from '#lib/i18n/index.js';
	import { answer, confirmState } from '#lib/ui/confirm.svelte.js';

	let dialog = $state<HTMLDialogElement>();
	let cancelButton = $state<HTMLButtonElement>();

	$effect(() => {
		if (!confirmState.current || !dialog) return;
		if (!dialog.open) dialog.showModal();
		// Not the confirm button, so Enter does not delete by accident
		cancelButton?.focus();
	});
</script>

{#if confirmState.current}
	{@const question = confirmState.current}
	<dialog
		bind:this={dialog}
		class="modal"
		oncancel={(e) => {
			e.preventDefault();
			answer(false);
		}}
	>
		<div class="modal-box">
			<h3 class="text-lg font-bold">{question.title}</h3>
			<p class="py-3">{question.message}</p>
			<div class="modal-action">
				<button bind:this={cancelButton} class="btn btn-ghost" onclick={() => answer(false)}>{m.common.cancel}</button>
				<button class="btn {question.danger ? 'btn-error' : 'btn-primary'}" onclick={() => answer(true)}>{question.confirm}</button>
			</div>
		</div>
	</dialog>
{/if}
