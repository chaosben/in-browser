<script lang="ts">
	import { TOOL_GROUPS } from '#lib/tools/groups.js';
	import { toolState } from '#lib/tools/state.svelte.js';
	import { libraryUi } from '#lib/ui/library.svelte.js';
</script>

<div
	role="tablist"
	aria-orientation="vertical"
	class="bg-base-200 border-base-300 flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2"
>
	{#each TOOL_GROUPS as group (group.id)}
		{@const active = toolState.group === group.id}
		<button
			role="tab"
			aria-selected={active}
			aria-label={group.label}
			class="btn btn-ghost btn-square tooltip tooltip-right {active ? 'btn-active text-primary' : ''} {group.id === 'library' &&
			libraryUi.dragging
				? 'ring-primary ring-2'
				: ''}"
			data-tool-group={group.id}
			data-tip={group.label}
			onclick={() => toolState.toggle(group.id)}
		>
			<span class="{group.icon} size-6" aria-hidden="true"></span>
		</button>
	{/each}
</div>
