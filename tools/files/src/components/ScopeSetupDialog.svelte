<script lang="ts">
	import Modal from '@in-browser/brand/Modal.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { storageEstimate } from '@in-browser/files/cache.js';
	import { formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { finishSetup, folderSizes, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import { exclude, include, inScope } from '@in-browser/files/p2p/scope.js';
	import { suiteSettings } from '@in-browser/files/suite-settings.svelte.js';
	import { handleTree } from '@in-browser/files/sync/handle-tree.js';
	import { opfsTree } from '@in-browser/files/sync/opfs-tree.js';
	import { folderAmounts, preselectExcluded, subfolders, type FolderAmounts } from '@in-browser/files/sync/scope-sizes.js';
	import { folderScope, setFolderScope, syncedFolder, syncStatus } from '@in-browser/files/sync/sync.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import ScopeTree, { type ScopeFolder } from './ScopeTree.svelte';

	// Look first, then sync: which folders a sync target takes part in, with what would travel each way.
	// - `folder`: the synced folder on disk – leaving a folder out deletes nothing on either side. While it is being
	//   set up (`syncStatus.state === 'setup'`), nothing moves until “Start syncing”.
	// - `device`: this device right after joining (`p2pStatus.view.setup`) – folders left out stay on the other
	//   devices; folders only this device has always go to them (leaving them out would delete them here).
	// In a setup, top-level folders that reach the size limit (suite setting) or don't fit are left out at first.

	let { mode, onclose }: { mode: 'folder' | 'device'; onclose: () => void } = $props();

	const setup = $derived(mode === 'folder' ? syncStatus.state === 'setup' : p2pStatus.view.setup);
	const limit = $derived(suiteSettings.values.sync.askAbove);

	let excluded = $state<string[]>([]);
	let top = $state<ScopeFolder[]>([]);
	let free = $state<number | null>(null);
	let error = $state<string | null>(null);
	let ready = $state(false);
	let saving = $state(false);
	let preselected = false;
	/** Folder mode: both sides scanned once */
	let amounts: Map<string, FolderAmounts> | null = null;

	const t = $derived(m.scopeSetup);
	/** Device mode: sizes come from the connected devices – the tree loads again when one comes online */
	const online = $derived(p2pStatus.view.devices.filter((d) => !d.self && d.online).length);
	const titleId = $props.id();
	const self = $derived(p2pStatus.view.self?.id ?? '');

	$effect(() => {
		void prepare();
	});

	async function prepare() {
		try {
			const estimate = await storageEstimate().catch(() => null);
			free = estimate?.quota !== undefined ? estimate.quota - (estimate.usage ?? 0) : null;
			if (mode === 'folder') {
				const handle = await syncedFolder();
				if (!handle || (await handle.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
					error = t.unreadable;
					return;
				}
				amounts = folderAmounts(await opfsTree.scan(), await handleTree(handle).scan());
				excluded = await folderScope();
			} else {
				excluded = [...p2pStatus.view.scope];
			}
			ready = true;
		} catch (e) {
			console.error(e);
			error = e instanceof Error ? e.message : String(e);
		}
	}

	const sizesOf = (a: FolderAmounts): Record<string, number> => ({ here: a.here, there: a.there, in: a.in, out: a.out });

	async function load(folder: string): Promise<ScopeFolder[]> {
		if (mode === 'folder') {
			const all = amounts!;
			return subfolders(all, folder).map((path) => ({ path, name: path.split('/').at(-1) ?? path, sizes: sizesOf(all.get(path)!) }));
		}
		// Device: sizes per device; what only the others have comes here, what only this one has goes to them
		const perDevice = await folderSizes(folder);
		const paths = new Set(Object.values(perDevice).flatMap((sizes) => Object.keys(sizes)));
		return [...paths]
			.filter((path) => !path.split('/').some((name) => name.startsWith('.')))
			.map((path) => {
				const here = perDevice[self]?.[path] ?? 0;
				const there = Math.max(0, ...Object.entries(perDevice).filter(([id]) => id !== self).map(([, sizes]) => sizes[path] ?? 0));
				return { path, name: path.split('/').at(-1) ?? path, sizes: { here, there, in: here ? 0 : there, out: there ? 0 : here } };
			});
	}

	function onroot(folders: ScopeFolder[]) {
		top = folders;
		if (!setup || preselected || !folders.length) return;
		preselected = true;
		for (const path of preselectExcluded(folders.map((f) => ({ path: f.path, in: f.sizes.in })), limit, free)) excluded = exclude(excluded, path);
	}

	/** A folder only this device has can't be left out in a device setup: leaving it out would delete it here */
	const locked = (f: ScopeFolder) => mode === 'device' && f.sizes.there === 0 && f.sizes.here > 0;

	function toggle(f: ScopeFolder, on: boolean) {
		excluded = on ? include(excluded, f.path) : exclude(excluded, f.path);
	}

	const size = (bytes: number) => formatSize(bytes, intlLocale);

	function detail(f: ScopeFolder): string {
		const { here, there, in: incoming, out } = f.sizes;
		if (incoming && !here) return t.incoming(size(incoming));
		if (out && !there) return mode === 'device' ? t.toDevices(size(out)) : t.outgoing(size(out));
		const parts = [];
		if (incoming) parts.push(t.incoming(size(incoming)));
		if (out) parts.push(t.outgoing(size(out)));
		return parts.length ? parts.join(' · ') : here || there ? t.both(size(Math.max(here, there))) : '';
	}

	function mark(f: ScopeFolder): string | null {
		if (!setup || !f.sizes.in) return null;
		if (free !== null && f.sizes.in > free) return t.full;
		if (limit !== null && f.sizes.in >= limit) return t.large;
		return null;
	}

	const totals = $derived(
		top
			.filter((f) => inScope(f.path, excluded))
			.reduce((sum, f) => ({ in: sum.in + f.sizes.in, out: sum.out + f.sizes.out }), { in: 0, out: 0 })
	);

	async function confirm() {
		saving = true;
		try {
			// A plain array: it is stored (IndexedDB can't clone the state's proxy)
			const scope = $state.snapshot(excluded);
			if (mode === 'folder') await setFolderScope(scope);
			else await finishSetup(scope);
			onclose();
		} catch (e) {
			console.error(e);
			toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
		} finally {
			saving = false;
		}
	}
</script>

<Modal {onclose} busy={saving} labelledby={titleId} class="max-sm:modal-bottom">
	<div class="modal-box flex max-w-2xl flex-col gap-3 max-sm:h-full max-sm:max-h-none max-sm:rounded-none">
		<h3 id={titleId} class="text-lg font-bold">{mode === 'folder' ? t.titleFolder(syncStatus.folder ?? '') : t.titleDevice}</h3>
		<p class="text-sm opacity-80">{setup ? t.hintSetup : ''} {mode === 'folder' ? t.hintFolder : t.hintDevice}</p>
		{#if error}
			<p role="alert" class="text-error text-sm">{error}</p>
		{:else if !ready}
			<span class="loading loading-spinner loading-sm"></span>
		{:else}
			<p class="text-xs font-medium">
				{t.comesHere(size(totals.in))} · {t.goesThere(size(totals.out))}{#if free !== null}&nbsp;· {t.free(size(free))}{/if}
			</p>
			{#if mode === 'device' && !online}
				<p class="flex items-center gap-2 text-sm opacity-80">
					<span class="loading loading-spinner loading-sm"></span>
					{t.waitingForDevices}
				</p>
			{:else}
				{#key online}
					<ScopeTree {load} isOn={(path) => inScope(path, excluded)} {locked} ontoggle={toggle} {detail} {mark} empty={m.scope.empty} {onroot} />
				{/key}
			{/if}
			<p class="text-xs opacity-60">{m.scope.always}: <code>.apps</code></p>
		{/if}
		<div class="modal-action">
			<button class="btn" onclick={onclose} disabled={saving}>{setup ? t.later : t.cancel}</button>
			<button class="btn btn-primary" onclick={confirm} disabled={!ready || saving}>{setup ? t.start : t.apply}</button>
		</div>
	</div>
</Modal>
