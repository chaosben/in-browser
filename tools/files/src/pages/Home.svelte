<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import type { Command } from '@in-browser/brand/commands.js';
	import { panelCommand, type PanelSpec } from '@in-browser/brand/panels.js';
	import PanelRail from '@in-browser/brand/PanelRail.svelte';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { GroupSize, RibbonTab } from '@in-browser/brand/ribbon.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { inTextField } from '@in-browser/brand/ui/typing.js';
	import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import DropOverlay from '@in-browser/brand/DropOverlay.svelte';
	import { storageEstimate, storagePersisted } from '@in-browser/files/cache.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { FilesError, supported, watch, watchSettled } from '@in-browser/files/fs.js';
	import { filesErrorText, filesMessages, formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, isConnected, isInside, join, normalize, parent, placeRoot, segments } from '@in-browser/files/path.js';
	import {
		allowAccess,
		connectionLabel,
		connections,
		connectionEditor,
		connectionsSupported,
		openShare,
		disconnect,
	} from '@in-browser/files/sources/connections.svelte.js';
	import { displayName, listConnections } from '@in-browser/files/sources/registry.js';
	import { parseInviteCode, parseShareCode } from '@in-browser/files/p2p/auth.js';
	import { excludedNow, holdersOf, includeFolder, p2pStatus, syncDevicesNow } from '@in-browser/files/p2p/p2p.svelte.js';
	import { canExclude, inScope } from '@in-browser/files/p2p/scope.js';
	import { syncNow, syncStatus } from '@in-browser/files/sync/sync.svelte.js';
	import { fail, newFolder, newTextFile, paste, removeItems, rename, toClipboard, toolUrl, transfer, duplicate, openInNewTab } from '#lib/actions.js';
	import { connectEntries, connectUi, editConnection } from '#lib/connections.svelte.js';
	import ConnectDialog from '#lib/components/ConnectDialog.svelte';
	import ShareDialog from '#lib/components/ShareDialog.svelte';
	import FileList from '#lib/components/FileList.svelte';
	import PreviewDialog from '#lib/components/PreviewDialog.svelte';
	import PropertiesDialog from '#lib/components/PropertiesDialog.svelte';
	import SyncDialog from '#lib/components/SyncDialog.svelte';
	import TrashView from '#lib/components/TrashView.svelte';
	import ExcludeFolderDialog from '#lib/components/ExcludeFolderDialog.svelte';
	import ExplainDialog from '#lib/components/ExplainDialog.svelte';
	import FolderScopeDialog from '#lib/components/FolderScopeDialog.svelte';
	import ScopeSetupDialog from '#lib/components/ScopeSetupDialog.svelte';
	import JoinDialog from '#lib/components/JoinDialog.svelte';
	import PairDialog from '#lib/components/PairDialog.svelte';
	import SetupDialog from '#lib/components/SetupDialog.svelte';
	import { closeDevicesDialog, devicesUi, openDevicesDialog } from '#lib/devices.svelte.js';
	import { acceptsDrag, DRAG_TYPE } from '#lib/dnd.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { KEYS, installFilesKeys, keyLabel, listHasFocus } from '#lib/keys.js';
	import {
		areaEntries,
		connectionEntries,
		itemEntries,
		rootEntries,
		shareEntries,
		sortEntries,
		uploadEntries,
		disconnectConnection,
		type MenuContext
	} from '#lib/menus.js';
	import { toItem, type Item } from '#lib/items.js';
	import { clipboard, lastUndo, Manager, treeVersion } from '#lib/manager.svelte.js';
	import type { FilesPanelContext } from '#lib/panels/context.js';
	import { trash, TRASH } from '#lib/trash.svelte.js';
	import { inTrash } from '@in-browser/files/trash.js';
	import { download, fromDrop, fromInput, upload, zipName, type Upload } from '#lib/transfer.js';

	const manager = new Manager();
	manager.relocate = navigate;
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
	/** The browser hasn't promised to keep the storage: My files may be the only copy and can be cleared */
	let notKept = $state(false);
	/** A copy exists elsewhere: other devices or a synced folder on disk */
	const copied = $derived(p2pStatus.view.devices.length > 1 || !!syncStatus.folder);
	let fileInput = $state<HTMLInputElement>();
	let folderInput = $state<HTMLInputElement>();
	/** The list and the free area around it: keys for the list act while the focus is here (`keys.ts`) */
	let listArea = $state<HTMLElement>();
	/** The open side panel (`files:panel`; the folders by default) */
	let panel = $state<string | null>(null);
	const narrow = new MediaQuery('max-width: 639px', false);

	/** What the menus (`menus.ts`) do on this page */
	const menus: MenuContext = {
		manager,
		navigate,
		open,
		preview: (item) => (preview = item),
		properties: (item) => (properties = item),
		share: (path, id) => (sharing = { path, id }),
		shareNew,
		shareable,
		readOnlyAt,
		download: downloadItems,
		moveTo,
		chooseFiles: () => fileInput?.click(),
		chooseFolder: () => folderInput?.click()
	};

	/** The open folder lies in a folder this device doesn't sync: it comes live from the other devices */
	const remoteFolder = $derived(excludedNow().find((folder) => isInside(manager.folder, folder)) ?? null);
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
	/** The trash is shown instead of a folder (`/files?trash`) */
	const trashOpen = $derived(page.url.searchParams.has('trash'));
	/** A guest share for viewing (nothing can be added, changed or deleted here) – or the trash */
	const readOnlyPlace = $derived(trashOpen || connection?.mode === 'view');

	/** `path` lies in a guest share for viewing */
	function readOnlyAt(path: string): boolean {
		const place = placeRoot(path);
		return connections.list.find((c) => c.path === place)?.mode === 'view';
	}

	/** Drops into such a place: says why nothing happens */
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

	/** The open folder as an entry (for its menu: download, properties, its own actions) */
	const current = $derived(toItem({ name: crumbs.at(-1)?.name ?? t.root, path: manager.folder, kind: 'directory' }));

	// --- What commands act on: the selection, else the open folder (`ui.md`) ---

	/** What the commands of a folder act on – none in the trash, whose own commands act on `manager.selected` */
	const selected = $derived(trashOpen ? [] : manager.selected);
	const one = $derived(selected.length === 1 ? selected[0] : null);
	/** The selection lies in a guest share for viewing */
	const lockedSelection = $derived(selected.some((item) => readOnlyAt(item.path)));
	/** Entry Enter opens: the one with the keyboard focus, else the first selected */
	const focused = $derived(manager.visible.find((i) => i.path === manager.focus && manager.pick.has(i.path)) ?? selected[0] ?? null);
	/** Folder that sharing and the sync choice act on: a selected folder, else the open one */
	const folderTarget = $derived(one?.folder ? one.path : manager.folder);
	const online = $derived(p2pStatus.view.state === 'online');

	/** “Sync on this device” can change for the folder (My files, not the top, not inside a left-out folder) */
	function scopeChangeable(path: string): boolean {
		if (!online || path === '/' || isConnected(path) || !canExclude(path)) return false;
		return inScope(path, p2pStatus.view.scope) || parent(path) === '/' || inScope(parent(path), p2pStatus.view.scope);
	}

	const commands = {
		undo: {
			id: 'undo',
			label: m.commands.undo,
			icon: 'icon-[material-symbols-light--undo]',
			tip: m.commands.undoTip,
			shortcut: KEYS.undo,
			enabled: () => !!lastUndo.current,
			run: () => void lastUndo.current?.()
		},
		upload: {
			id: 'upload',
			label: m.toolbar.upload,
			icon: 'icon-[material-symbols-light--upload]',
			enabled: () => !readOnlyPlace,
			menu: () => uploadEntries(menus)
		},
		newFolder: {
			id: 'newFolder',
			label: m.toolbar.newFolder,
			icon: 'icon-[material-symbols-light--create-new-folder-outline]',
			enabled: () => !readOnlyPlace,
			run: () => void newFolder(manager)
		},
		newTextFile: {
			id: 'newTextFile',
			label: m.toolbar.newTextFile,
			icon: 'icon-[material-symbols-light--note-add-outline]',
			enabled: () => !readOnlyPlace,
			run: () => void newTextFile(manager)
		},
		paste: {
			id: 'paste',
			label: m.menu.paste,
			icon: 'icon-[material-symbols-light--content-paste]',
			shortcut: KEYS.paste,
			enabled: () => !readOnlyPlace && !!clipboard.current,
			run: () => void paste(manager)
		},
		cut: {
			id: 'cut',
			label: m.menu.cut,
			icon: 'icon-[material-symbols-light--content-cut]',
			shortcut: KEYS.cut,
			enabled: () => selected.length > 0 && !lockedSelection,
			run: () => toClipboard(selected, 'cut')
		},
		copy: {
			id: 'copy',
			label: m.menu.copy,
			icon: 'icon-[material-symbols-light--content-copy]',
			shortcut: KEYS.copy,
			enabled: () => selected.length > 0,
			run: () => toClipboard(selected, 'copy')
		},
		duplicate: {
			id: 'duplicate',
			label: m.menu.duplicate,
			icon: 'icon-[material-symbols-light--folder-copy-outline]',
			enabled: () => selected.length > 0 && !lockedSelection,
			run: () => void duplicate(manager, selected)
		},
		moveTo: {
			id: 'moveTo',
			label: m.menu.moveTo,
			icon: 'icon-[material-symbols-light--drive-file-move-outline]',
			enabled: () => selected.length > 0 && !lockedSelection,
			run: () => void moveTo(selected)
		},
		rename: {
			id: 'rename',
			label: m.menu.rename,
			icon: 'icon-[material-symbols-light--edit-outline]',
			shortcut: KEYS.rename,
			enabled: () => !!one && !lockedSelection,
			run: () => one && (manager.renaming = one.path)
		},
		delete: {
			id: 'delete',
			label: m.menu.delete,
			icon: 'icon-[material-symbols-light--delete-outline]',
			shortcut: KEYS.delete,
			enabled: () => selected.length > 0 && !lockedSelection,
			run: () => void removeItems(manager, selected)
		},
		selectAll: {
			id: 'selectAll',
			label: m.menu.selectAll,
			icon: 'icon-[material-symbols-light--select-all]',
			shortcut: KEYS.selectAll,
			enabled: () => manager.visible.length > 0,
			run: () => manager.selectAll()
		},
		clearSelection: {
			id: 'clearSelection',
			label: m.menu.clearSelection,
			icon: 'icon-[material-symbols-light--deselect]',
			shortcut: KEYS.clear,
			enabled: () => manager.selected.length > 0 || manager.pick.selecting,
			run: () => manager.clearSelection()
		},
		open: {
			id: 'open',
			label: m.menu.open,
			icon: 'icon-[material-symbols-light--open-in-new]',
			shortcut: KEYS.open,
			enabled: () => !!focused,
			run: () => focused && open(focused)
		},
		openWith: {
			id: 'openWith',
			label: m.commands.openWith,
			icon: 'icon-[material-symbols-light--apps]',
			enabled: () => !!one && !one.folder && one.openWith.length > 0,
			menu: () =>
				one && !one.folder
					? one.openWith.map((format) => ({
							label: m.menu.openWith(toolName(format.tool)),
							icon: 'icon-[material-symbols-light--open-in-new]',
							run: () => location.assign(toolUrl(one, format)!)
						}))
					: []
		},
		preview: {
			id: 'preview',
			label: m.menu.preview,
			icon: 'icon-[material-symbols-light--visibility-outline]',
			shortcut: KEYS.preview,
			enabled: () => one?.kind === 'file',
			run: () => one?.kind === 'file' && (preview = one)
		},
		download: {
			id: 'download',
			label: m.common.download,
			icon: 'icon-[material-symbols-light--download]',
			tip: m.commands.downloadTip,
			run: () => void downloadItems(selected.length ? selected : [current])
		},
		properties: {
			id: 'properties',
			label: m.menu.properties,
			icon: 'icon-[material-symbols-light--info-outline]',
			enabled: () => selected.length <= 1,
			run: () => (properties = one ?? current)
		},
		share: {
			id: 'share',
			label: m.share.action,
			icon: 'icon-[material-symbols-light--share-outline]',
			tip: m.commands.shareTip,
			enabled: () => p2pStatus.supported,
			run: () => (shareable(folderTarget) ? (sharing = { path: folderTarget }) : void shareNew())
		},
		connect: {
			id: 'connect',
			label: m.connected.connect,
			icon: 'icon-[material-symbols-light--add-link]',
			tip: m.connected.connectHint,
			enabled: () => connectionsSupported(),
			// Asks what to connect: a folder on this computer, a WebDAV server, S3 storage
			menu: () => connectEntries(navigate)
		},
		allowAccess: {
			id: 'allowAccess',
			label: m.connected.allow,
			icon: 'icon-[material-symbols-light--key-outline]',
			enabled: () => !!connection && connection.kind === 'folder' && connection.access !== 'granted',
			run: () => void (connection && allowAccess(connection.id))
		},
		disconnect: {
			id: 'disconnect',
			label: m.connected.disconnect,
			icon: 'icon-[material-symbols-light--link-off]',
			enabled: () => !!connection,
			run: () => void (connection && disconnectConnection(menus, connection))
		},
		syncNow: {
			id: 'syncNow',
			label: m.devices.syncNow,
			icon: 'icon-[material-symbols-light--sync]',
			enabled: () => online || !!syncStatus.folder,
			run: () => {
				if (syncStatus.folder) syncNow();
				if (online) syncDevicesNow().catch(fail);
			}
		},
		syncSettings: {
			id: 'syncSettings',
			label: m.commands.syncSettings,
			icon: 'icon-[material-symbols-light--settings-outline]',
			run: () => openDevicesDialog('sync')
		},
		addDevice: {
			id: 'addDevice',
			label: m.devices.addDevice,
			icon: 'icon-[material-symbols-light--qr-code-2]',
			enabled: () => p2pStatus.supported && p2pStatus.view.state !== 'removed',
			run: () => openDevicesDialog(online ? 'pair' : 'setup')
		},
		chooseFolders: {
			id: 'chooseFolders',
			label: m.devices.chooseFolders,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			enabled: () => online,
			run: () => openDevicesDialog(p2pStatus.view.setup ? 'scopeSetup' : 'scope')
		},
		syncHere: {
			id: 'syncHere',
			label: m.commands.syncHere,
			icon: 'icon-[material-symbols-light--sync-saved-locally-outline]',
			tip: m.commands.syncHereTip,
			enabled: () => scopeChangeable(folderTarget),
			active: () => online && !isConnected(folderTarget) && inScope(folderTarget, p2pStatus.view.scope),
			run: () => {
				const path = folderTarget;
				if (inScope(path, p2pStatus.view.scope)) devicesUi.exclude = path;
				else includeFolder(path).catch(fail);
			}
		},
		trashRestore: {
			id: 'trashRestore',
			label: m.trash.restore,
			icon: 'icon-[material-symbols-light--restore-from-trash-outline]',
			shortcut: KEYS.open,
			enabled: () => !trash.busy && manager.selected.length > 0,
			run: () => void trash.restore(trash.of(manager.selected))?.then(() => manager.refresh())
		},
		trashRemove: {
			id: 'trashRemove',
			label: m.trash.remove,
			icon: 'icon-[material-symbols-light--delete-forever-outline]',
			shortcut: KEYS.delete,
			enabled: () => !trash.busy && manager.selected.length > 0,
			run: () => void trash.remove(trash.of(manager.selected)).then(() => manager.refresh())
		},
		trashEmpty: {
			id: 'trashEmpty',
			label: m.trash.empty,
			icon: 'icon-[material-symbols-light--delete-sweep-outline]',
			enabled: () => !trash.busy && (!trashOpen || manager.visible.length > 0 || !!manager.query),
			run: () =>
				void trash.empty().then(() => {
					if (trashOpen) void manager.refresh();
				})
		},
		list: {
			id: 'list',
			label: m.toolbar.list,
			icon: 'icon-[material-symbols-light--view-list-outline]',
			active: () => manager.view === 'list',
			run: () => manager.setView('list')
		},
		grid: {
			id: 'grid',
			label: m.toolbar.grid,
			icon: 'icon-[material-symbols-light--grid-view-outline]',
			active: () => manager.view === 'grid',
			run: () => manager.setView('grid')
		},
		sort: {
			id: 'sort',
			label: m.view.sortBy,
			icon: 'icon-[material-symbols-light--sort]',
			menu: () => sortEntries(manager)
		},
		refresh: {
			id: 'refresh',
			label: m.toolbar.refresh,
			icon: 'icon-[material-symbols-light--refresh]',
			run: () => void manager.refresh()
		},
		up: {
			id: 'up',
			label: m.commands.up,
			icon: 'icon-[material-symbols-light--arrow-upward]',
			shortcut: KEYS.up,
			enabled: () => manager.folder !== '/',
			run: () => navigate(parent(manager.folder))
		}
	} satisfies Record<string, Command>;
	const upAlt: Command = { ...commands.up, id: 'upAlt', shortcut: KEYS.upAlt };

	// --- Side panels ---

	const panels: PanelSpec<FilesPanelContext>[] = [
		{ id: 'folders', icon: 'icon-[material-symbols-light--account-tree-outline]', label: m.panels.folders, load: async () => (await import('#lib/panels/FoldersPanel.svelte')).default },
		{ id: 'shares', icon: 'icon-[material-symbols-light--share-outline]', label: m.share.section, load: async () => (await import('#lib/panels/SharesPanel.svelte')).default }
	];
	const openPanel = { get: () => panel, set: (id: string | null) => (panel = id) };

	/** The trash's entries as a menu (right click, long press, the crumb) */
	function trashEntries(): MenuEntry[] {
		const entry = (c: Command): MenuEntry => ({ label: c.label, icon: c.icon, keys: c.shortcut && keyLabel(c.shortcut), disabled: c.enabled?.() === false, run: () => c.run?.() });
		return [entry(commands.trashRestore), entry(commands.trashRemove), { separator: true }, entry(commands.selectAll), entry(commands.trashEmpty)];
	}

	const panelContext: FilesPanelContext = {
		current: () => (trashOpen ? '' : manager.folder),
		navigate,
		trashOpen: () => trashOpen,
		openTrash,
		trashMenu: () => [
			{ label: m.menu.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: `${resolve('/files')}?trash`, run: openTrash },
			{ label: m.trash.empty, icon: 'icon-[material-symbols-light--delete-sweep-outline]', run: () => commands.trashEmpty.run() }
		],
		dropOnTrash: (paths) => void removeItems(manager, paths.map((path) => toItem({ name: basename(path), path, kind: 'file' }))),
		sheet: () => coarsePointer.current || narrow.current,
		dropItems,
		dropFiles,
		rootMenu: () => rootEntries(menus, toItem({ name: t.root, path: '/', kind: 'directory' })),
		folderMenu: (item) =>
			itemEntries(menus, [item], (it) => {
				// Renamed in the list of the folder it is in
				if (manager.folder !== parent(it.path)) navigate(parent(it.path));
				setTimeout(() => (manager.renaming = it.path), 150);
			}),
		connectionMenu: (c) => connectionEntries(menus, c),
		shareMenu: (share) => shareEntries(menus, share),
		openShare: (share) => (sharing = { path: share.folder, id: share.id }),
		shareNew
	};

	// --- Ribbon ---

	const tabs: RibbonTab[] = [
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'new', label: m.ribbon.groups.new, items: [commands.upload, commands.newFolder, commands.newTextFile] },
				{ id: 'clipboard', label: m.ribbon.groups.clipboard, items: [commands.paste, commands.cut, commands.copy] },
				{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.duplicate, commands.moveTo, commands.rename, commands.delete] },
				{ id: 'select', label: m.ribbon.groups.select, items: [commands.selectAll, commands.clearSelection] },
				{ id: 'find', label: m.ribbon.groups.find, items: [{ id: 'search', label: m.toolbar.search, custom: searchField }] }
			]
		},
		{
			id: 'share',
			label: m.ribbon.tabs.share,
			groups: [
				{ id: 'share', label: m.ribbon.groups.share, items: [commands.share] },
				{ id: 'download', label: m.ribbon.groups.download, items: [commands.download] }
			]
		},
		// Folders opened live (decided by the user: a place of their own, not part of sharing)
		{
			id: 'connect',
			label: m.ribbon.tabs.connect,
			groups: [{ id: 'connected', label: m.connected.title, items: [commands.connect, commands.allowAccess, commands.disconnect] }]
		},
		{
			id: 'sync',
			label: m.ribbon.tabs.sync,
			groups: [
				{ id: 'sync', label: m.ribbon.groups.sync, items: [commands.syncNow, commands.syncSettings] },
				{ id: 'devices', label: m.ribbon.groups.devices, items: [commands.addDevice, commands.chooseFolders, commands.syncHere] }
			]
		},
		{
			id: 'view',
			label: m.ribbon.tabs.view,
			groups: [
				{ id: 'show', label: m.ribbon.groups.show, items: [commands.list, commands.grid, commands.sort, commands.refresh] },
				{ id: 'panels', label: m.ribbon.groups.panels, items: panels.map((spec) => panelCommand(spec, openPanel)) }
			]
		},
		// The selected entries (phones switch to it in the selection mode – instead of other buttons in the top bar)
		{
			id: 'selection',
			label: m.ribbon.tabs.selection,
			contextual: true,
			visible: () => selected.length > 0,
			groups: [
				{ id: 'open', label: m.ribbon.groups.open, items: [commands.open, commands.openWith, commands.preview, commands.download] },
				{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.rename, commands.moveTo, commands.delete, commands.properties] },
				{ id: 'select', label: m.ribbon.groups.select, items: [commands.selectAll, commands.clearSelection] }
			]
		},
		// The trash, while it is shown (phones switch to it)
		{
			id: 'trash',
			label: m.ribbon.tabs.trash,
			contextual: true,
			visible: () => trashOpen,
			groups: [
				{ id: 'entries', label: m.ribbon.groups.entries, items: [commands.trashRestore, commands.trashRemove] },
				{ id: 'select', label: m.ribbon.groups.select, items: [commands.selectAll, commands.clearSelection] },
				{ id: 'trash', label: m.ribbon.groups.trash, items: [commands.trashEmpty] }
			]
		}
	];

	// Shortcuts: Ctrl+Z everywhere (outside text fields); the list's keys only while the focus is in the list – never
	// on a button, menu entry or link, where Enter and Space press it
	$effect(() =>
		installFilesKeys(
			() => listArea,
			() => [commands.undo],
			() =>
				trashOpen
					? [commands.trashRestore, commands.trashRemove, commands.selectAll, commands.clearSelection]
					: [
				commands.open,
				commands.preview,
				commands.rename,
				commands.delete,
				commands.copy,
				commands.cut,
				commands.paste,
				commands.selectAll,
				commands.clearSelection,
				commands.up,
				upAlt
					]
		)
	);

	// Arrow keys move through the list (held down they repeat); Shift extends the selection
	$effect(() => {
		const key = (e: KeyboardEvent) => {
			const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
			if (!step || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !listHasFocus(listArea)) return;
			e.preventDefault();
			manager.step(step, e.shiftKey);
		};
		addEventListener('keydown', key);
		return () => removeEventListener('keydown', key);
	});

	// Count, upload, storage and the selection on the left of the BrandFooter
	$effect(() => setBrandFooter({ status: footerStatus }));

	// Where you are: the folder path from the first folder (“Files” itself is the top level) – no actions, they are
	// in the ribbon (`branding.md`)
	$effect(() => {
		if (trashOpen) return setBrandBar({ crumbs: [{ label: m.trash.title }] });
		return setBrandBar({
			crumbs: crumbs.map((level, i) => (i < crumbs.length - 1 ? { label: level.name, onclick: () => navigate(level.path) } : { label: level.name }))
		});
	});

	/** The folder is part of the address (`/files?path=…`): back/forward and links work */
	function navigate(path: string) {
		const base = resolve('/files');
		goto(path === '/' ? base : `${base}?path=${encodeURIComponent(path)}`, { reset: false });
	}

	/** The trash, as the address `/files?trash` */
	function openTrash() {
		goto(`${resolve('/files')}?trash`, { reset: false });
	}

	// The trash is listed like a folder; entries also arrive from other devices
	$effect(() => {
		if (!trashOpen) return;
		return untrack(() => watchSettled((paths) => paths.some(inTrash), 500, () => void manager.refresh()));
	});

	$effect(() => {
		const path = trashOpen ? TRASH : normalize(page.url.searchParams.get('path') ?? '/');
		untrack(() => {
			void manager.load(path);
			// The keys of the list work right away (after a click on a folder in the tree or the path)
			if (!inTextField(document.activeElement) && !document.querySelector(':popover-open, dialog[open]')) listArea?.focus({ preventScroll: true });
		});
	});

	async function updateUsage() {
		const { usage: used = 0, quota = 0 } = await storageEstimate();
		usage = m.storage.used(formatSize(used, intlLocale), formatSize(quota, intlLocale));
		notKept = !(await storagePersisted());
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
	onMount(() => {
		updateUsage();
		// Tools without the dialog send a refused sign-in here (`accessAction`); Files opens it in place
		connectionEditor.open = (id) => {
			const kind = connections.list.find((c) => c.id === id)?.kind;
			if (kind === 'webdav' || kind === 's3') editConnection(id, kind);
		};
		const edit = page.url.searchParams.get('edit');
		if (edit) {
			const url = new URL(location.href);
			url.searchParams.delete('edit');
			void goto(url, { state: page.state, shallow: true, replace: true });
			void listConnections().then((list) => {
				const found = list.find((c) => c.id === edit);
				if (found && (found.kind === 'webdav' || found.kind === 's3')) editConnection(found.id, found.kind);
			});
		}
		// “Manage devices” from the footer of any tool
		if (page.url.searchParams.get('panel') === 'sync') {
			const url = new URL(location.href);
			url.searchParams.delete('panel');
			void goto(url, { state: page.state, shallow: true, replace: true });
			openDevicesDialog('sync');
		}
		const stopTree = watch(() => treeVersion.current++);
		const stopList = watchSettled(
			(paths) => paths.some((p) => parent(p) === manager.folder || isInside(manager.folder, p)),
			150,
			() => {
				manager.refresh();
				updateUsage();
			}
		);
		return () => {
			stopTree();
			stopList();
			connectionEditor.open = null;
		};
	});

	function open(item: Item) {
		// Nothing in the trash opens: a tap picks (touch selection mode), restoring is a command
		if (trashOpen) {
			if (manager.pick.touch) {
				manager.pick.selecting = true;
				manager.pick.toggle(item.path);
			}
			return;
		}
		if (item.folder) return navigate(item.path);
		const url = toolUrl(item);
		if (url) location.assign(url);
		else preview = item;
	}

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

	async function downloadItems(items: Item[]) {
		if (items.length === 0) return;
		const paths = items.map((i) => i.path);
		try {
			if (items.length > 1 || items[0].kind === 'directory') toast(m.toasts.zipping);
			await download(paths, zipName(paths, manager.folder, t.root));
		} catch (e) {
			fail(e, () => void downloadItems(items));
		}
	}

	async function uploadAll(uploads: Upload[] | Promise<Upload[]>, folder: string) {
		try {
			const count = await upload(await uploads, folder, (name) => (uploading = name));
			if (count) toast(m.toasts.uploaded(count), 'success');
		} catch (e) {
			fail(e);
		} finally {
			uploading = null;
			manager.refresh();
		}
	}

	/** “Move to …”: pick the target folder in the file dialog (touch has no dragging) */
	async function moveTo(items: Item[]) {
		const folder = await chooseFile({ mode: 'folder', folder: manager.folder, accept: [], title: m.menu.moveTo, confirmLabel: m.menu.moveHere });
		if (!folder) return;
		await transfer(
			manager,
			items.map((i) => i.path),
			folder,
			'move',
			m.toasts.moved
		);
	}

	function dropItems(paths: string[], folder: string, copy: boolean) {
		if (refusedAt(folder)) return;
		// Between My files and a connected folder dragging copies, as between drives
		const across = paths.some((path) => placeRoot(path) !== placeRoot(folder));
		const mode = copy || across ? 'copy' : 'move';
		void transfer(manager, paths, folder, mode, mode === 'copy' ? m.toasts.copied : m.toasts.moved);
	}

	async function commitRename(item: Item, name: string) {
		// Enter and leaving the field both end here – only the first counts
		if (manager.renaming !== item.path) return;
		manager.renaming = null;
		if (!(await rename(manager, item.path, name))) manager.renaming = item.path;
	}

	/** The selection's actions (context menu, ⋯ on touch) */
	const selectionEntries = (): MenuEntry[] => (trashOpen ? trashEntries() : itemEntries(menus, manager.selected));

	function areaMenu(e: MouseEvent) {
		openContextMenu(e, trashOpen ? trashEntries() : areaEntries(menus, readOnlyPlace));
	}

	function areaDragOver(e: DragEvent) {
		// Own entries over the free area stay where they are; files from the computer get uploaded here
		if (trashOpen || !acceptsDrag(e) || e.dataTransfer?.types.includes(DRAG_TYPE)) return;
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
		{#if uploading}
			<span class="flex items-center gap-1"><span class="loading loading-spinner loading-xs"></span>{m.toasts.uploading(uploading)}</span>
		{/if}
		{#if connection}
			<span class="hidden items-center gap-1 lg:flex">
				<span class="icon-[material-symbols-light--link] size-4" aria-hidden="true"></span>{connection.kind === 'share'
					? m.connected.liveShared(connection.host ?? '')
					: connection.kind === 'folder'
						? m.connected.live(connection.name)
						: m.connected.liveServer(connection.name)}
			</span>
		{:else if remoteFolder}
			<span class="hidden items-center gap-1 lg:flex">
				<span class="icon-[material-symbols-light--cloud-outline] size-4" aria-hidden="true"></span>{m.remote.live}
			</span>
		{:else if usage}
			<span class="hidden lg:inline">{usage}</span>
			{#if notKept && !copied}
				<a class="link-hover hidden items-center gap-1 lg:flex" href={resolve('/help/storage')} target="_blank" rel="noopener" title={m.storage.notKeptHint}>
					<span class="icon-[material-symbols-light--warning-outline] size-4 text-warning" aria-hidden="true"></span>{m.storage.notKept}
				</a>
			{/if}
		{/if}
		<span class="hidden truncate 2xl:inline">{m.list.hint}</span>
		<!-- Last, so the other items never move when the selection changes -->
		{#if manager.selected.length}<span>{m.list.selected(manager.selected.length)}</span>{/if}
	</span>
{/snippet}

<!-- The search in the open folder: a field in the ribbon (tab “Home”, group “Find”) -->
{#snippet searchField(_size: GroupSize)}
	<label class="input input-sm w-36 lg:w-48">
		<span class="icon-[material-symbols-light--search] size-4 opacity-60" aria-hidden="true"></span>
		<input type="search" bind:value={manager.query} placeholder={m.toolbar.search} aria-label={m.toolbar.search} />
	</label>
{/snippet}

{#if !supported()}
	<div class="alert alert-error m-6">{m.list.unsupported}</div>
{:else}
	<div class="flex h-full min-h-0 flex-col">
		<Ribbon {tabs} quick={[commands.undo]} storage="files" />
		<div class="flex min-h-0 flex-1">
			<PanelRail {panels} context={panelContext} bind:open={panel} storage="files" initial="folders" />

			<main class="flex min-w-0 flex-1 flex-col">
				<input bind:this={fileInput} type="file" multiple hidden onchange={(e) => uploadAll(fromInput(e.currentTarget.files!), manager.folder)} />
				<input
					bind:this={folderInput}
					type="file"
					webkitdirectory
					hidden
					onchange={(e) => uploadAll(fromInput(e.currentTarget.files!), manager.folder)}
				/>

				<!-- Takes the focus on a click, so the list's keys apply (keys.ts, installed for the window) -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<div
					bind:this={listArea}
					class="relative min-h-0 flex-1 overflow-auto outline-none"
					role="region"
					aria-label={trashOpen ? m.trash.title : (crumbs.at(-1)?.name ?? t.root)}
					tabindex="-1"
					data-testid="file-area"
					onpointerdown={(e) => manager.pick.pointerdown(e)}
					onclick={() => manager.clearSelection()}
					oncontextmenu={areaMenu}
					ondragover={areaDragOver}
					ondragleave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (dropping = false)}
					ondrop={areaDrop}
				>
					{#if trashOpen}
						<TrashView />
					{/if}
					{#if connection?.ended && !trashOpen}
						<div class="flex flex-col items-start gap-2 p-6">
							<p class="flex items-center gap-2">
								<span class="icon-[material-symbols-light--link-off] size-6 shrink-0" aria-hidden="true"></span>
								{m.share.ended}
							</p>
							<p class="text-sm opacity-70">{m.share.endedHint}</p>
							<button class="btn btn-sm" onclick={() => disconnectShare()}>{m.share.remove}</button>
						</div>
					{:else if connection && connection.access !== 'granted' && !trashOpen}
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
							onmenu={(e) => openContextMenu(e, selectionEntries())}
							entries={selectionEntries}
							onrenamestart={(item) => !readOnlyAt(item.path) && (manager.renaming = item.path)}
							ondropitems={dropItems}
							ondropfiles={dropFiles}
							onrename={commitRename}
							trash={trashOpen}
							onopentab={openInNewTab}
						/>
						{#if manager.visible.length === 0}
							<p class="p-6 text-center text-sm opacity-60">{manager.query ? m.list.noMatch : trashOpen ? m.trash.nothing : m.list.empty}</p>
						{/if}
					{/if}
					{#if dropping}
						<DropOverlay label={m.list.dropHere(crumbs.at(-1)?.name ?? t.root)} />
					{/if}
				</div>
			</main>
		</div>
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
{:else if devicesUi.dialog === 'scopeSetup'}
	<ScopeSetupDialog mode="device" onclose={closeDevicesDialog} />
{:else if devicesUi.dialog === 'folderScope'}
	<ScopeSetupDialog mode="folder" onclose={closeDevicesDialog} />
{/if}
{#if connectUi.kind}
	<ConnectDialog kind={connectUi.kind} edit={connectUi.edit} onclose={() => Object.assign(connectUi, { kind: null, edit: null })} onconnected={navigate} />
{/if}
{#if devicesUi.exclude}
	<ExcludeFolderDialog path={devicesUi.exclude} onclose={() => (devicesUi.exclude = null)} />
{/if}
