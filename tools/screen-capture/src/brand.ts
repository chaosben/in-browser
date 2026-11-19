import { resolve } from '$app/paths';

/** Link to the editor of a project (path of its package) */
export function editorUrl(path: string) {
	return `${resolve('/screen-capture/editor')}?path=${encodeURIComponent(path)}`;
}
