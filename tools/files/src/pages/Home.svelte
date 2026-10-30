<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import CommitLink from '@in-browser/brand/CommitLink.svelte';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { storageEstimate } from '@in-browser/files/cache.js';
	import { supported, watch } from '@in-browser/files/fs.js';
	import { filesErrorText, filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { isInside, normalize, parent, segments } from '@in-browser/files/path.js';
	import {
		duplicate,
		newFolder,
		paste,
		removeItems,
		rename,
		toClipboard,
		toolUrl,
		transfer
	} from '#lib/actions.js';
	import { BRAND } from '#lib/brand.js';
	import FileList from '#lib/components/FileList.svelte';
	import FolderTree from '#lib/components/FolderTree.svelte';
	import PreviewDialog from '#lib/components/PreviewDialog.svelte';
	import PropertiesDialog from '#lib/components/PropertiesDialog.svelte';
	import SyncPanel from '#lib/components/SyncPanel.svelte';
	import { acceptsDrag, DRAG_TYPE } from '#lib/dnd.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { toItem, type Item } from '#lib/items.js';
	import { clipboard, Manager, treeVersion } from '#lib/manager.svelte.js';
	import { download, fromDrop, fromInput, upload, zipName, type Upload } from '#lib/transfer.js';

	const manager = new Manager();
	const t = $derived(filesMessages());

	let preview = $state<Item | null>(null);
	let properties = $state<Item | null>(null);
	let uploading = $state<string | null>(null);
	let dropping = $state(false);
	let usage = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let folderInput = $state<HTMLInputElement>();

	const crumbs = $derived(segments(manager.folder).map((name, i, all) => ({ name, path: '/' + all.slice(0, i + 1).join('/') })));

	/** The open folder as an entry (for its menu: download, properties) */
	const current = $derived(toItem({ name: crumbs.at(-1)?.name ?? t.root, path: manager.folder, kind: 'directory' }));

	// Folder path with the actions of the open folder on the left of the BrandBar; search, view, upload on the right
	$effect(() => {
		const folder = current;
		const canPaste = !!clipboard.current;
		const menu: MenuEntry[] = [
			{ label: m.toolbar.newFolder, icon: 'icon-[material-symbols-light--create-new-folder-outline]', run: () => newFolder(manager) },
			{ label: m.toolbar.uploadFiles, icon: 'icon-[material-symbols-light--upload-file]', run: () => fileInput?.click() },
			{ label: m.toolbar.uploadFolder, icon: 'icon-[material-symbols-light--drive-folder-upload-outline]', run: () => folderInput?.click() },
			{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', disabled: !canPaste, run: () => paste(manager) },
			{ separator: true },
			{ label: m.menu.downloadZip, icon: 'icon-[material-symbols-light--folder-zip-outline]', run: () => downloadItems([folder]) },
			{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', run: () => (properties = folder) }
		];
		// The tool name stands for the top level: the levels start with the first folder, the menu of the top level
		// hangs at the tool name
		return setBrandBar({
			crumbs: crumbs.map((level, i) =>
				i < crumbs.length - 1 ? { label: level.name, onclick: () => navigate(level.path) } : { label: level.name, menu }
			),
			menu,
			actions: barActions
		});
	});

	/** The folder is part of the address (`/files?path=…`): back/forward and links work */
	function navigate(path: string) {
		const base = resolve('/files');
		goto(path === '/' ? base : `${base}?path=${encodeURIComponent(path)}`, { reset: false });
	}

	$effect(() => {
		const path = normalize(page.url.searchParams.get('path') ?? '/');
		untrack(() => manager.load(path));
	});

	async function updateUsage() {
		const { usage: used = 0, quota = 0 } = await storageEstimate();
		usage = m.storage.used(formatSize(used, intlLocale), formatSize(quota, intlLocale));
	}

	// Changes from anywhere (this tab, other tools, the sync): reload what is affected
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	onMount(() => {
		updateUsage();
		const stop = watch((paths) => {
			treeVersion.current++;
			const folder = manager.folder;
			if (paths.some((p) => parent(p) === folder || isInside(folder, p))) {
				clearTimeout(refreshTimer);
				refreshTimer = setTimeout(() => {
					manager.refresh();
					updateUsage();
				}, 150);
			}
		});
		return () => {
			stop();
			clearTimeout(refreshTimer);
		};
	});

	function open(item: Item) {
		if (item.folder) return navigate(item.path);
		const url = toolUrl(item);
		if (url) location.assign(url);
		else preview = item;
	}

	async function downloadItems(items: Item[]) {
		if (items.length === 0) return;
		const paths = items.map((i) => i.path);
		try {
			if (items.length > 1 || items[0].kind === 'directory') toast(m.toasts.zipping);
			await download(paths, zipName(paths, manager.folder, t.root));
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	async function uploadAll(uploads: Upload[] | Promise<Upload[]>, folder: string) {
		try {
			const count = await upload(await uploads, folder, (name) => (uploading = name));
			if (count) toast(m.toasts.uploaded(count), 'success');
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			uploading = null;
			manager.refresh();
		}
	}

	async function dropItems(paths: string[], folder: string, copy: boolean) {
		await transfer(paths, folder, copy ? 'copy' : 'move');
		manager.refresh();
	}

	async function commitRename(item: Item, name: string) {
		// Enter and leaving the field both end here – only the first counts
		if (manager.renaming !== item.path) return;
		manager.renaming = null;
		if (!(await rename(manager, item.path, name))) manager.renaming = item.path;
	}

	function menu(e: MouseEvent, item: Item | null) {
		const items = manager.selected;
		const one = items.length === 1 ? items[0] : null;
		const entries: MenuEntry[] = item
			? [
					...(one?.folder ? [{ label: m.menu.open, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => open(one) }] : []),
					...(one && !one.folder
						? one.formats.map((format, i) => ({
								label: m.menu.openWith(format.toolName),
								icon: 'icon-[material-symbols-light--open-in-new]',
								run: () => location.assign(toolUrl(one, i)!)
							}))
						: []),
					...(one && one.kind === 'file'
						? [{ label: m.menu.preview, icon: 'icon-[material-symbols-light--visibility-outline]', keys: 'Space', run: () => (preview = one) }]
						: []),
					{
						label: one?.kind === 'file' ? m.menu.download : m.menu.downloadZip,
						icon: one?.kind === 'file' ? 'icon-[material-symbols-light--download]' : 'icon-[material-symbols-light--folder-zip-outline]',
						run: () => downloadItems(items)
					},
					{ separator: true },
					{ label: m.menu.copy, icon: 'icon-[material-symbols-light--content-copy]', keys: 'Ctrl+C', run: () => toClipboard(items, 'copy') },
					{ label: m.menu.cut, icon: 'icon-[material-symbols-light--content-cut]', keys: 'Ctrl+X', run: () => toClipboard(items, 'cut') },
					...(one?.folder && clipboard.current
						? [{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', run: () => paste(manager, one.path) }]
						: []),
					{ label: m.menu.duplicate, icon: 'icon-[material-symbols-light--folder-copy-outline]', run: () => duplicate(manager, items) },
					{ separator: true },
					{ label: m.menu.rename, icon: 'icon-[material-symbols-light--edit-outline]', keys: 'F2', disabled: !one, run: () => one && (manager.renaming = one.path) },
					{ label: m.menu.delete, icon: 'icon-[material-symbols-light--delete-outline]', keys: 'Del', run: () => removeItems(manager, items) },
					{ separator: true },
					{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', disabled: !one, run: () => (properties = one) }
				]
			: [
					{ label: m.toolbar.newFolder, icon: 'icon-[material-symbols-light--create-new-folder-outline]', run: () => newFolder(manager) },
					{ label: m.toolbar.uploadFiles, icon: 'icon-[material-symbols-light--upload-file]', run: () => fileInput?.click() },
					{ label: m.toolbar.uploadFolder, icon: 'icon-[material-symbols-light--drive-folder-upload-outline]', run: () => folderInput?.click() },
					{ separator: true },
					{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', keys: 'Ctrl+V', disabled: !clipboard.current, run: () => paste(manager) },
					{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', keys: 'Ctrl+A', run: () => manager.selectAll() },
					{ label: m.toolbar.refresh, icon: 'icon-[material-symbols-light--refresh]', run: () => manager.refresh() }
				];
		openContextMenu(e, entries);
	}

	function onKey(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
		const mod = e.ctrlKey || e.metaKey;
		const items = manager.selected;
		const focused = manager.visible.find((i) => i.path === manager.focus);
		const handled = () => e.preventDefault();
		if (mod && e.key === 'a') return handled(), manager.selectAll();
		if (mod && e.key === 'c') return handled(), toClipboard(items, 'copy');
		if (mod && e.key === 'x') return handled(), toClipboard(items, 'cut');
		if (mod && e.key === 'v') return handled(), paste(manager);
		if (e.key === 'Delete') return handled(), removeItems(manager, items);
		if (e.key === 'F2' && items.length === 1) return handled(), (manager.renaming = items[0].path);
		if (e.key === 'Enter' && (focused ?? items[0])) return handled(), open((focused ?? items[0])!);
		if (e.key === ' ' && items.length === 1 && items[0].kind === 'file') return handled(), (preview = items[0]);
		if (e.key === 'Escape') return manager.selection.clear();
		if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) return handled(), navigate(parent(manager.folder));
		const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
		if (step && !e.altKey) return handled(), manager.step(step, e.shiftKey);
	}

	function areaDragOver(e: DragEvent) {
		// Own entries over the free area stay where they are; files from the computer get uploaded here
		if (!acceptsDrag(e) || e.dataTransfer?.types.includes(DRAG_TYPE)) return;
		e.preventDefault();
		dropping = true;
	}

	function areaDrop(e: DragEvent) {
		dropping = false;
		if (!e.dataTransfer || e.dataTransfer.types.includes(DRAG_TYPE)) return;
		e.preventDefault();
		uploadAll(fromDrop(e.dataTransfer), manager.folder);
	}
</script>

{#snippet barActions()}
	<label class="input input-sm w-36 lg:w-48">
		<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
		<input type="search" bind:value={manager.query} placeholder={m.toolbar.search} aria-label={m.toolbar.search} />
	</label>
	<div class="join">
		<button
			class={['btn btn-sm join-item', manager.view === 'list' && 'btn-active']}
			onclick={() => manager.setView('list')}
			title={m.toolbar.list}
			aria-label={m.toolbar.list}
		>
			<span class="icon-[material-symbols-light--view-list-outline] size-5" aria-hidden="true"></span>
		</button>
		<button
			class={['btn btn-sm join-item', manager.view === 'grid' && 'btn-active']}
			onclick={() => manager.setView('grid')}
			title={m.toolbar.grid}
			aria-label={m.toolbar.grid}
		>
			<span class="icon-[material-symbols-light--grid-view-outline] size-5" aria-hidden="true"></span>
		</button>
	</div>
	<div class="dropdown dropdown-end">
		<div tabindex="0" role="button" class="btn btn-primary btn-sm">
			<span class="icon-[material-symbols-light--upload] size-5" aria-hidden="true"></span>
			<span class="hidden md:inline">{m.toolbar.upload}</span>
		</div>
		<ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box border-base-300 z-20 w-52 border p-1 shadow">
			<li><button onclick={() => fileInput?.click()}>{m.toolbar.uploadFiles}</button></li>
			<li><button onclick={() => folderInput?.click()}>{m.toolbar.uploadFolder}</button></li>
		</ul>
	</div>
{/snippet}

<svelte:window onkeydown={onKey} />

{#if !supported()}
	<div class="alert alert-error m-6">{m.list.unsupported}</div>
{:else}
	<div class="flex h-full">
		<aside class="border-base-300 bg-base-200 hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3 md:flex">
			<ul role="tree" aria-label={t.root}>
				<FolderTree
					path="/"
					current={manager.folder}
					onnavigate={navigate}
					ondropitems={dropItems}
					ondropfiles={(data, folder) => uploadAll(fromDrop(data), folder)}
				/>
			</ul>
			<div class="mt-auto flex flex-col gap-4">
				<SyncPanel />
				{#if usage}<p class="text-xs opacity-60">{usage}</p>{/if}
				<p class="text-xs opacity-60">
					{m.brand.partOf} <a class="link link-hover" href={resolve('/')} data-sveltekit-reload>{BRAND.suite}</a> –
					{m.brand.suiteClaim}
					<br /><CommitLink />
				</p>
			</div>
		</aside>

		<main class="flex min-w-0 flex-1 flex-col">
			<input bind:this={fileInput} type="file" multiple hidden onchange={(e) => uploadAll(fromInput(e.currentTarget.files!), manager.folder)} />
			<input
				bind:this={folderInput}
				type="file"
				webkitdirectory
				hidden
				onchange={(e) => uploadAll(fromInput(e.currentTarget.files!), manager.folder)}
			/>

			<div
				class="relative min-h-0 flex-1 overflow-auto"
				role="presentation"
				onclick={() => manager.selection.clear()}
				oncontextmenu={(e) => menu(e, null)}
				ondragover={areaDragOver}
				ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropping = false)}
				ondrop={areaDrop}
			>
				{#if manager.items === null}
					<p class="p-6 text-sm opacity-60">{m.list.loading}</p>
				{:else if manager.error}
					<p class="text-error p-6">{manager.error}</p>
				{:else}
					<FileList
						{manager}
						onopen={open}
						onmenu={menu}
						ondropitems={dropItems}
						ondropfiles={(data, folder) => uploadAll(fromDrop(data), folder)}
						onrename={commitRename}
					/>
					{#if manager.visible.length === 0}
						<p class="p-6 text-center text-sm opacity-60">{manager.query ? m.list.noMatch : m.list.empty}</p>
					{/if}
				{/if}
				{#if dropping}
					<div
						class="border-selection bg-base-300/80 rounded-box pointer-events-none absolute inset-2 grid place-items-center border-4 border-dashed"
					>
						<div class="flex flex-col items-center gap-2 text-lg font-semibold">
							<span class="icon-[material-symbols-light--upload-file] size-12" aria-hidden="true"></span>
							{m.list.dropHere(crumbs.at(-1)?.name ?? t.root)}
						</div>
					</div>
				{/if}
			</div>

			<div class="border-base-300 flex items-center gap-3 border-t px-3 py-1 text-xs opacity-70">
				<span>{m.list.items(manager.visible.length)}</span>
				{#if manager.selected.length}<span>{m.list.selected(manager.selected.length)}</span>{/if}
				{#if uploading}
					<span class="flex items-center gap-1"><span class="loading loading-spinner loading-xs"></span>{m.toasts.uploading(uploading)}</span>
				{/if}
				<span class="ml-auto hidden truncate xl:inline">{m.list.hint}</span>
			</div>
		</main>
	</div>
{/if}

{#if preview}
	<PreviewDialog item={preview} ondownload={(item) => downloadItems([item])} onclose={() => (preview = null)} />
{/if}
{#if properties}
	<PropertiesDialog item={properties} onclose={() => (properties = null)} />
{/if}
