<script lang="ts">
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { formatAgo } from '@in-browser/files/format.js';
	import { list, remove } from '@in-browser/files/fs.js';
	import type { DeviceView } from '@in-browser/files/p2p/device.js';
	import {
		applyDeviceDeletes,
		forgetGroup,
		leaveGroup,
		p2pStatus,
		removeDevice,
		renameDevice,
		syncDevicesNow
	} from '@in-browser/files/p2p/p2p.svelte.js';
	import { selfStale } from '@in-browser/files/p2p/staleness.js';
	import { openDevicesDialog } from '#lib/devices.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { sourceUrl } from '@in-browser/brand/build.js';

	// The devices this one syncs with: status, hints on devices that are probably not up to date, actions.
	// Part of the sync dialog of Files.

	const view = $derived(p2pStatus.view);
	const others = $derived(view.devices.filter((d) => !d.self));
	const self = $derived(view.devices.find((d) => d.self));

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const ago = (time: number) => formatAgo(time, now, intlLocale);
	const selfBehind = $derived(view.state === 'online' && selfStale(view.lastSync, others.filter((d) => d.online).length, now));

	let renaming = $state(false);

	async function run(action: () => Promise<unknown>) {
		try {
			await action();
		} catch (e) {
			console.error(e);
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		}
	}

	async function confirmRemove(device: DeviceView) {
		const ok = await ask({ title: m.devices.removeTitle(device.name), message: m.devices.removeMessage, confirm: m.devices.remove, danger: true });
		if (ok) run(() => removeDevice(device.id));
	}

	async function confirmLeave() {
		const ok = await ask({ title: m.devices.leaveTitle, message: m.devices.leaveMessage, confirm: m.devices.leave });
		if (ok) run(leaveGroup);
	}

	/** Back to the start after being removed: optionally without the synced files */
	async function reset(deleteFiles: boolean) {
		if (deleteFiles) {
			const ok = await ask({ title: m.devices.resetDeleteTitle, message: m.devices.resetDeleteMessage, confirm: m.devices.resetDelete, danger: true });
			if (!ok) return;
		}
		await run(async () => {
			if (deleteFiles) for (const entry of await list('/')) await remove(entry.path);
			await forgetGroup();
		});
	}

	function renameField(input: HTMLInputElement) {
		input.focus();
		input.select();
	}

	function commitRename(input: HTMLInputElement) {
		if (!renaming) return;
		renaming = false;
		const name = input.value.trim();
		if (name && name !== self?.name) run(() => renameDevice(name));
	}

	function stateText(d: DeviceView) {
		if (d.outdated) return m.devices.outdated;
		if (d.syncing) return m.devices.syncing(d.syncing.done, d.syncing.total);
		if (d.online) return m.devices.online;
		if (d.unreachable) return m.devices.unreachable;
		return d.lastSeen ? m.devices.lastSeen(ago(d.lastSeen)) : m.devices.never;
	}
</script>

