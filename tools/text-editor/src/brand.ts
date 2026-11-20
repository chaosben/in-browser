import { resolve } from '$app/paths';
import { newDraftId } from '#lib/drafts.js';

/** Link to the editor of a file with a place */
export function editorUrl(path: string) {
	return `${resolve('/text-editor/editor')}?path=${encodeURIComponent(path)}`;
}

/** Link to the editor of a file without a place yet (new, or opened from the computer): its draft id, a new one by default */
export function draftUrl(id: string = newDraftId()) {
	return `${resolve('/text-editor/editor')}?draft=${encodeURIComponent(id)}`;
}
