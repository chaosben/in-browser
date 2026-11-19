<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar, startRename } from '@in-browser/brand/brand-bar.svelte.js';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { openContextMenu, openMenuBelow, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { storageEstimate } from '@in-browser/files/cache.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { FilesError, stat, supported, watch } from '@in-browser/files/fs.js';
	import { filesErrorText, filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, isConnected, isInside, join, normalize, parent, placeRoot, segments } from '@in-browser/files/path.js';
	import {
		allowAccess,
		connectFolder,
		connectionLabel,
		connections,
		openShare,
		connectionsSupported,
		disconnect,
		renameConnection,
		type ConnectionView
	} from '@in-browser/files/sources/connections.svelte.js';
	import { displayName } from '@in-browser/files/sources/registry.js';
	import { parseInviteCode, parseShareCode } from '@in-browser/files/p2p/auth.js';
	import { endShare, holdersOf, includeFolder, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import type { ShareView } from '@in-browser/files/p2p/device.js';
	import { canExclude, inScope } from '@in-browser/files/p2p/scope.js';
	import {
		duplicate,
		newFolder,
		newTextFile,
		paste,
		removeItems,
		rename,
		toClipboard,
		toolUrl,
		transfer
	} from '#lib/actions.js';
	import { BRAND } from '#lib/brand.js';
	import ConnectedSection from '#lib/components/ConnectedSection.svelte';
	import SharesSection from '#lib/components/SharesSection.svelte';
	import ShareDialog from '#lib/components/ShareDialog.svelte';
	import FileList from '#lib/components/FileList.svelte';
	import FolderTree from '#lib/components/FolderTree.svelte';
	import PreviewDialog from '#lib/components/PreviewDialog.svelte';
	import PropertiesDialog from '#lib/components/PropertiesDialog.svelte';
	import SyncDialog from '#lib/components/SyncDialog.svelte';
	import SyncEntry from '#lib/components/SyncEntry.svelte';
	import TrashDialog from '#lib/components/TrashDialog.svelte';
	import TrashEntry from '#lib/components/TrashEntry.svelte';
	import ExcludeFolderDialog from '#lib/components/ExcludeFolderDialog.svelte';
	import ExplainDialog from '#lib/components/ExplainDialog.svelte';
	import FolderScopeDialog from '#lib/components/FolderScopeDialog.svelte';
	import JoinDialog from '#lib/components/JoinDialog.svelte';
	import PairDialog from '#lib/components/PairDialog.svelte';
	import SetupDialog from '#lib/components/SetupDialog.svelte';
	import { closeDevicesDialog, devicesUi, openDevicesDialog } from '#lib/devices.svelte.js';
	import { acceptsDrag, DRAG_TYPE } from '#lib/dnd.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { toItem, type Item } from '#lib/items.js';
	import { clipboard, Manager, treeVersion } from '#lib/manager.svelte.js';
	import { download, fromDrop, fromInput, upload, zipName, type Upload } from '#lib/transfer.js';

	const manager = new Manager();
	const t = $derived(filesMessages());

	let preview = $state<Item | null>(null);
	/** Folder being shared with a guest (dialog) */
	let sharing = $state<{ path: string; id?: string } | null>(null);
	/** A folder of My files on this device can be shared with a guest (an excluded one isn't here) */
	const shareable = (path: string) => p2pStatus.supported && path !== '/' && !isConnected(path) && inScope(path, p2pStatus.view.scope);
	let properties = $state<Item | null>(null);
	let uploading = $state<string | null>(null);
	let dropping = $state(false);
	let usage = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let folderInput = $state<HTMLInputElement>();
	/** Small screens: the search is a button until it is opened (or has a query) */
	let searchOpen = $state(false);

	/** Uploading whole folders needs `webkitdirectory` (missing on iOS) */
	const folderUpload = 'webkitdirectory' in HTMLInputElement.prototype;
	const uploadEntries = (locked = false): MenuEntry[] => [
		{ label: m.toolbar.uploadFiles, icon: 'icon-[material-symbols-light--upload-file]', disabled: locked, run: () => fileInput?.click() },
		...(folderUpload
			? [{ label: m.toolbar.uploadFolder, icon: 'icon-[material-symbols-light--drive-folder-upload-outline]', disabled: locked, run: () => folderInput?.click() }]
			: [])
	];

	/** The open folder lies in a folder this device doesn't sync: it comes live from the other devices */
	const remoteFolder = $derived(
		p2pStatus.view.state === 'online' ? (p2pStatus.view.scope.find((folder) => isInside(manager.folder, folder)) ?? null) : null
	);
	/** Devices that have it (when none answers) */
	let holders = $state<string[]>([]);
	$effect(() => {
		const folder = remoteFolder;
		if (!folder || !manager.error) return;
		holdersOf(folder).then(
			(names) => (holders = names),
			() => (holders = [])
		);
	});

	/** My files (`/`) or the root of the connected folder the open folder lies in */
	const root = $derived(placeRoot(manager.folder));
	const connection = $derived(connections.list.find((c) => c.path === root) ?? null);
	/** A guest share for viewing: nothing can be added, changed or deleted here */
	const readOnlyPlace = $derived(connection?.mode === 'view');

	/** `path` lies in a guest share for viewing */
	function readOnlyAt(path: string): boolean {
		const place = placeRoot(path);
		return connections.list.find((c) => c.path === place)?.mode === 'view';
	}

	/** Shortcuts and drops into such a place: says why nothing happens */
	function refusedAt(path: string): boolean {
		if (!readOnlyAt(path)) return false;
		toast(filesErrorText(new FilesError('readOnly', path)), 'error');
		return true;
	}
	/** Levels from the first folder; in a connected folder starting with the connection */
	const crumbs = $derived([
		...(root === '/' ? [] : [{ name: connection ? connectionLabel(connection) : displayName(root), path: root }]),
		...segments(manager.folder)
			.slice(segments(root).length)
			.map((name, i, all) => ({ name, path: join(root, ...all.slice(0, i + 1)) }))
	]);

	/** The open folder as an entry (for its menu: download, properties) */
	const current = $derived(toItem({ name: crumbs.at(-1)?.name ?? t.root, path: manager.folder, kind: 'directory' }));

	// Folder path with all actions of the open folder on the left of the BrandBar, upload and new folder right after it;
	// search and view on the right
	// Count, selection, upload and storage on the left of the BrandFooter
	$effect(() => setBrandFooter({ status: footerStatus }));

	$effect(() => {
		const folder = current;
		const canPaste = !!clipboard.current;
		const locked = readOnlyPlace;
		const menu: MenuEntry[] = [
			{ label: m.toolbar.newFolder, icon: 'icon-[material-symbols-light--create-new-folder-outline]', disabled: locked, run: () => newFolder(manager) },
			{ label: m.toolbar.newTextFile, icon: 'icon-[material-symbols-light--note-add-outline]', disabled: locked, run: () => newTextFile(manager) },
			...uploadEntries(locked),
			{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', disabled: locked || !canPaste, run: () => paste(manager) },
			{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', run: () => manager.selectAll() },
			{ separator: true },
			// The view switch on the right is hidden on small screens
			manager.view === 'list'
				? { label: m.toolbar.grid, icon: 'icon-[material-symbols-light--grid-view-outline]', run: () => manager.setView('grid') }
				: { label: m.toolbar.list, icon: 'icon-[material-symbols-light--view-list-outline]', run: () => manager.setView('list') },
			{ separator: true },
			{ label: m.menu.downloadZip, icon: 'icon-[material-symbols-light--folder-zip-outline]', run: () => downloadItems([folder]) },
			{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', run: () => (properties = folder) },
			...(shareable(folder.path) ? [{ label: m.share.action, icon: 'icon-[material-symbols-light--share-outline]', run: () => (sharing = { path: folder.path }) }] : []),
			...(connection && folder.path === connection.path ? [{ separator: true } as MenuEntry, ...connectionEntries(connection)] : []),
			{ separator: true },
			// Also in the sidebar, which is hidden on small screens
			{ label: m.trash.title, icon: 'icon-[material-symbols-light--delete-outline]', run: () => openDevicesDialog('trash') },
			...connections.list.map((c) => ({ label: connectionLabel(c), icon: 'icon-[material-symbols-light--link]', run: () => navigate(c.path) })),
			...(connectionsSupported() ? [{ label: m.connected.connect, icon: 'icon-[material-symbols-light--add-link]', run: connect }] : []),
			...(p2pStatus.supported
				? [
						{ separator: true } as MenuEntry,
						...p2pStatus.view.shares.map((share) => ({
							label: `${basename(share.folder)} – ${m.share.shared}`,
							icon: 'icon-[material-symbols-light--share-outline]',
							run: () => (sharing = { path: share.folder, id: share.id })
						})),
						{ label: m.share.new, icon: 'icon-[material-symbols-light--share-outline]', run: shareNew }
					]
				: [])
		];
		// The tool name stands for the top level: the levels start with the first folder, the menu of the top level
		// hangs at the tool name
		return setBrandBar({
			crumbs: crumbs.map((level, i) =>
				i < crumbs.length - 1
					? { label: level.name, onclick: () => navigate(level.path) }
					: {
							label: level.name,
							menu,
							// The name of a connection is only how it is shown here
							rename:
																connection?.kind === 'folder' && level.path === connection.path ? (name: string) => void renameConnection(connection.id, name) : undefined
						}
			),
			menu,
			primary: barPrimary,
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

	// Links with a key in the fragment (kept out of requests): a guest share (`#share=KEY`, this tab only) and pairing
	// (`#pair=KEY`). Also when only the fragment changes in an open Files tab (no new page load).
	$effect(() => {
		const hash = page.url.hash;
		untrack(() => openFromLink(hash));
	});

	function openFromLink(hash: string) {
		const shared = parseShareCode(hash);
		const code = parseInviteCode(hash);
		if (!shared && !code) return;
		// The key leaves the address first (through SvelteKit's router)
		const url = new URL(location.href);
		url.hash = '';
		const cleared = goto(url, { state: page.state, shallow: true, replace: true });
		if (shared) void cleared.then(() => openShare(shared)).then(navigate);
		if (code) {
			devicesUi.joinCode = code;
			openDevicesDialog('join');
		}
	}

	// Changes from anywhere (this tab, other tools, the sync): reload what is affected
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	onMount(() => {
		updateUsage();
		// “Manage devices” from the footer of any tool
		if (page.url.searchParams.get('panel') === 'sync') {
			const url = new URL(location.href);
			url.searchParams.delete('panel');
			void goto(url, { state: page.state, shallow: true, replace: true });
			openDevicesDialog('sync');
		}
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

	async function connect() {
		try {
			const result = await connectFolder();
			if (!result) return;
			if (result.alsoSynced) toast(m.connected.alsoSynced(connections.list.find((c) => c.path === result.path)?.name ?? ''), 'info', 8000);
			navigate(result.path);
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	/** Actions of a folder this device shares with a guest */
	/** “Share a folder …”: pick one of My files, then the share dialog */
	async function shareNew() {
		const start = shareable(manager.folder) ? manager.folder : '/';
		const folder = await chooseFile({ mode: 'folder', folder: start, accept: [], places: false, title: m.share.chooseTitle, confirmLabel: m.share.chooseConfirm });
		if (!folder) return;
		if (!shareable(folder)) {
			toast(folder === '/' ? m.share.notRoot : m.share.notShareable, 'info', 8000);
			return;
		}
		sharing = { path: folder };
	}

	function shareEntries(share: ShareView): MenuEntry[] {
		return [
			{ label: m.share.show, icon: 'icon-[material-symbols-light--qr-code]', run: () => (sharing = { path: share.folder, id: share.id }) },
			{
				label: m.share.end,
				icon: 'icon-[material-symbols-light--link-off]',
				run: async () => {
					const ok = await ask({ title: m.share.endTitle, message: m.share.endMessage(basename(share.folder)), confirm: m.share.end, danger: true });
					if (ok) await endShare(share.id);
				}
			}
		];
	}

	/** Menu of a folder in the tree: the same actions as in the list, for exactly this folder */
	async function treeMenu(e: MouseEvent, path: string) {
		const listed = manager.visible.find((i) => i.path === path);
		const entry = listed ? null : await stat(path).catch(() => null);
		const item = listed ?? (entry && toItem(entry));
		if (!item) return;
		openContextMenu(
			e,
			itemEntries([item], (it) => {
				// Renamed in the list of the folder it is in
				if (manager.folder !== parent(it.path)) navigate(parent(it.path));
				setTimeout(() => (manager.renaming = it.path), 150);
			})
		);
	}

	async function disconnectShare() {
		await disconnect('share');
		navigate('/');
	}

	// A guest share that ends while it is open: say it once
	let endedShown = false;
	$effect(() => {
		if (connection?.kind !== 'share' || !connection.ended) {
			endedShown = false;
			return;
		}
		if (endedShown) return;
		endedShown = true;
		toast(m.share.ended, 'info', 8000);
	});

	// A guest share that can't be opened right now (device away, another guest in it): try again by itself
	$effect(() => {
		if (connection?.kind !== 'share' || (manager.errorCode !== 'offline' && manager.errorCode !== 'taken')) return;
		const timer = setTimeout(() => untrack(() => manager.refresh()), 20_000);
		return () => clearTimeout(timer);
	});

	/** Actions of a connection: allow access again, rename, disconnect */
	function connectionEntries(c: ConnectionView): MenuEntry[] {
		return [
			...(c.access === 'granted'
				? []
				: [{ label: m.connected.allow, icon: 'icon-[material-symbols-light--key-outline]', run: () => void allowAccess(c.id) }]),
			// A guest share keeps the name its device gives it
			...(c.kind === 'share'
				? []
				: [
						{
							label: m.connected.rename,
							icon: 'icon-[material-symbols-light--edit-outline]',
							run: () => {
								if (manager.folder !== c.path) navigate(c.path);
								// Renamed inline in the BrandBar once the connection is the open level
								setTimeout(startRename, 50);
							}
						}
					]),
			{ label: m.connected.disconnect, icon: 'icon-[material-symbols-light--link-off]', run: () => void disconnectConnection(c) }
		];
	}

	async function disconnectConnection(c: ConnectionView) {
		const ok = await ask({ title: m.connected.disconnectTitle, message: m.connected.disconnectMessage(c.name), confirm: m.connected.disconnect });
		if (!ok) return;
		await disconnect(c.id);
		if (isInside(manager.folder, c.path)) navigate('/');
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

	/** “Move to …”: pick the target folder in the file dialog (touch has no dragging) */
	async function moveTo(items: Item[]) {
		const folder = await chooseFile({ mode: 'folder', folder: manager.folder, accept: [], title: m.menu.moveTo, confirmLabel: m.menu.moveHere });
		if (!folder) return;
		const done = await transfer(
			items.map((i) => i.path),
			folder,
			'move'
		);
		if (done) toast(m.toasts.moved(done), 'success');
		await manager.refresh();
	}

	async function dropItems(paths: string[], folder: string, copy: boolean) {
		if (refusedAt(folder)) return;
		// Between My files and a connected folder dragging copies, as between drives
		const across = paths.some((path) => placeRoot(path) !== placeRoot(folder));
		await transfer(paths, folder, copy || across ? 'copy' : 'move');
		manager.refresh();
	}

	async function commitRename(item: Item, name: string) {
		// Enter and leaving the field both end here – only the first counts
		if (manager.renaming !== item.path) return;
		manager.renaming = null;
		if (!(await rename(manager, item.path, name))) manager.renaming = item.path;
	}

	/**
	 * Actions for entries (the selection in the list, or one folder in the tree); `rename` starts renaming one where it
	 * is shown in the list
	 */
	function itemEntries(items: Item[], rename: (item: Item) => void = (item) => (manager.renaming = item.path)): MenuEntry[] {
		const one = items.length === 1 ? items[0] : null;
		// In a guest share for viewing: only opening, looking and copying out
		const locked = items.some((item) => readOnlyAt(item.path));
		return [
					...(one?.folder ? [{ label: m.menu.open, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => open(one) }] : []),
					...(one && !one.folder
						? one.openWith.map((format) => ({
								label: m.menu.openWith(format.toolName),
								icon: 'icon-[material-symbols-light--open-in-new]',
								run: () => location.assign(toolUrl(one, format)!)
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
					...(locked
						? []
						: [
								{ label: m.menu.cut, icon: 'icon-[material-symbols-light--content-cut]', keys: 'Ctrl+X', run: () => toClipboard(items, 'cut') },
								...(one?.folder && clipboard.current
									? [{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', run: () => paste(manager, one.path) }]
									: []),
								{ label: m.menu.duplicate, icon: 'icon-[material-symbols-light--folder-copy-outline]', run: () => duplicate(manager, items) },
								{ label: m.menu.moveTo, icon: 'icon-[material-symbols-light--drive-file-move-outline]', run: () => moveTo(items) },
								{ separator: true } as MenuEntry,
								{ label: m.menu.rename, icon: 'icon-[material-symbols-light--edit-outline]', keys: 'F2', disabled: !one, run: () => one && rename(one) },
								{
									label: m.menu.delete,
									icon: 'icon-[material-symbols-light--delete-outline]',
									keys: 'Del',
									run: async () => {
										await removeItems(manager, items);
										// The open folder was in it (deleted from the tree): show where it was
										const gone = items.find((i) => isInside(manager.folder, i.path));
										if (gone) navigate(parent(gone.path));
									}
								}
							]),
					{ separator: true },
					...(coarsePointer.current
						? [{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', run: () => manager.selectAll() }]
						: []),
					...scopeEntries(one),
					...(one?.folder && shareable(one.path)
						? [{ label: m.share.action, icon: 'icon-[material-symbols-light--share-outline]', run: () => (sharing = { path: one.path }) }]
						: []),
					{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', disabled: !one, run: () => (properties = one) }
				];
	}

	/** Menu of the selection (`item`) or of the free area (`null`); at the pointer, or below a button */
	function menu(e: MouseEvent, item: Item | null, show = openContextMenu) {
		const entries: MenuEntry[] = item
			? itemEntries(manager.selected)
			: [
					{ label: m.toolbar.newFolder, icon: 'icon-[material-symbols-light--create-new-folder-outline]', disabled: readOnlyPlace, run: () => newFolder(manager) },
					{ label: m.toolbar.newTextFile, icon: 'icon-[material-symbols-light--note-add-outline]', disabled: readOnlyPlace, run: () => newTextFile(manager) },
					...uploadEntries(readOnlyPlace),
					{ separator: true },
					{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', keys: 'Ctrl+V', disabled: readOnlyPlace || !clipboard.current, run: () => paste(manager) },
					{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', keys: 'Ctrl+A', run: () => manager.selectAll() },
					{ label: m.toolbar.refresh, icon: 'icon-[material-symbols-light--refresh]', run: () => manager.refresh() }
				];
		show(e, entries);
	}

	/** Folders can be left out of the sync with the other devices on this device (or taken in again) */
	function scopeEntries(item: Item | null | undefined): MenuEntry[] {
		if (!item?.folder || isConnected(item.path) || p2pStatus.view.state !== 'online' || !canExclude(item.path)) return [];
		if (inScope(item.path, p2pStatus.view.scope)) {
			return [{ label: m.scope.exclude, icon: 'icon-[material-symbols-light--sync-disabled]', run: () => (devicesUi.exclude = item.path) }];
		}
		const parentExcluded = !inScope(parent(item.path), p2pStatus.view.scope) && parent(item.path) !== '/';
		return [
			{
				label: m.scope.include,
				icon: 'icon-[material-symbols-light--sync]',
				disabled: parentExcluded,
				run: () => includeFolder(item.path).catch((e) => toast(filesErrorText(e), 'error'))
			}
		];
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
		// In a guest share for viewing nothing changes (cutting would delete the originals when pasting)
		const changes = (path: string | undefined) => !!path && !refusedAt(path);
		if (mod && e.key === 'x') return handled(), changes(items[0]?.path) && toClipboard(items, 'cut');
		if (mod && e.key === 'v') return handled(), changes(manager.folder) && paste(manager);
		if (e.key === 'Delete') return handled(), changes(items[0]?.path) && removeItems(manager, items);
		if (e.key === 'F2' && items.length === 1) return handled(), changes(items[0].path) && (manager.renaming = items[0].path);
		if (e.key === 'Enter' && (focused ?? items[0])) return handled(), open((focused ?? items[0])!);
		if (e.key === ' ' && items.length === 1 && items[0].kind === 'file') return handled(), (preview = items[0]);
		if (e.key === 'Escape') return manager.clearSelection();
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
		dropFiles(e.dataTransfer, manager.folder);
	}

	/** Files from the computer dropped on a folder: uploaded there */
	function dropFiles(data: DataTransfer, folder: string) {
		if (refusedAt(folder)) return;
		uploadAll(fromDrop(data), folder);
	}
</script>

{#snippet footerStatus()}
	<span class="flex min-w-0 items-center gap-3 px-1 opacity-70">
		<span>{m.list.items(manager.visible.length)}</span>
		{#if manager.selected.length}<span>{m.list.selected(manager.selected.length)}</span>{/if}
		{#if uploading}
			<span class="flex items-center gap-1"><span class="loading loading-spinner loading-xs"></span>{m.toasts.uploading(uploading)}</span>
		{/if}
		{#if connection}
			<span class="hidden items-center gap-1 lg:flex">
				<span class="icon-[material-symbols-light--link] size-4" aria-hidden="true"></span>{connection.kind === 'share'
					? m.connected.liveShared(connection.host ?? '')
					: m.connected.live(connection.name)}
			</span>
		{:else if remoteFolder}
			<span class="hidden items-center gap-1 lg:flex">
				<span class="icon-[material-symbols-light--cloud-outline] size-4" aria-hidden="true"></span>{m.remote.live}
			</span>
		{:else if usage}<span class="hidden lg:inline">{usage}</span>{/if}
		<span class="hidden truncate 2xl:inline">{m.list.hint}</span>
	</span>
{/snippet}

{#snippet barActions()}
	{#if coarsePointer.current && manager.selecting && manager.selected.length}
		<!-- Touch selection mode: its actions and the way out instead of search and view -->
		<button
			class="btn btn-ghost btn-sm btn-square"
			onclick={(e) => menu(e, manager.selected[0], openMenuBelow)}
			title={m.menu.selection}
			aria-label={m.menu.selection}
		>
			<span class="icon-[material-symbols-light--more-vert] size-5" aria-hidden="true"></span>
		</button>
		<button class="btn btn-ghost btn-sm btn-square" onclick={() => manager.clearSelection()} title={m.menu.clearSelection} aria-label={m.menu.clearSelection}>
			<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
		</button>
	{:else}
		{@render search()}
	{/if}
{/snippet}

{#snippet search()}
	<button class="btn btn-ghost btn-sm btn-square md:hidden" onclick={() => openDevicesDialog('sync')} title={m.syncHub.open} aria-label={m.syncHub.open}>
		<span class="icon-[material-symbols-light--sync] size-5" aria-hidden="true"></span>
	</button>
	{#if !searchOpen && !manager.query}
		<button class="btn btn-ghost btn-sm btn-square sm:hidden" onclick={() => (searchOpen = true)} title={m.toolbar.search} aria-label={m.toolbar.search}>
			<span class="icon-[material-symbols-light--search] size-5" aria-hidden="true"></span>
		</button>
	{/if}
	<div class={searchOpen || manager.query ? 'contents' : 'hidden sm:contents'}>
		<label class="input input-sm w-36 lg:w-48">
			<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
			<input
				type="search"
				bind:value={manager.query}
				placeholder={m.toolbar.search}
				aria-label={m.toolbar.search}
				onblur={() => (searchOpen = false)}
				{@attach (input) => {
					if (searchOpen) input.focus();
				}}
			/>
		</label>
	</div>
	<div class="hidden sm:block">
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
	</div>
{/snippet}

{#snippet barPrimary()}
	<button
		class="btn btn-primary btn-sm"
		disabled={readOnlyPlace}
		onclick={(e) => openMenuBelow(e, uploadEntries())}
	>
		<span class="icon-[material-symbols-light--upload] size-5" aria-hidden="true"></span>
		{m.toolbar.upload}
		<span class="icon-[material-symbols-light--keyboard-arrow-down] size-4" aria-hidden="true"></span>
	</button>
	<button class="btn btn-ghost btn-sm" disabled={readOnlyPlace} onclick={() => newFolder(manager)}>
		<span class="icon-[material-symbols-light--create-new-folder-outline] size-5" aria-hidden="true"></span>
		{m.toolbar.newFolder}
	</button>
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
					onfoldermenu={treeMenu}
					current={manager.folder}
					onnavigate={navigate}
					ondropitems={dropItems}
					ondropfiles={dropFiles}
				/>
			</ul>
			<ConnectedSection
				current={manager.folder}
				onnavigate={navigate}
				ondropitems={dropItems}
				ondropfiles={dropFiles}
				onmenu={(e, c) => openContextMenu(e, connectionEntries(c))}
				onfoldermenu={treeMenu}
			/>
			<SharesSection
				onshare={(share) => (sharing = { path: share.folder, id: share.id })}
				onsharemenu={(e, share) => openContextMenu(e, shareEntries(share))}
				onnew={shareNew}
			/>
			<div class="mt-auto flex flex-col gap-2">
				<TrashEntry />
				<SyncEntry />
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
				onclick={() => manager.clearSelection()}
				oncontextmenu={(e) => menu(e, null)}
				ondragover={areaDragOver}
				ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropping = false)}
				ondrop={areaDrop}
			>
				{#if connection?.ended}
					<div class="flex flex-col items-start gap-2 p-6">
						<p class="flex items-center gap-2">
							<span class="icon-[material-symbols-light--link-off] size-6 shrink-0" aria-hidden="true"></span>
							{m.share.ended}
						</p>
						<p class="text-sm opacity-70">{m.share.endedHint}</p>
						<button class="btn btn-sm" onclick={() => disconnectShare()}>{m.share.remove}</button>
					</div>
				{:else if connection && connection.access !== 'granted'}
					<div class="flex flex-col items-start gap-2 p-6">
						<p>{m.connected.noAccess(connection.name)}</p>
						<button class="btn btn-sm btn-primary" onclick={() => allowAccess(connection.id)}>{m.connected.allow}</button>
						<p class="text-xs opacity-60">{m.connected.allowHint}</p>
					</div>
				{:else if manager.items === null}
					<p class="p-6 text-sm opacity-60">{m.list.loading}</p>
				{:else if manager.error && remoteFolder}
					<div class="flex flex-col items-start gap-2 p-6">
						<p class="flex items-center gap-2">
							<span class="icon-[material-symbols-light--cloud-off-outline] size-6 shrink-0" aria-hidden="true"></span>
							{m.remote.unreachable(basename(remoteFolder), holders)}
						</p>
						<a class="link text-sm" href={resolve('/help/sync')} target="_blank" rel="noopener">{m.remote.help}</a>
					</div>
				{:else if manager.error && connection?.kind === 'share' && (manager.errorCode === 'offline' || manager.errorCode === 'taken')}
					<p class="flex items-center gap-2 p-6">
						<span class="icon-[material-symbols-light--cloud-off-outline] size-6 shrink-0" aria-hidden="true"></span>
						{manager.errorCode === 'offline' ? m.share.unreachable : manager.error}
					</p>
				{:else if manager.error}
					<p class="text-error p-6">{manager.error}</p>
				{:else}
					<FileList
						{manager}
						onopen={open}
						onmenu={menu}
						ondropitems={dropItems}
						ondropfiles={dropFiles}
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
		</main>
	</div>
{/if}

{#if preview}
	<PreviewDialog item={preview} ondownload={(item) => downloadItems([item])} onclose={() => (preview = null)} />
{/if}
{#if sharing}
	<ShareDialog path={sharing.path} id={sharing.id} onclose={() => (sharing = null)} />
{/if}
{#if properties}
	<PropertiesDialog item={properties} onclose={() => (properties = null)} />
{/if}
{#if devicesUi.dialog === 'sync'}
	<SyncDialog onclose={closeDevicesDialog} />
{:else if devicesUi.dialog === 'explain'}
	<ExplainDialog onclose={closeDevicesDialog} />
{:else if devicesUi.dialog === 'setup'}
	<SetupDialog onclose={closeDevicesDialog} />
{:else if devicesUi.dialog === 'pair'}
	<PairDialog onclose={closeDevicesDialog} />
{:else if devicesUi.dialog === 'join'}
	<JoinDialog code={devicesUi.joinCode} onclose={() => ((devicesUi.joinCode = ''), closeDevicesDialog())} />
{:else if devicesUi.dialog === 'scope'}
	<FolderScopeDialog onclose={closeDevicesDialog} />
{:else if devicesUi.dialog === 'trash'}
	<TrashDialog onclose={closeDevicesDialog} />
{/if}
{#if devicesUi.exclude}
	<ExcludeFolderDialog path={devicesUi.exclude} onclose={() => (devicesUi.exclude = null)} />
{/if}
