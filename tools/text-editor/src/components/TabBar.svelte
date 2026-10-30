<script lang="ts">
	import { openContextMenu } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import type { Tab, Workspace } from '#lib/workspace.svelte.js';

	// The open files; click shows, middle click or × closes, right click for more. A dot marks what is not saved and
	// won't save itself (no place yet, or paused by a conflict or problem).

	let { workspace }: { workspace: Workspace } = $props();

	function menu(e: MouseEvent, tab: Tab) {
		openContextMenu(e, [
			{ label: m.actions.close, icon: 'icon-[material-symbols-light--close]', keys: 'Alt+W', run: () => workspace.close(tab) },
			{
				label: m.actions.closeOthers,
				icon: 'icon-[material-symbols-light--tab-close-outline]',
				disabled: workspace.tabs.length < 2,
				run: () => workspace.closeOthers(tab)
			},
			...(tab.path
				? [
						{ separator: true } as const,
						{ label: m.actions.showInFiles, icon: 'icon-[material-symbols-light--open-in-new]', run: () => workspace.showInFiles(tab) }
					]
				: [])
		]);
	}

	function onkeydown(e: KeyboardEvent, tab: Tab) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			workspace.activate(tab);
		}
	}
</script>

<div role="tablist" class="tabs tabs-lift tabs-sm bg-base-200 shrink-0 flex-nowrap overflow-x-auto px-1 pt-1">
	{#each workspace.tabs as tab (tab.id)}
		<div
			role="tab"
			tabindex="0"
			aria-selected={tab === workspace.active}
			class={['tab flex-nowrap gap-1 pr-1 whitespace-nowrap', tab === workspace.active && 'tab-active']}
			title={tab.path ?? tab.name}
			onclick={() => workspace.activate(tab)}
			onkeydown={(e) => onkeydown(e, tab)}
			onmousedown={(e) => e.button === 1 && e.preventDefault()}
			onauxclick={(e) => e.button === 1 && workspace.close(tab)}
			oncontextmenu={(e) => menu(e, tab)}
		>
			<span class={['max-w-48 truncate', tab.conflict === 'deleted' && 'line-through']}>{tab.name}</span>
			{#if tab.dirty && !tab.pending && !tab.saving}
				<span class="bg-base-content/60 size-2 shrink-0 rounded-full" title={m.status.notSaved}></span>
			{/if}
			<button
				class="btn btn-ghost btn-xs btn-square"
				title={m.actions.close}
				aria-label={m.actions.close}
				onclick={(e) => {
					e.stopPropagation();
					workspace.close(tab);
				}}
			>
				<span class="icon-[material-symbols-light--close] size-4" aria-hidden="true"></span>
			</button>
		</div>
	{/each}
</div>
