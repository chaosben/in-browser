// The question for an encrypted folder's password, from any page (Files, a tool opening a document in it, the file
// dialog); shown by `UnlockDialog.svelte`, placed once for the suite (`Suite.svelte`). Promise-based like `ask()`.

import { onLeavePage } from '@in-browser/brand/ui/page-scope.js';

interface Asking {
	/** The connection of the folder */
	id: string;
	name: string;
	/** The name of its format (`gocryptfs`) */
	format: string;
	resolve: (unlocked: boolean) => void;
}

export const unlockDialog = $state<{ current: Asking | null }>({ current: null });

/** Asks for the password of the folder of connection `id`; whether it was unlocked */
export function askUnlock(id: string, name: string, format: string): Promise<boolean> {
	closeUnlock(false);
	return new Promise((resolve) => {
		unlockDialog.current = { id, name, format, resolve };
	});
}

export function closeUnlock(unlocked: boolean) {
	const open = unlockDialog.current;
	unlockDialog.current = null;
	open?.resolve(unlocked);
}

// The question belongs to the page that asked
onLeavePage(() => closeUnlock(false));
