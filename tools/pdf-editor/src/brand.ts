import { resolve } from '$app/paths';

/** Link to the editor of a PDF in the shared file system */
export function editorUrl(path: string) {
	return `${resolve('/pdf-editor/editor')}?path=${encodeURIComponent(path)}`;
}
