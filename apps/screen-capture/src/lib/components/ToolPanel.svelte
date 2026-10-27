<script lang="ts">
	import { TOOL_GROUPS } from '#lib/tools/groups.js';
	import { toolState } from '#lib/tools/state.svelte.js';
	import { setDragPayload } from '#lib/tools/drag.js';
	import type { ToolProps } from '#lib/tools/types.js';
	import { m } from '#lib/i18n/index.js';

	let { editor, player, actions }: ToolProps = $props();

	const group = $derived(TOOL_GROUPS.find((g) => g.id === toolState.group));
	const tab = $derived(group && (group.tabs.find((t) => t.id === toolState.tabs[group.id]) ?? group.tabs[0]));
</script>

{#if group && tab}
	<aside class="bg-base-200 border-base-300 flex w-64 shrink-0 flex-col border-r">
		<div class="flex items-center justify-between py-1 pr-1 pl-3">
			<h2 class="text-sm font-semibold">{group.label}</h2>
			<button class="btn btn-ghost btn-sm btn-square" onclick={() => (toolState.group = null)} aria-label={m.tools.collapse}>
				<span class="icon-[material-symbols-light--left-panel-close-outline] size-5" aria-hidden="true"></span>
			</button>
		</div>
		{#if group.tabs.length > 1}
			<div role="tablist" class="tabs tabs-border px-2">
				{#each group.tabs as t (t.id)}
					<button
						role="tab"
						aria-selected={t === tab}
						class="tab {t === tab ? 'tab-active' : ''}"
						onclick={() => (toolState.tabs[group.id] = t.id)}
					>
						{t.label}
					</button>
				{/each}
			</div>
		{/if}
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if tab.component}
				<tab.component {editor} {player} {actions} />
			{/if}
			{#if tab.items?.length}
				<div class="grid grid-cols-2 gap-2 p-3">
					{#each tab.items as item (item.id)}
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
			{/if}
		</div>
	</aside>
{/if}
