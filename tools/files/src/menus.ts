import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { coarsePointer } from '@in-browser/brand/ui/pointer.svelte.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { basename, isConnected, isInside, parent } from '@in-browser/files/path.js';
import { allowAccess, disconnect, type ConnectionView } from '@in-browser/files/sources/connections.svelte.js';
import { endShare, includeFolder, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
import type { ShareView } from '@in-browser/files/p2p/view.js';
import { canExclude, inScope } from '@in-browser/files/p2p/scope.js';
import { duplicate, folderUrl, newFolder, newTextFile, paste, removeItems, toClipboard, toolUrl } from '#lib/actions.js';
import { devicesUi } from '#lib/devices.svelte.js';
import { m } from '#lib/i18n/index.js';
import type { Item, SortKey } from '#lib/items.js';
import { KEYS, keyLabel } from '#lib/keys.js';
import { clipboard, type Manager } from '#lib/manager.svelte.js';

// The menus of Files (open folder, free area, entries, connections, shares). They read reactive state when built,
// so the BrandBar menu rebuilds when it changes. Entries that can't act right now are disabled, never left out.

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

/** Adding to the open folder: new, upload, paste, select all */
function folderEntries(ctx: MenuContext, locked: boolean): MenuEntry[] {
	const { manager } = ctx;
	return [
		{ label: m.toolbar.newFolder, icon: 'icon-[material-symbols-light--create-new-folder-outline]', disabled: locked, run: () => newFolder(manager) },
		{ label: m.toolbar.newTextFile, icon: 'icon-[material-symbols-light--note-add-outline]', disabled: locked, run: () => newTextFile(manager) },
		...uploadEntries(ctx, locked),
		{ separator: true },
		{
			label: m.menu.paste,
			icon: 'icon-[material-symbols-light--content-paste]',
			keys: keyLabel(KEYS.paste),
			disabled: locked || !clipboard.current,
			run: () => paste(manager)
		},
		{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', keys: keyLabel(KEYS.selectAll), disabled: !manager.visible.length, run: () => manager.selectAll() }
	];
}

/** “Sort by”: the key and the direction, the current ones checked */
export function sortEntries(manager: Manager): MenuEntry[] {
	const keys: [SortKey, string][] = [
		['name', m.columns.name],
		['kind', m.columns.kind],
		['size', m.columns.size],
		['modified', m.columns.modified]
	];
	return [
		{ heading: m.view.sortBy },
		...keys.map(([key, label]) => ({ label, checked: manager.sortKey === key, run: () => manager.setSort(key, manager.desc) })),
		{ separator: true },
		{ label: m.view.ascending, icon: 'icon-[material-symbols-light--arrow-upward-alt]', checked: !manager.desc, run: () => manager.setSort(manager.sortKey, false) },
		{ label: m.view.descending, icon: 'icon-[material-symbols-light--arrow-downward-alt]', checked: manager.desc, run: () => manager.setSort(manager.sortKey, true) }
	];
}

/** Context menu of the free area of the list */
export function areaEntries(ctx: MenuContext, locked: boolean): MenuEntry[] {
	return [
		...folderEntries(ctx, locked),
		{ label: m.toolbar.refresh, icon: 'icon-[material-symbols-light--refresh]', run: () => ctx.manager.refresh() },
		{ separator: true },
		...sortEntries(ctx.manager)
	];
}

/** Menu of “My files” in the folder tree */
export function rootEntries(ctx: MenuContext, root: Item): MenuEntry[] {
	return [
		{ label: m.menu.open, icon: 'icon-[material-symbols-light--folder-open-outline]', href: folderUrl(root.path), run: () => ctx.open(root) },
		{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', disabled: !clipboard.current, run: () => paste(ctx.manager, root.path) },
		{ separator: true },
		{ label: m.menu.downloadZip, icon: 'icon-[material-symbols-light--folder-zip-outline]', run: () => ctx.download([root]) },
		{ label: m.menu.properties, icon: 'icon-[material-symbols-light--info-outline]', run: () => ctx.properties(root) }
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

/** Actions of a connection: allow access again, disconnect (it is named after its folder) */
export function connectionEntries(ctx: MenuContext, c: ConnectionView): MenuEntry[] {
	return [
		...(c.access === 'granted'
			? []
			: [{ label: m.connected.allow, icon: 'icon-[material-symbols-light--key-outline]', run: () => void allowAccess(c.id) }]),
		{ label: m.connected.disconnect, icon: 'icon-[material-symbols-light--link-off]', run: () => void disconnectConnection(ctx, c) }
	];
}

export async function disconnectConnection(ctx: MenuContext, c: ConnectionView) {
	const ok = await ask({ title: m.connected.disconnectTitle, message: m.connected.disconnectMessage(c.name), confirm: m.connected.disconnect });
	if (!ok) return;
	await disconnect(c.id);
	if (isInside(ctx.manager.folder, c.path)) ctx.navigate('/');
}

/**
 * Actions for entries (the selection in the list, one folder in the tree, or the open folder); `rename` starts
 * renaming one where it is shown. `open`: with “Open” (not for the open folder itself).
 */
export function itemEntries(ctx: MenuContext, items: Item[], rename: (item: Item) => void = (item) => (ctx.manager.renaming = item.path), open = true): MenuEntry[] {
	const { manager } = ctx;
	const one = items.length === 1 ? items[0] : null;
	// In a guest share for viewing: only opening, looking and copying out
	const locked = items.some((item) => ctx.readOnlyAt(item.path));
	return [
		...(open && one?.folder
			? [{ label: m.menu.open, icon: 'icon-[material-symbols-light--folder-open-outline]', keys: keyLabel(KEYS.open), href: folderUrl(one.path), run: () => ctx.open(one) }]
			: []),
		...(one && !one.folder
			? one.openWith.map((format, i) => ({
					label: m.menu.openWith(toolName(format.tool)),
					icon: 'icon-[material-symbols-light--open-in-new]',
					...(i === 0 && one.formats.length ? { keys: keyLabel(KEYS.open) } : {}),
					href: toolUrl(one, format)!,
					run: () => location.assign(toolUrl(one, format)!)
				}))
			: []),
		...(one && one.kind === 'file'
			? [{ label: m.menu.preview, icon: 'icon-[material-symbols-light--visibility-outline]', keys: keyLabel(KEYS.preview), run: () => ctx.preview(one) }]
			: []),
		{
			label: one?.kind === 'file' ? m.menu.download : m.menu.downloadZip,
			icon: one?.kind === 'file' ? 'icon-[material-symbols-light--download]' : 'icon-[material-symbols-light--folder-zip-outline]',
			run: () => ctx.download(items)
		},
		{ separator: true },
		{ label: m.menu.copy, icon: 'icon-[material-symbols-light--content-copy]', keys: keyLabel(KEYS.copy), run: () => toClipboard(items, 'copy') },
		{ label: m.menu.cut, icon: 'icon-[material-symbols-light--content-cut]', keys: keyLabel(KEYS.cut), disabled: locked, run: () => toClipboard(items, 'cut') },
		...(one?.folder && open
			? [{ label: m.menu.paste, icon: 'icon-[material-symbols-light--content-paste]', disabled: locked || !clipboard.current, run: () => paste(manager, one.path) }]
			: []),
		{ label: m.menu.duplicate, icon: 'icon-[material-symbols-light--folder-copy-outline]', disabled: locked, run: () => duplicate(manager, items) },
		{ label: m.menu.moveTo, icon: 'icon-[material-symbols-light--drive-file-move-outline]', disabled: locked, run: () => ctx.moveTo(items) },
		{ separator: true },
		{ label: m.menu.rename, icon: 'icon-[material-symbols-light--edit-outline]', keys: keyLabel(KEYS.rename), disabled: locked || !one, run: () => one && rename(one) },
		{
			label: m.menu.delete,
			icon: 'icon-[material-symbols-light--delete-outline]',
			keys: keyLabel(KEYS.delete),
			disabled: locked,
			run: async () => {
				await removeItems(manager, items);
				// The open folder was in it (deleted from the tree or the folder path): show where it was
				const gone = items.find((i) => isInside(manager.folder, i.path));
				if (gone) ctx.navigate(parent(gone.path));
			}
		},
		{ separator: true },
		...(coarsePointer.current && open ? [{ label: m.menu.selectAll, icon: 'icon-[material-symbols-light--select-all]', run: () => manager.selectAll() }] : []),
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
