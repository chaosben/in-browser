<script lang="ts">
	// Side panel “Icons”: the shared picker; a click inserts at the playhead, dragging drops onto the preview or the timeline
	import IconPicker from '@in-browser/graphics/IconPicker.svelte';
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import { m } from '#lib/i18n/index.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { PanelContext } from '#lib/tools/types.js';

	let { context }: PanelProps<PanelContext> = $props();
</script>

<IconPicker
	onpick={(icon) => context.actions.addIcon(icon)}
	ondragstart={(e, icon) => setDragPayload(e, { type: 'icon', icon })}
	hint={m.icons.hint}
/>
