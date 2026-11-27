import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText, filesMessages } from '@in-browser/files/i18n/index.svelte.js';
import { openShareByWordsDialog } from '@in-browser/files/share-dialog.svelte.js';
import type { MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { connectFolder, connections, diskConnectionsSupported, openVault } from '@in-browser/files/sources/connections.svelte.js';
import { chooseFile } from '@in-browser/files/dialog.svelte.js';
import { FilesError } from '@in-browser/files/fs.js';
import { VaultFormatError } from '@in-browser/files/sources/vault/formats.js';
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
		// An encrypted folder lying in My files, shown decrypted (decided by the user: connected where everything is)
		{ label: m.connected.kinds.vault, icon: 'icon-[material-symbols-light--lock-outline]', run: () => void connectVault(navigate) },
		// What another device shares with this browser, by the four words it shows
		{ separator: true },
		{ label: filesMessages().openShare.menu, icon: 'icon-[material-symbols-light--password]', run: () => openShareByWordsDialog() }
	];
}

/** “Encrypted folder in My files …”: picks the folder, unlocks it (asks for its password) and opens it */
export async function connectVault(navigate: (path: string) => void) {
	const fv = filesMessages().vault;
	const folder = await chooseFile({ mode: 'folder', folder: '/', accept: [], places: false, title: m.connected.chooseVault, confirmLabel: m.connected.chooseVaultConfirm });
	if (!folder) return;
	try {
		const root = await openVault(folder);
		if (root) navigate(root);
	} catch (e) {
		if (e instanceof VaultFormatError) toast(e.reason === 'unsupported' ? fv.unsupported : fv.invalid, 'error', 10000);
		else if (e instanceof FilesError && e.code === 'notFound') toast(m.connected.notVault, 'error', 10000);
		else {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}
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
