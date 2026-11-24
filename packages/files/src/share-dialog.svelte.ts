import { isConnected } from './path.js';
import { p2pStatus } from './p2p/p2p.svelte.js';
import { inScope } from './p2p/scope.js';
import { filesMessages } from './i18n/index.svelte.js';
import type { Command } from '@in-browser/brand/commands.js';

// The share dialog and the dialog for opening a share by its words, one each in every tool (placed by
// `ToolLayout`): a tool asks for them, the layout shows them.

/** What the share dialog shows: a new share of `path` (a folder, or with `single` one file or package), or the share `id` */
export type ShareTarget = { path: string; single?: boolean } | { id: string };

export const shareDialog = $state<{ target: ShareTarget | null; opening: boolean }>({ target: null, opening: false });

/** Opens the share dialog for an entry of My files, or for a share made before */
export function openShareDialog(target: ShareTarget) {
	shareDialog.target = target;
}

/** Opens the dialog asking for a share's four words */
export function openShareByWordsDialog() {
	shareDialog.opening = true;
}

/** Can this entry be shared from here? Only entries of My files on this device (not the whole, not a connected
 * folder, not one this device leaves out of the sync), in a browser that shares at all */
export function canShare(path: string | null | undefined): boolean {
	return !!path && p2pStatus.supported && path !== '/' && !isConnected(path) && inScope(path, p2pStatus.view.scope);
}

/** The command “Share …” of a document tool (tab “File”): shares the open document (`path()`, null while none) as one file */
export function shareCommand(path: () => string | null | undefined): Command {
	return {
		id: 'share',
		label: filesMessages().shareDialog.action,
		tip: filesMessages().shareDialog.tip,
		icon: 'icon-[material-symbols-light--share-outline]',
		enabled: () => canShare(path()),
		run: () => {
			const p = path();
			if (p) openShareDialog({ path: p, single: true });
		}
	};
}
