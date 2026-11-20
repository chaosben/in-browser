import { loadJson, writeStored } from '@in-browser/brand/storage.js';
import { isDraftId, loadDraft, pathDraftId, removeDraft, saveDraft } from '#lib/drafts.js';

// Until the editor showed one file per page, it kept its open tabs in `localStorage` and their unsaved changes as
// drafts under the tab's id. Once: drafts of files with a place move to the id of their path (they come back when
// the file is opened), and the file that was shown opens again.

const OLD_TABS_KEY = 'text-editor:tabs';

interface OldTabs {
	tabs: { id: string; path: string | null }[];
	active: string | null;
}

export type Target = { path: string } | { draft: string };

/** The file to open after taking over the old tabs; `null` when there were none */
export async function migrateTabs(): Promise<Target | null> {
	const stored = loadJson<OldTabs | null>(OLD_TABS_KEY, null);
	if (!stored) return null;
	writeStored(OLD_TABS_KEY, null);
	let target: Target | null = null;
	for (const tab of stored.tabs ?? []) {
		if (!isDraftId(tab.id)) continue;
		try {
			const draft = await loadDraft(tab.id);
			if (tab.path && draft) {
				await saveDraft(await pathDraftId(tab.path), draft);
				await removeDraft(tab.id);
			}
			if (tab.id !== stored.active && target) continue;
			if (tab.path) target = { path: tab.path };
			else if (draft) target = { draft: tab.id };
		} catch (e) {
			console.error(e);
		}
	}
	return target;
}
