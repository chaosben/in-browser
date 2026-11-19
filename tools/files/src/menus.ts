import { startRename } from '@in-browser/brand/brand-bar.svelte.js';
import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { basename, isConnected, isInside, parent } from '@in-browser/files/path.js';
import {
	allowAccess,
	connectionLabel,
	connections,
	connectionsSupported,
	disconnect,
	type ConnectionView
} from '@in-browser/files/sources/connections.svelte.js';
import { endShare, includeFolder, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
import type { ShareView } from '@in-browser/files/p2p/view.js';
import { canExclude, inScope } from '@in-browser/files/p2p/scope.js';
import { duplicate, newFolder, newTextFile, paste, removeItems, toClipboard, toolUrl } from '#lib/actions.js';
import { connect } from '#lib/connections.js';
import { devicesUi, openDevicesDialog } from '#lib/devices.svelte.js';
import { m } from '#lib/i18n/index.js';
import type { Item } from '#lib/items.js';
import { clipboard, type Manager } from '#lib/manager.svelte.js';

// The menus of Files (open folder, free area, entries, connections, shares). They read reactive state when built,
// so the BrandBar menu rebuilds when it changes.

/** What the menus need from the page */
export interface MenuContext {
	manager: Manager;
	navigate(path: string): void;
	open(item: Item): void;
	preview(item: Item): void;
	properties(item: Item | null): void;
	/** Opens the share dialog of a folder (`id`: an existing share) */
	share(path: string, id?: string): void;
	/** “Share a folder …” */
	shareNew(): void;
	shareable(path: string): boolean;
	/** `path` lies in a guest share for viewing */
	readOnlyAt(path: string): boolean;
	download(items: Item[]): void;
	moveTo(items: Item[]): void;
	chooseFiles(): void;
	chooseFolder(): void;
}

export function uploadEntries(ctx: MenuContext, locked = false): MenuEntry[] {
	// Uploading whole folders needs `webkitdirectory` (missing on iOS)
	const folderUpload = 'webkitdirectory' in HTMLInputElement.prototype;
	return [
		{ label: m.toolbar.uploadFiles, icon: 'icon-[material-symbols-light--upload-file]', disabled: locked, run: ctx.chooseFiles },
		...(folderUpload
			? [{ label: m.toolbar.uploadFolder, icon: 'icon-[material-symbols-light--drive-folder-upload-outline]', disabled: locked, run: ctx.chooseFolder }]
			: [])
	];
}

/**
 * Adding to the open folder: new, upload, paste, select all. `area`: the context menu of the free area (with
 * shortcuts and “Refresh”)
 */
function folderEntries(ctx: MenuContext, locked: boolean, area: boolean): MenuEntry[] {
	const { manager } = ctx;
	return [
		{ label: m.toolbar.newFolder, icon: 'icon-[material-symbols-light--create-new-folder-outline]', disabled: locked, run: () => newFolder(manager) },
		{ label: m.toolbar.newTextFile, icon: 'icon-[material-symbols-light--note-add-outline]', disabled: locked, run: () => newTextFile(manager) },
		...uploadEntries(ctx, locked),
		...(area ? [{ separator: true } as MenuEntry] : []),
		{
			label: m.menu.paste,
			icon: 'icon-[material-symbols-light--content-paste]',
			...(area && { keys: 'Ctrl+V' }),
			disabled: locked || !clipboard.current,
			run: () => paste(manager)
		},
		{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', ...(area && { keys: 'Ctrl+A' }), run: () => manager.selectAll() },
		...(area ? [{ label: m.toolbar.refresh, icon: 'icon-[material-symbols-light--refresh]', run: () => manager.refresh() }] : [])
	];
}

/** Context menu of the free area of the list */
export function areaEntries(ctx: MenuContext, locked: boolean): MenuEntry[] {
	return folderEntries(ctx, locked, true);
}

/** Menu of the open folder (`folder`) in the BrandBar; `connection`: the connection it lies in */
export function openFolderEntries(ctx: MenuContext, folder: Item, connection: ConnectionView | null, locked: boolean): MenuEntry[] {
	const { manager } = ctx;
	return [
		...folderEntries(ctx, locked, false),
		{ separator: true },
		// The view switch on the right is hidden on small screens
		manager.view === 'list'
			? { label: m.toolbar.grid, icon: 'icon-[material-symbols-light--grid-view-outline]', run: () => manager.setView('grid') }
			: { label: m.toolbar.list, icon: 'icon-[material-symbols-light--view-list-outline]', run: () => manager.setView('list') },
		{ separator: true },
		{ label: m.menu.downloadZip, icon: 'icon-[material-symbols-light--folder-zip-outline]', run: () => ctx.download([folder]) },
		{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', run: () => ctx.properties(folder) },
		...(ctx.shareable(folder.path) ? [{ label: m.share.action, icon: 'icon-[material-symbols-light--share-outline]', run: () => ctx.share(folder.path) }] : []),
		...(connection && folder.path === connection.path ? [{ separator: true } as MenuEntry, ...connectionEntries(ctx, connection)] : []),
		{ separator: true },
		// Also in the sidebar, which is hidden on small screens
		{ label: m.trash.title, icon: 'icon-[material-symbols-light--delete-outline]', run: () => openDevicesDialog('trash') },
		...connections.list.map((c) => ({ label: connectionLabel(c), icon: 'icon-[material-symbols-light--link]', run: () => ctx.navigate(c.path) })),
		...(connectionsSupported() ? [{ label: m.connected.connect, icon: 'icon-[material-symbols-light--add-link]', run: () => connect(ctx.navigate) }] : []),
		...(p2pStatus.supported
			? [
					{ separator: true } as MenuEntry,
					...p2pStatus.view.shares.map((share) => ({
						label: `${basename(share.folder)} – ${m.share.shared}`,
						icon: 'icon-[material-symbols-light--share-outline]',
						run: () => ctx.share(share.folder, share.id)
					})),
					{ label: m.share.new, icon: 'icon-[material-symbols-light--share-outline]', run: ctx.shareNew }
				]
			: [])
	];
}

/** Actions of a folder this device shares with a guest */
export function shareEntries(ctx: MenuContext, share: ShareView): MenuEntry[] {
	return [
		{ label: m.share.show, icon: 'icon-[material-symbols-light--qr-code]', run: () => ctx.share(share.folder, share.id) },
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

/** Actions of a connection: allow access again, rename, disconnect */
export function connectionEntries(ctx: MenuContext, c: ConnectionView): MenuEntry[] {
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
							if (ctx.manager.folder !== c.path) ctx.navigate(c.path);
							// Renamed inline in the BrandBar once the connection is the open level
							setTimeout(startRename, 50);
						}
					}
				]),
		{ label: m.connected.disconnect, icon: 'icon-[material-symbols-light--link-off]', run: () => void disconnectConnection(ctx, c) }
	];
}

