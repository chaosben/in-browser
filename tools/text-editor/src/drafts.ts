import { cacheDir } from '@in-browser/files/cache.js';
import type { Encoding, LineEnding } from './document.js';

// Unsaved changes of the tabs, kept privately in `cache/text-editor/drafts/<tab id>.json` (not shown, not synced),
// so closing the browser tab loses nothing. Writes and deletes run one after the other.

export interface FileStamp {
	size: number;
	modified: number;
}

export interface Draft {
	path: string | null;
	text: string;
	encoding: Encoding;
	eol: LineEnding;
	/** The file as it was when the changes started (to notice changes made elsewhere meanwhile) */
	stamp: FileStamp | null;
}

const folder = () => cacheDir('text-editor', 'drafts');
const fileName = (id: string) => `${id}.json`;

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
	const next = queue.then(job, job);
	queue = next.catch(() => {});
	return next;
}

export function saveDraft(id: string, draft: Draft) {
	return enqueue(async () => {
		const writable = await (await (await folder()).getFileHandle(fileName(id), { create: true })).createWritable();
		await writable.write(JSON.stringify(draft));
		await writable.close();
	});
}

export function loadDraft(id: string): Promise<Draft | null> {
	return enqueue(async () => {
		try {
			return JSON.parse(await (await (await (await folder()).getFileHandle(fileName(id))).getFile()).text()) as Draft;
		} catch {
			return null;
		}
	});
}

export function removeDraft(id: string) {
	return enqueue(async () => {
		try {
			await (await folder()).removeEntry(fileName(id));
		} catch {
			// Not there
		}
	});
}

/** Deletes the drafts of tabs that no longer exist */
export function pruneDrafts(keep: Set<string>) {
	return enqueue(async () => {
		const dir = await folder();
		for await (const name of dir.keys()) {
			if (!keep.has(name.replace(/\.json$/, ''))) await dir.removeEntry(name).catch(() => {});
		}
	});
}
