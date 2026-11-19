import { resolve } from '$app/paths';

/** Link to the editor of a notebook (path of its package) */
export function editorUrl(path: string) {
	return `${resolve('/notes/editor')}?path=${encodeURIComponent(path)}`;
}
