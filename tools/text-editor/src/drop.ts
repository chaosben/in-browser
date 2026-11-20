import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { m } from '#lib/i18n/index.js';

// Files dragged from the computer onto a page (start page and editor): caught before CodeMirror, which would paste
// their content into the text.

export const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

/** The first dropped file (one file per page); skipped folders and further files are named in a message */
export function droppedFile(e: DragEvent): File | null {
	// The items are only readable during the event
	const files: File[] = [];
	let folders = 0;
	for (const item of e.dataTransfer?.items ?? []) {
		if (item.kind !== 'file') continue;
		if (item.webkitGetAsEntry()?.isDirectory) folders++;
		else {
			const file = item.getAsFile();
			if (file) files.push(file);
		}
	}
	return firstFile(files, folders);
}

/** One file of several (file input, drop) */
export function firstFile(files: File[], folders = 0): File | null {
	if (folders) toast(m.toasts.foldersSkipped(folders));
	if (files.length > 1) toast(m.toasts.onlyFirst(files[0].name));
	return files[0] ?? null;
}