<section class="flex flex-col gap-2 text-sm">
	<div class="flex items-center gap-1.5">
		<h2 class="flex flex-1 items-center gap-1.5 font-semibold">
			<span class="icon-[material-symbols-light--devices-outline] size-5" aria-hidden="true"></span>
			{m.devices.title}
		</h2>
		<!-- No context menus here: the panel lives in a modal dialog, which makes popovers outside it inert -->
		<button class="btn btn-ghost btn-xs btn-square" onclick={() => openDevicesDialog('explain')} title={m.devices.howItWorks} aria-label={m.devices.howItWorks}>
			<span class="icon-[material-symbols-light--help-outline] size-5" aria-hidden="true"></span>
		</button>
	</div>

	{#if !p2pStatus.supported}
		<p class="opacity-70">{m.devices.unsupported}</p>
	{:else if view.state === 'removed'}
		<div role="alert" class="alert alert-warning flex-col items-start gap-2 p-2 text-xs">
			<span class="font-semibold">{m.devices.removedTitle}</span>
			<span>{m.devices.removedMessage}</span>
			<span>{m.devices.resetHint}</span>
			<div class="flex flex-wrap gap-1">
				<button class="btn btn-xs" onclick={() => reset(false)}>{m.devices.resetKeep}</button>
				<button class="btn btn-xs btn-error" onclick={() => reset(true)}>{m.devices.resetDelete}</button>
			</div>
		</div>
	{:else if view.state === 'off'}
		<p class="opacity-70">{m.devices.intro}</p>
		<div class="flex flex-wrap gap-1">
			<button class="btn btn-sm btn-primary" onclick={() => openDevicesDialog('setup')}>
				<span class="icon-[material-symbols-light--devices-outline] size-5" aria-hidden="true"></span>
				{m.devices.connect}
			</button>
			<button class="btn btn-sm" onclick={() => openDevicesDialog('join')}>
				<span class="icon-[material-symbols-light--key-outline] size-5" aria-hidden="true"></span>
				{m.devices.enterKey}
			</button>
		</div>
	{:else}
		{#if selfBehind}
			<p role="alert" class="text-warning flex gap-1.5 text-xs">
				<span class="icon-[material-symbols-light--sync-problem] size-4 shrink-0" aria-hidden="true"></span>
				{m.devices.selfBehind(ago(view.lastSync))}
			</p>
		{/if}
		<ul class="flex flex-col gap-2">
			{#if self}
				<li class="flex items-start gap-2">
					<span class="icon-[material-symbols-light--check-circle-outline] text-success mt-0.5 size-4 shrink-0" aria-hidden="true"></span>
					<div class="min-w-0 flex-1">
						{#if renaming}
							<input
								class="input input-xs w-full"
								value={self.name}
								aria-label={m.devices.nameLabel}
								{@attach renameField}
								onkeydown={(e) => {
									if (e.key === 'Enter') commitRename(e.currentTarget);
									if (e.key === 'Escape') renaming = false;
								}}
								onblur={(e) => commitRename(e.currentTarget)}
							/>
						{:else}
							<button class="link link-hover block max-w-full truncate text-left font-medium" title={m.devices.rename} onclick={() => (renaming = true)}>
								{self.name}
							</button>
						{/if}
						<span class="text-xs opacity-60">{m.devices.thisDevice}</span>
					</div>
				</li>
			{/if}
			{#each others as d (d.id)}
				{@const behind = !!d.missing && (d.missing.changes > 0 || d.missing.more)}
				<li class="flex items-start gap-2">
					{#if d.syncing}
						<span class="icon-[material-symbols-light--sync] mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true"></span>
					{:else if d.outdated || d.unreachable || behind}
						<span class="icon-[material-symbols-light--sync-problem] text-warning mt-0.5 size-4 shrink-0" aria-hidden="true"></span>
					{:else if d.online}
						<span class="icon-[material-symbols-light--devices-outline] text-success mt-0.5 size-4 shrink-0" aria-hidden="true"></span>
					{:else}
						<span class="icon-[material-symbols-light--devices-outline] mt-0.5 size-4 shrink-0 opacity-50" aria-hidden="true"></span>
					{/if}
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate font-medium">{d.name}</span>
						<span class={['text-xs', d.outdated || d.unreachable ? 'text-warning' : 'opacity-60']}>{stateText(d)}</span>
						{#if behind && d.missing}
							<span class="text-warning text-xs">{m.devices.probablyBehind(m.devices.changes(d.missing.changes, d.missing.more), d.lastSync ? ago(d.lastSync) : m.devices.never)}</span>
						{:else if d.lastSync && !d.syncing}
							<span class="text-xs opacity-60">{m.devices.lastSync(ago(d.lastSync))} · {m.devices.upToDate}</span>
						{/if}
					</div>
					<button class="btn btn-ghost btn-xs btn-square" onclick={() => confirmRemove(d)} title={m.devices.removeNamed(d.name)} aria-label={m.devices.removeNamed(d.name)}>
						<span class="icon-[material-symbols-light--person-remove-outline] size-4" aria-hidden="true"></span>
					</button>
				</li>
			{/each}
		</ul>
		{#if !others.some((d) => d.online)}
			<p class="text-xs opacity-60">{m.devices.waiting}</p>
		{/if}
		{#if view.scope.length}
			<button class="link link-hover text-left text-xs opacity-70" onclick={() => openDevicesDialog('scope')}>{m.devices.excludedCount(view.scope.length)}</button>
		{/if}
		{#if view.pendingDeletes}
			<div class="alert alert-warning flex-col items-start gap-2 p-2 text-xs">
				<span>{m.devices.pendingDeletes(view.pendingDeletes)}</span>
				<button class="btn btn-xs btn-error" onclick={() => run(applyDeviceDeletes)}>{m.devices.applyDeletes}</button>
			</div>
		{/if}
		<div class="flex flex-wrap gap-1">
			<button class="btn btn-xs" onclick={() => openDevicesDialog('pair')}>
				<span class="icon-[material-symbols-light--qr-code-2] size-4" aria-hidden="true"></span>
				{m.devices.addDevice}
			</button>
			<button class="btn btn-xs" onclick={() => openDevicesDialog('scope')}>
				<span class="icon-[material-symbols-light--folder-open-outline] size-4" aria-hidden="true"></span>
				{m.devices.chooseFolders}
			</button>
			<button class="btn btn-xs" onclick={() => run(syncDevicesNow)}>
				<span class="icon-[material-symbols-light--sync] size-4" aria-hidden="true"></span>
				{m.devices.syncNow}
			</button>
			<button class="btn btn-xs btn-ghost" onclick={confirmLeave}>
				<span class="icon-[material-symbols-light--link-off] size-4" aria-hidden="true"></span>
				{m.devices.leave}
			</button>
		</div>
		<p class="text-xs opacity-60">
			{m.devices.runsWhileOpen}
			<a class="link" href={sourceUrl('packages/p2p-node/README.md')} target="_blank" rel="noopener">{m.devices.p2pNode}</a>
		</p>
	{/if}
</section>
