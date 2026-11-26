import { resolve } from '$app/paths';

/** Link to the editor of a backup or playlist in the shared file system */
export function editorUrl(path: string) {
	return `${resolve('/jwl-files/editor')}?path=${encodeURIComponent(path)}`;
}
