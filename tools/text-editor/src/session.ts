import { loadJson, storeJson } from '@in-browser/brand/storage.js';
import { read, stat } from '@in-browser/files/fs.js';
import { decode, MAX_SIZE } from '#lib/document.js';
import { loadDraft } from '#lib/drafts.js';
import { sameStamp, stampOf, Tab } from '#lib/tab.svelte.js';

// The open tabs between visits: which files (in `localStorage`) and their unsaved changes (drafts, `drafts.ts`).

const TABS_KEY = 'text-editor:tabs';

interface StoredTab {
	id: string;
	path: string | null;
	untitled: number;
	fileName?: string | null;
}

interface StoredTabs {
	tabs: StoredTab[];
	active: string | null;
}

export function storeTabs(tabs: Tab[], active: string | null) {
	const stored: StoredTabs = {
		tabs: tabs.map((t) => ({ id: t.id, path: t.path, untitled: t.untitled, fileName: t.fileName })),
		active
	};
	storeJson(TABS_KEY, stored);
}

export const loadTabs = () => loadJson<StoredTabs>(TABS_KEY, { tabs: [], active: null });

/** A tab of the last visit with its file and draft; `null` when neither is left */
export async function restoreTab({ id, path, untitled, fileName }: StoredTab, wrap: boolean): Promise<Tab | null> {
	const draft = await loadDraft(id);
	const entry = path ? await stat(path) : null;
	const exists = entry?.kind === 'file' && (entry.size ?? 0) <= MAX_SIZE;
	const decoded = exists ? decode(new Uint8Array(await (await read(path!)).arrayBuffer())) : null;
	// Without changes a tab only comes back with its file
	if (!draft && !decoded) return null;
	const text = draft?.text ?? decoded!.text;
	const tab = new Tab({ id, path, untitled, fileName, text, saved: decoded?.text ?? '', wrap });
	const now = exists ? stampOf(entry!) : null;
	tab.encoding = tab.savedEncoding = decoded?.encoding ?? { charset: 'utf-8', bom: false };
	tab.eol = tab.savedEol = decoded?.eol ?? '\n';
	tab.stamp = draft ? draft.stamp : now;
	if (draft) {
		tab.encoding = draft.encoding;
		tab.eol = draft.eol;
		if (path && !exists) tab.conflict = 'deleted';
		else if (path && !sameStamp(now, draft.stamp)) tab.conflict = 'changed';
	}
	return tab;
}
