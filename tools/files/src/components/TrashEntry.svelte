<script lang="ts">
	import { openDevicesDialog } from '#lib/devices.svelte.js';
	import { m } from '#lib/i18n/index.js';

	// The trash in the sidebar of Files (on phones: in the menu at the tool name)
</script>

<button class="btn btn-ghost justify-start gap-2 px-2 font-normal" onclick={() => openDevicesDialog('trash')}>
	<span class="icon-[material-symbols-light--delete-outline] size-5 shrink-0" aria-hidden="true"></span>
	<span class="text-sm">{m.trash.title}</span>
</button>
