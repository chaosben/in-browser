<script lang="ts">
	// The panel “Folders” of Files: the tree of My files, the connected folders below it and the trash at the end – a
	// special folder that shows what was deleted (`/files?trash`)
	import type { PanelProps } from '@in-browser/brand/panels.js';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import { openContextMenu } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import ConnectedSection from '#lib/components/ConnectedSection.svelte';
	import FolderTree from '#lib/components/FolderTree.svelte';
	import { openTab } from '#lib/actions.js';
	import { DRAG_TYPE, droppedPaths } from '#lib/dnd.js';
	import { resolve } from '$app/paths';
	import { m } from '#lib/i18n/index.js';
	import type { FilesPanelContext } from './context.js';

	let { context, close }: PanelProps<FilesPanelContext> = $props();

	/** Own entries dragged over the trash */
	let target = $state(false);

	function go(path: string) {
		context.navigate(path);
		if (context.sheet()) close();
	}

	function openTrash() {
		context.openTrash();
		if (context.sheet()) close();
	}

	function dragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return;
		e.preventDefault();
		target = true;
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		target = false;
		const paths = droppedPaths(e);
		if (paths) context.dropOnTrash(paths);
	}
</script>

<div class="flex flex-col gap-1 p-2">
	<ul role="tree" aria-label={filesMessages().root}>
		<FolderTree
			path="/"
			current={context.current()}
			onnavigate={go}
			ondropitems={context.dropItems}
			ondropfiles={context.dropFiles}
			menu={context.rootMenu}
			foldermenu={context.folderMenu}
		/>
	</ul>
	<ConnectedSection
		current={context.current()}
		onnavigate={go}
		ondropitems={context.dropItems}
		ondropfiles={context.dropFiles}
		menu={context.connectionMenu}
		foldermenu={context.folderMenu}
	/>
	<ul class="border-base-300 border-t pt-1" role="tree" aria-label={m.trash.title}>
		<li>
			<div
				class={[
					'rounded-field flex items-center gap-0.5 pr-2 text-sm',
					context.trashOpen() ? 'bg-selection/10 font-semibold' : 'hover:bg-base-300',
					target && 'outline-selection outline-2'
				]}
				ondragover={dragOver}
				ondragleave={() => (target = false)}
				ondrop={drop}
				oncontextmenu={(e) => openContextMenu(e, context.trashMenu())}
				role="treeitem"
				tabindex="-1"
				aria-selected={context.trashOpen()}
			>
				<span class="size-6 shrink-0" aria-hidden="true"></span>
				<button
					class="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
					onclick={openTrash}
					onmousedown={(e) => e.button === 1 && e.preventDefault()}
					onauxclick={(e) => {
						if (e.button !== 1) return;
						e.preventDefault();
						openTab(`${resolve('/files')}?trash`);
					}}
				>
					<span class="icon-[material-symbols-light--delete-outline] size-5 shrink-0" aria-hidden="true"></span>
					<span class="truncate">{m.trash.title}</span>
				</button>
				{#if coarsePointer.current}<MoreButton name={m.trash.title} entries={context.trashMenu} class="-my-1" />{/if}
			</div>
		</li>
	</ul>
</div>
