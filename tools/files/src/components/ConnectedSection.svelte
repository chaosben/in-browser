<script lang="ts">
	import {
		allowAccess,
		connectionLabel,
		connections,
		connectionsSupported,
		type ConnectionView
	} from '@in-browser/files/sources/connections.svelte.js';
	import MoreButton from '@in-browser/brand/MoreButton.svelte';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { connect } from '#lib/connections.js';
	import { m } from '#lib/i18n/index.js';
	import type { Item } from '#lib/items.js';
	import FolderTree from './FolderTree.svelte';

	// Below My files in the panel “Folders”: folders on the computer and guest shares opened live (not part of My files)

	interface Props {
		current: string;
		onnavigate: (path: string) => void;
		ondropitems: (paths: string[], folder: string, copy: boolean) => void;
		ondropfiles: (data: DataTransfer, folder: string) => void;
		/** Menu of a connection (allow access, rename, disconnect) */
		menu: (connection: ConnectionView) => MenuEntry[];
		/** Menu of a folder inside a connection */
		foldermenu: (item: Item) => MenuEntry[];
	}

	let { current, onnavigate, ondropitems, ondropfiles, menu, foldermenu }: Props = $props();

	async function allow(connection: ConnectionView) {
		if (await allowAccess(connection.id)) onnavigate(connection.path);
	}
</script>

<section class="border-base-300 flex flex-col gap-1 border-t pt-1" aria-label={m.connected.title}>
	{#if connections.list.length}
		<ul role="tree" aria-label={m.connected.title}>
			{#each connections.list as connection (connection.id)}
				{#if connection.ended}
					<li
						class="flex items-center gap-1.5 py-1 pr-2 pl-6.5 text-sm"
						oncontextmenu={(e) => openContextMenu(e, menu(connection))}
					>
						<span class="icon-[material-symbols-light--link-off] size-5 shrink-0 opacity-60" aria-hidden="true"></span>
						<button class="min-w-0 flex-1 truncate text-left opacity-60" title={m.share.ended} onclick={() => onnavigate(connection.path)}>
							{connectionLabel(connection)}
						</button>
						{#if coarsePointer.current}<MoreButton name={connectionLabel(connection)} entries={() => menu(connection)} class="-my-1" />{/if}
					</li>
				{:else if connection.access === 'granted'}
					<FolderTree
						path={connection.path}
						label={connectionLabel(connection)}
						connected
						shared={connection.kind === 'share'}
						readOnly={connection.mode === 'view'}
						{current}
						{onnavigate}
						{ondropitems}
						{ondropfiles}
						{foldermenu}
						menu={() => menu(connection)}
					/>
				{:else}
					<li
						class="flex items-center gap-1.5 py-1 pr-2 pl-6.5 text-sm"
						oncontextmenu={(e) => openContextMenu(e, menu(connection))}
					>
						<span class="icon-[material-symbols-light--link-off] size-5 shrink-0 opacity-60" aria-hidden="true"></span>
						<span class="min-w-0 flex-1 truncate opacity-60" title={m.connected.noAccess(connection.name)}>{connection.name}</span>
						<button class="btn btn-primary btn-xs" onclick={() => allow(connection)}>{m.connected.allow}</button>
						{#if coarsePointer.current}<MoreButton name={connection.name} entries={() => menu(connection)} class="-my-1" />{/if}
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
	{#if connectionsSupported()}
		<button class="btn btn-ghost justify-start gap-2 px-2 font-normal" onclick={() => connect(onnavigate)} title={m.connected.connectHint}>
			<span class="icon-[material-symbols-light--add-link] size-5 shrink-0" aria-hidden="true"></span>
			<span class="text-sm">{m.connected.connect}</span>
		</button>
	{:else}
		<p class="px-2 text-xs opacity-60">{m.connected.unsupported}</p>
	{/if}
</section>
