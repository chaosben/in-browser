<script lang="ts">
	import { toasts } from '#lib/ui/toast.svelte.js';

	const alertClass = {
		info: 'alert-info',
		success: 'alert-success',
		warning: 'alert-warning',
		error: 'alert-error'
	};
</script>

<div class="toast toast-end z-50">
	{#each toasts as t (t.id)}
		<div role="status" class="alert {alertClass[t.kind]} max-w-md whitespace-normal">
			<span>{t.text}</span>
		</div>
	{/each}
</div>
