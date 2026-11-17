<script lang="ts">
	import { m } from '#lib/i18n/index.js';

	// Field for the name of this device (setup and joining)

	let { value = $bindable(), autofocus = true }: { value: string; autofocus?: boolean } = $props();

	function select(input: HTMLInputElement) {
		if (!autofocus) return;
		input.focus();
		input.select();
	}
</script>

<label class="flex flex-col gap-1">
	<span class="text-sm font-medium">{m.devices.nameLabel}</span>
	<input class="input w-full" bind:value maxlength="60" {@attach select} />
	<span class="text-xs opacity-60">{m.devices.nameHint}</span>
</label>
