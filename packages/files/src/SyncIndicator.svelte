<script lang="ts">
	import { lang } from '@in-browser/brand/i18n/index.svelte.js';
	import { openMenuAbove, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { formatAgo } from './format.js';
	import { filesMessages } from './i18n/index.svelte.js';
	import { basename } from './path.js';
	import type { DeviceView } from './p2p/view.js';
	import { onP2pEvent, p2pStatus, syncDevicesNow } from './p2p/p2p.svelte.js';
	import { selfStale } from './p2p/staleness.js';
	import { syncNow, syncStatus } from './sync/sync.svelte.js';

	// Sync status in the footer of every tool (BrandFooter `indicators`): the folder on disk and the other devices.
	// Renders nothing while neither is set up. The status comes from the tabs that run the syncs, mirrored into every
	// tab; messages of the device sync (conflict copies, devices added or removed) show up as toasts here.

	const t = $derived(filesMessages());

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	// Toasts only in the tab in front, so they don't pile up in every open tab
	$effect(() =>
		onP2pEvent((event) => {
			if (document.visibilityState !== 'visible') return;
			const p = filesMessages().p2p;
			if (event.type === 'conflicts') toast(p.conflicts(event.paths.map((path) => basename(path))), 'warning', 8000);
			else if (event.type === 'added') toast(p.added(event.name), 'success');
			else if (event.type === 'removed') toast(p.removedDevice(event.name), 'info');
			else if (event.type === 'paired') toast(p.paired, 'success');
		})
	);

	const view = $derived(p2pStatus.view);
	const others = $derived(view.devices.filter((d) => !d.self));
	const online = $derived(others.filter((d) => d.online));
	const syncing = $derived(others.find((d) => d.syncing));
	const behind = $derived(others.find((d) => d.missing && (d.missing.changes > 0 || d.missing.more)));
	const selfBehind = $derived(view.state === 'online' && selfStale(view.lastSync, online.length, now));
	const devices = $derived(view.state === 'online' && others.length > 0);
	const folderProblem = $derived(!!syncStatus.folder && (syncStatus.state === 'paused' || syncStatus.failed > 0 || syncStatus.pendingDeletes > 0));
	const visible = $derived(!!syncStatus.folder || view.state === 'removed' || devices);

	type Tone = 'ok' | 'busy' | 'warn' | 'idle';
	const status = $derived.by((): { label: string; tone: Tone } => {
		const p = t.p2p;
		if (view.state === 'removed') return { label: p.removed, tone: 'warn' };
		if (syncing?.syncing) return { label: p.syncingWith(syncing.name, syncing.syncing.done, syncing.syncing.total), tone: 'busy' };
		if (syncStatus.state === 'syncing') return { label: t.indicator.syncing, tone: 'busy' };
		if (view.pendingDeletes) return { label: p.pendingDeletes(view.pendingDeletes), tone: 'warn' };
		if (folderProblem) {
			const label =
				syncStatus.state === 'paused'
					? t.indicator.paused
					: syncStatus.pendingDeletes
						? t.indicator.pendingDeletes(syncStatus.pendingDeletes)
						: t.indicator.failed(syncStatus.failed);
			return { label, tone: 'warn' };
		}
		if (selfBehind) return { label: p.selfBehind, tone: 'warn' };
		if (behind) return { label: p.probablyBehind(behind.name), tone: 'warn' };
		if (devices && !online.length) return { label: p.waiting, tone: 'idle' };
		if (devices) return { label: p.connected(online.length, others.length), tone: 'ok' };
return { label: t.indicator.synced, tone: 'ok' };
	});

	function deviceLine(d: DeviceView): string {
		const p = t.p2p;
		const state = d.outdated
			? p.outdated
			: d.online
				? p.online
				: d.unreachable
					? p.unreachable
					: d.lastSeen
						? p.lastSeen(formatAgo(d.lastSeen, now, lang.current))
						: p.never;
		const missing = d.missing && (d.missing.changes || d.missing.more) ? ` · ${p.missing(d.missing.changes, d.missing.more)}` : '';
		return `${d.name}: ${state}${missing}`;
	}

	function menu(e: MouseEvent) {
		const entries: MenuEntry[] = [];
		if (devices) {
			for (const d of others) entries.push({ heading: deviceLine(d) });
			entries.push({ separator: true });
		}
if (syncStatus.folder) {
			entries.push({ heading: t.indicator.folder(syncStatus.folder) });
			if (syncStatus.state === 'paused') entries.push({ heading: t.indicator.pausedHint });
			else if (syncStatus.lastSync) entries.push({ heading: t.indicator.lastSync(formatAgo(syncStatus.lastSync, now, lang.current)) });
			entries.push({ separator: true });
		}
		entries.push({
			label: t.indicator.syncNow,
			icon: 'icon-[material-symbols-light--sync]',
			disabled: status.tone === 'busy' || view.state === 'removed',
			run: () => {
				if (syncStatus.folder) syncNow();
				if (devices) void syncDevicesNow();
			}
		});
		const manage = view.state !== 'off' ? t.p2p.manage : t.indicator.manage;
		entries.push({ label: manage, icon: 'icon-[material-symbols-light--settings-outline]', run: () => location.assign('/files?panel=sync') });
		// New tab: the tool stays as it is
		entries.push({ label: t.indicator.help, icon: 'icon-[material-symbols-light--help-outline]', run: () => window.open('/help/sync', '_blank', 'noopener') });
		openMenuAbove(e, entries);
	}
</script>

{#if visible}
	<button
		class={['btn btn-ghost btn-xs max-w-80 min-w-0 font-normal', status.tone === 'warn' && 'text-warning']}
		onclick={menu}
		title={t.indicator.label}
		aria-label="{t.indicator.label}: {status.label}"
	>
		{#if status.tone === 'busy'}
			<span class="icon-[material-symbols-light--sync] size-4 shrink-0 animate-spin" aria-hidden="true"></span>
		{:else if status.tone === 'warn'}
			<span class="icon-[material-symbols-light--sync-problem] size-4 shrink-0" aria-hidden="true"></span>
		{:else if status.tone === 'idle'}
			<span class="icon-[material-symbols-light--devices-outline] size-4 shrink-0 opacity-70" aria-hidden="true"></span>
		{:else if devices}
			<span class="icon-[material-symbols-light--devices-outline] text-success size-4 shrink-0" aria-hidden="true"></span>
{:else}
			<span class="icon-[material-symbols-light--cloud-done-outline] text-success size-4 shrink-0" aria-hidden="true"></span>
		{/if}
		<span class="hidden truncate sm:inline">{status.label}</span>
	</button>
{/if}
