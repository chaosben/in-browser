<script lang="ts">
	import { p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import { syncStatus } from '@in-browser/files/sync/sync.svelte.js';
	import { openDevicesDialog } from '#lib/devices.svelte.js';
	import { m } from '#lib/i18n/index.js';

	// The sync in the sidebar of Files: one entry with a short status that opens the sync dialog

	const view = $derived(p2pStatus.view);
	const others = $derived(view.devices.filter((d) => !d.self));
	const online = $derived(others.filter((d) => d.online).length);
	const behind = $derived(others.some((d) => d.outdated || d.unreachable || (d.missing && (d.missing.changes > 0 || d.missing.more))));
	const folderProblem = $derived(!!syncStatus.folder && (syncStatus.state === 'paused' || syncStatus.failed > 0 || syncStatus.pendingDeletes > 0));
	const warn = $derived(view.state === 'removed' || view.pendingDeletes > 0 || behind || folderProblem);

	const lines = $derived.by(() => {
		const out: string[] = [];
		if (view.state === 'removed') out.push(m.syncHub.removed);
		else if (view.state === 'online') {
			if (!others.length) out.push(m.syncHub.alone);
			else if (!online) out.push(m.syncHub.waiting);
			else out.push(m.syncHub.devices(online, others.length));
		}
		if (syncStatus.folder) out.push(syncStatus.state === 'paused' ? m.syncHub.folderPaused : m.syncHub.folder(syncStatus.folder));
		return out.length ? out : [m.syncHub.off];
	});
</script>

<button class="btn btn-ghost h-auto justify-start gap-2 px-2 py-1.5 text-left font-normal" onclick={() => openDevicesDialog('sync')} title={m.syncHub.open}>
	{#if warn}
		<span class="icon-[material-symbols-light--sync-problem] text-warning size-5 shrink-0" aria-hidden="true"></span>
	{:else}
		<span class="icon-[material-symbols-light--sync] size-5 shrink-0" aria-hidden="true"></span>
	{/if}
	<span class="flex min-w-0 flex-col">
		<span class="text-sm font-semibold">{m.syncHub.title}</span>
		{#each lines as line (line)}
			<span class={['truncate text-xs', warn ? 'text-warning' : 'opacity-60']}>{line}</span>
		{/each}
	</span>
</button>
