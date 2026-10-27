<script lang="ts">
	import { brandMessages } from './i18n/index.svelte.js';
	import { applyUpdate, pwa } from './pwa.svelte.js';

	const t = $derived(brandMessages().pwa);

	let dismissed = $state(false);
</script>

{#if pwa.updateReady && !dismissed}
	<div class="toast toast-start z-50">
		<div role="status" class="alert alert-info shadow-lg">
			<span class="icon-[material-symbols-light--update] size-6" aria-hidden="true"></span>
			<span>{t.updateReady}</span>
			<div class="flex gap-1">
				<button class="btn btn-sm btn-ghost" onclick={() => (dismissed = true)}>{t.later}</button>
				<button class="btn btn-sm btn-primary" onclick={applyUpdate}>{t.reload}</button>
			</div>
		</div>
	</div>
{/if}
