<script lang="ts">
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import {
		allowAccess,
		connectFolder,
		connectionLabel,
		connections,
		connectionsSupported,
		type ConnectionView
	} from '@in-browser/files/sources/connections.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import FolderTree from './FolderTree.svelte';

	// “Connected” in the sidebar of Files: folders on the computer and guest shares opened live (not part of My files)

	interface Props {
		current: string;
		onnavigate: (path: string) => void;
		ondropitems: (paths: string[], folder: string, copy: boolean) => void;
		ondropfiles: (data: DataTransfer, folder: string) => void;
		/** Menu of a connection (allow access, rename, disconnect) */
		onmenu: (e: MouseEvent, connection: ConnectionView) => void;
		/** Menu of a folder inside a connection */
		onfoldermenu: (e: MouseEvent, path: string) => void;
	}

	let { current, onnavigate, ondropitems, ondropfiles, onmenu, onfoldermenu }: Props = $props();

	async function connect() {
		try {
			const result = await connectFolder();
			if (!result) return;
			if (result.alsoSynced) toast(m.connected.alsoSynced(connections.list.find((c) => c.path === result.path)?.name ?? ''), 'info', 8000);
			onnavigate(result.path);
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	async function allow(connection: ConnectionView) {
		if (await allowAccess(connection.id)) onnavigate(connection.path);
	}
</script>

<section class="flex flex-col gap-1" aria-label={m.connected.title}>
	<h2 class="px-2 text-xs font-semibold opacity-60">{m.connected.title}</h2>
	{#if connections.list.length}
		<ul role="tree" aria-label={m.connected.title}>
			{#each connections.list as connection (connection.id)}
				{#if connection.ended}
					<li
						class="flex items-center gap-1.5 py-1 pr-2 pl-6.5 text-sm"
						oncontextmenu={(e) => {
							e.preventDefault();
							onmenu(e, connection);
						}}
					>
						<span class="icon-[material-symbols-light--link-off] size-5 shrink-0 opacity-60" aria-hidden="true"></span>
						<button class="min-w-0 flex-1 truncate text-left opacity-60" title={m.share.ended} onclick={() => onnavigate(connection.path)}>
							{connectionLabel(connection)}
						</button>
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
						{onfoldermenu}
						onmenu={(e) => onmenu(e, connection)}
					/>
				{:else}
					<li
						class="flex items-center gap-1.5 py-1 pr-2 pl-6.5 text-sm"
						oncontextmenu={(e) => {
							e.preventDefault();
							onmenu(e, connection);
						}}
					>
						<span class="icon-[material-symbols-light--link-off] size-5 shrink-0 opacity-60" aria-hidden="true"></span>
						<span class="min-w-0 flex-1 truncate opacity-60" title={m.connected.noAccess(connection.name)}>{connection.name}</span>
						<button class="btn btn-ghost btn-xs" onclick={() => allow(connection)}>{m.connected.allow}</button>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
	{#if connectionsSupported()}
		<button class="btn btn-ghost justify-start gap-2 px-2 font-normal" onclick={connect} title={m.connected.connectHint}>
			<span class="icon-[material-symbols-light--add-link] size-5 shrink-0" aria-hidden="true"></span>
			<span class="text-sm">{m.connected.connect}</span>
		</button>
	{:else}
		<p class="px-2 text-xs opacity-60">{m.connected.unsupported}</p>
	{/if}
</section>
