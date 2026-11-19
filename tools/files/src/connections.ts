import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
import { connectFolder, connections } from '@in-browser/files/sources/connections.svelte.js';
import { m } from '#lib/i18n/index.js';

/** “Connect folder …”: picks a folder on the computer and opens it */
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
