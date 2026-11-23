import { resolve } from '$app/paths';

/** Link to the editor of a PDF in the shared file system */
export function editorUrl(path: string) {
	return `${resolve('/pdf-editor/editor')}?path=${encodeURIComponent(path)}`;
}

/** The slides window of a presentation: the PDF, the presentation it belongs to (its presenter view finds it by
 * that name) and where to start */
export function showUrl(path: string, session: string, at: { page: number; step: number }) {
	return `${resolve('/pdf-editor/show')}?path=${encodeURIComponent(path)}&session=${encodeURIComponent(session)}&page=${at.page}&step=${at.step}`;
}
