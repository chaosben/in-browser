<script lang="ts">
	import { dismissToast, toasts, type Toast } from './ui/toast.svelte.js';

	const alertClass = {
		info: 'alert-info',
		success: 'alert-success',
		warning: 'alert-warning',
		error: 'alert-error'
	};

	function act(t: Toast) {
		dismissToast(t.id);
		void t.action?.run();
	}
</script>

<div class="toast toast-end z-50">
	{#each toasts as t (t.id)}
		<div role="status" class="alert {alertClass[t.kind]} max-w-md whitespace-normal">
			<span>{t.text}</span>
			{#if t.action}
				<button class="btn btn-sm" onclick={() => act(t)}>{t.action.label}</button>
			{/if}
		</div>
	{/each}
</div>
