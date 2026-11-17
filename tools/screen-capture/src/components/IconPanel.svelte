<script lang="ts">
	// Icons tab of the tool panel: the shared picker; click inserts at the playhead, dragging onto preview/timeline
	import IconPicker from '@in-browser/graphics/IconPicker.svelte';
	import { m } from '#lib/i18n/index.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { ToolProps } from '#lib/tools/types.js';

	let { actions }: ToolProps = $props();
</script>

<IconPicker
	onpick={(icon) => actions.addIcon(icon)}
	ondragstart={(e, icon) => setDragPayload(e, { type: 'icon', icon })}
	hint={m.icons.hint}
/>
