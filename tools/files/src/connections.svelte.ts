import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
import { openShareByWordsDialog } from '@in-browser/files/share-dialog.svelte.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { connectFolder, connections, diskConnectionsSupported } from '@in-browser/files/sources/connections.svelte.js';
import { m } from '#lib/i18n/index.js';

/** The dialog that connects or changes a server (placed once in Home.svelte) */
export const connectUi = $state<{ kind: 'webdav' | 's3' | null; edit: string | null }>({ kind: null, edit: null });

/** What “Connect …” offers (panel “Folders” and the ribbon tab “Connect” alike) */
export function connectEntries(navigate: (path: string) => void): MenuEntry[] {
	const disk = diskConnectionsSupported();
	return [
		{
			label: disk ? m.connected.kinds.folder : m.connected.kinds.folderUnsupported,
			icon: 'icon-[material-symbols-light--computer-outline]',
			disabled: !disk,
			run: () => void connect(navigate)
		},
		{ label: m.connected.kinds.webdav, icon: 'icon-[material-symbols-light--dns-outline]', run: () => Object.assign(connectUi, { kind: 'webdav', edit: null }) },
		{ label: m.connected.kinds.s3, icon: 'icon-[material-symbols-light--database-outline]', run: () => Object.assign(connectUi, { kind: 's3', edit: null }) },
		// What another device shares with this browser, by the four words it shows
		{ separator: true },
		{ label: filesMessages().openShare.menu, icon: 'icon-[material-symbols-light--password]', run: () => openShareByWordsDialog() }
	];
}

/** Opens the dialog for a stored server connection */
export function editConnection(id: string, kind: 'webdav' | 's3') {
	Object.assign(connectUi, { kind, edit: id });
}

/** “Folder on this computer …”: picks a folder on the computer and opens it */
export async function connect(navigate: (path: string) => void) {
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
