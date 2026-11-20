import { cacheDir } from '@in-browser/files/cache.js';
import type { Encoding, LineEnding } from './document.js';

// Unsaved changes, kept privately in `cache/text-editor/drafts/<id>.json` (not shown, not synced), so closing the
// browser tab loses nothing: a file with a place under an id derived from its path (`pathDraftId`), a new file under
// the id in its address (`?draft=`). Writes and deletes run one after the other.

export interface FileStamp {
	size: number;
	modified: number;
}

export interface Draft {
	path: string | null;
	/** Name of a file opened from the computer (not saved here yet) */
	fileName?: string | null;
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

/** Ids in addresses (`?draft=`): only what a file name can hold */
export const isDraftId = (id: string) => /^[\w-]{1,64}$/.test(id);

export const newDraftId = () => crypto.randomUUID();

/** The draft id of a file with a place */
export async function pathDraftId(path: string) {
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path)));
	return `file-${Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
