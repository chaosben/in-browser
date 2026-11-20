<script lang="ts">
	import { brandMessages } from './i18n/index.svelte.js';
	import { answer, confirmState } from './ui/confirm.svelte.js';

	let dialog = $state<HTMLDialogElement>();
	let cancelButton = $state<HTMLButtonElement>();
	/** The option's checkbox; unchecked again for every question */
	let checked = $derived.by(() => {
		void confirmState.current;
		return false;
	});

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
			answer(false, checked);
		}}
	>
		<div class="modal-box">
			<h3 class="text-lg font-bold">{question.title}</h3>
			<p class="py-3">{question.message}</p>
			{#if question.option}
				<label class="flex cursor-pointer items-center gap-2 pb-1">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked />
					<span class="text-sm">{question.option}</span>
				</label>
			{/if}
			<div class="modal-action">
				<button bind:this={cancelButton} class="btn btn-ghost" onclick={() => answer(false, checked)}>{question.cancel ?? brandMessages().common.cancel}</button>
				<button class="btn {question.danger ? 'btn-error' : 'btn-primary'}" onclick={() => answer(true, checked)}>{question.confirm}</button>
			</div>
		</div>
	</dialog>
{/if}
