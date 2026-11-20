<script lang="ts">
	// Tiles of a side panel: a click inserts at the playhead, dragging drops onto the preview or the timeline
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { ToolActions, ToolItem } from '#lib/tools/types.js';
	import { m } from '#lib/i18n/index.js';

	interface Props {
		items: ToolItem[];
		actions: ToolActions;
	}

	let { items, actions }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2 p-3">
	{#each items as item (item.id)}
		<button
			class="btn bg-base-100 h-auto flex-col gap-1 py-3 font-normal"
			aria-label={m.editor.add(item.label)}
			title={item.drag ? m.editor.dragHint : undefined}
			draggable={!!item.drag}
			ondragstart={(e) => item.drag && setDragPayload(e, item.drag)}
			onclick={() => item.run(actions)}
		>
			<span class="{item.icon} size-8" aria-hidden="true"></span>
			<span class="text-xs">{item.label}</span>
		</button>
	{/each}
</div>