async function disconnectConnection(ctx: MenuContext, c: ConnectionView) {
	const ok = await ask({ title: m.connected.disconnectTitle, message: m.connected.disconnectMessage(c.name), confirm: m.connected.disconnect });
	if (!ok) return;
	await disconnect(c.id);
	if (isInside(ctx.manager.folder, c.path)) ctx.navigate('/');
}

/**
 * Actions for entries (the selection in the list, or one folder in the tree); `rename` starts renaming one where it
 * is shown in the list
 */
export function itemEntries(ctx: MenuContext, items: Item[], rename: (item: Item) => void = (item) => (ctx.manager.renaming = item.path)): MenuEntry[] {
	const { manager } = ctx;
	const one = items.length === 1 ? items[0] : null;
	// In a guest share for viewing: only opening, looking and copying out
	const locked = items.some((item) => ctx.readOnlyAt(item.path));
	return [
		...(one?.folder ? [{ label: m.menu.open, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => ctx.open(one) }] : []),
		...(one && !one.folder
			? one.openWith.map((format) => ({
					label: m.menu.openWith(toolName(format.tool)),
					icon: 'icon-[material-symbols-light--open-in-new]',
					run: () => location.assign(toolUrl(one, format)!)
				}))
			: []),
		...(one && one.kind === 'file'
			? [{ label: m.menu.preview, icon: 'icon-[material-symbols-light--visibility-outline]', keys: 'Space', run: () => ctx.preview(one) }]
			: []),
		{
			label: one?.kind === 'file' ? m.menu.download : m.menu.downloadZip,
			icon: one?.kind === 'file' ? 'icon-[material-symbols-light--download]' : 'icon-[material-symbols-light--folder-zip-outline]',
			run: () => ctx.download(items)
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
					{ label: m.menu.moveTo, icon: 'icon-[material-symbols-light--drive-file-move-outline]', run: () => ctx.moveTo(items) },
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
							if (gone) ctx.navigate(parent(gone.path));
						}
					}
				]),
		{ separator: true },
		...(coarsePointer.current ? [{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', run: () => manager.selectAll() }] : []),
		...scopeEntries(one),
		...(one?.folder && ctx.shareable(one.path)
			? [{ label: m.share.action, icon: 'icon-[material-symbols-light--share-outline]', run: () => ctx.share(one.path) }]
			: []),
		{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', disabled: !one, run: () => ctx.properties(one) }
	];
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
