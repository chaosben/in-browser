<script lang="ts">
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import {
		allowFolder,
		applyDeletes,
		chooseSyncFolder,
		excludeFromFolderSync,
		stopFolderSync,
		renewAccess,
		restoreDeleted,
		syncNow,
		syncStatus,
		syncSupported
	} from '@in-browser/files/sync/sync.svelte.js';
	import { openDevicesDialog } from '#lib/devices.svelte.js';
	import { formatDateTime, m } from '#lib/i18n/index.js';
	import HeldFolders from './HeldFolders.svelte';

	// Connect the shared file system with a folder on disk; status of the sync (which may run in another tab).

	async function run(action: () => Promise<void>) {
		try {
			await action();
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			console.error(e);
			toast(e instanceof Error ? e.message : String(e), 'error', 8000);
		}
	}

	async function confirmDisconnect() {
		const ok = await ask({
			title: m.sync.disconnectTitle,
			message: m.sync.disconnectMessage(syncStatus.folder ?? ''),
			confirm: m.sync.disconnect
		});
		if (ok) run(stopFolderSync);
	}
</script>

<section class="flex flex-col gap-2 text-sm">
	<h2 class="flex items-center gap-1.5 font-semibold">
		<span class="icon-[material-symbols-light--sync] size-5" aria-hidden="true"></span>
		{m.sync.title}
	</h2>

	{#if !syncSupported()}
		<p class="opacity-70">{m.sync.unsupported}</p>
	{:else if !syncStatus.folder}
		<p class="opacity-70">{m.sync.intro}</p>
		<button class="btn btn-sm btn-primary" onclick={() => run(async () => (await chooseSyncFolder(), openDevicesDialog('folderScope')))}>
			<span class="icon-[material-symbols-light--folder-open-outline] size-5" aria-hidden="true"></span>
			{m.sync.connect}
		</button>
	{:else if syncStatus.state === 'paused'}
		<p class="text-warning">{m.sync.paused(syncStatus.folder)}</p>
		<button class="btn btn-sm btn-primary" onclick={() => run(() => renewAccess(() => openDevicesDialog('folderScope')))}>{m.sync.renew}</button>
		<p class="text-xs opacity-60">{m.sync.renewHint}</p>
	{:else if syncStatus.state === 'setup'}
		<p class="text-warning">{m.sync.setup}</p>
		<button class="btn btn-sm btn-primary" onclick={() => openDevicesDialog('folderScope')}>
			<span class="icon-[material-symbols-light--folder-open-outline] size-5" aria-hidden="true"></span>
			{m.sync.chooseFolders}
		</button>
	{:else}
		<p class="flex items-start gap-1.5">
			<span class="icon-[material-symbols-light--cloud-done-outline] text-success size-5 shrink-0" aria-hidden="true"></span>
			<span class="min-w-0 break-words">{m.sync.connected(syncStatus.folder)}</span>
		</p>
		<p class="text-xs opacity-60">
			{#if syncStatus.state === 'syncing'}
				{m.sync.syncing}
			{:else if syncStatus.lastSync}
				{m.sync.lastSync(formatDateTime(syncStatus.lastSync))}
			{/if}
		</p>
	{/if}

	{#if syncStatus.folder}
		{#if syncStatus.failed}
			<p class="text-warning flex gap-1.5 text-xs">
				<span class="icon-[material-symbols-light--sync-problem] size-4 shrink-0" aria-hidden="true"></span>
				{m.sync.failed(syncStatus.failed)}
			</p>
		{/if}
		{#if syncStatus.pendingDeletes}
			<div class="alert alert-warning flex-col items-start gap-2 p-2 text-xs">
				<span>{m.sync.confirmDeletes(syncStatus.pendingDeletes)}</span>
				<div class="flex flex-wrap gap-1">
					<button class="btn btn-xs" onclick={applyDeletes}>{m.sync.applyDeletes}</button>
					<button class="btn btn-xs" onclick={restoreDeleted}>{m.sync.restoreInstead}</button>
				</div>
			</div>
		{/if}
		<HeldFolders folders={syncStatus.pendingFolders} onsync={allowFolder} onexclude={excludeFromFolderSync} />
		<div class="flex flex-wrap gap-1">
			{#if syncStatus.state !== 'paused' && syncStatus.state !== 'setup'}
				<button class="btn btn-xs" onclick={() => openDevicesDialog('folderScope')}>{m.sync.chooseFolders}</button>
			{/if}
			{#if syncStatus.state !== 'paused' && syncStatus.state !== 'setup'}
				<button class="btn btn-xs" onclick={syncNow} disabled={syncStatus.state === 'syncing'}>{m.sync.syncNow}</button>
			{/if}
			<button class="btn btn-xs btn-ghost" onclick={confirmDisconnect}>
				<span class="icon-[material-symbols-light--link-off] size-4" aria-hidden="true"></span>
				{m.sync.disconnect}
			</button>
		</div>
		<p class="text-xs opacity-60">{m.sync.runsWhileOpen}</p>
	{/if}
</section>
