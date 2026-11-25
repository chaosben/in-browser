// Open/save dialog of the shared file system for the tools; shown by `FileDialog.svelte`, which each tool places
// once in its layout. Promise-based like `ask()` from @in-browser/brand.

export interface FileDialogOptions {
	/** `folder`: pick a folder (only folders shown; confirming takes the open folder) */
	mode: 'open' | 'save' | 'folder';
	/** Folder shown first (created if missing) */
	folder: string;
	/** Selectable extensions (packages and files), e.g. `['.screencapture']`; folders are always shown */
	accept: readonly string[];
	/** Suggested name when saving, with extension */
	name?: string;
	/** Own title instead of “Open”/“Save as” */
	title?: string;
	/** Own label of the confirm button (e.g. “Move here”) */
	confirmLabel?: string;
	/** Open: several files can be chosen (Ctrl/Shift-click) */
	multiple?: boolean;
	/** Save: an existing file (or package) of an accepted format may be replaced */
	overwrite?: boolean;
	/** Save: an existing file of the format may be merged with instead (`merge.ts`): “Merge” next to “Replace” */
	merge?: boolean;
	/** `false`: only My files, no choice of connected places */
	places?: false;
}

interface Open extends FileDialogOptions {
	resolve: (paths: string[] | null, merge: boolean) => void;
}

export const fileDialogState = $state<{ current: Open | null }>({ current: null });

/** Lets the user pick files (open, with `multiple` several); the chosen paths, `null` if canceled. */
export function chooseFiles(options: FileDialogOptions): Promise<string[] | null> {
	closeFileDialog(null);
	return new Promise((resolve) => {
		fileDialogState.current = { ...options, resolve };
	});
}

/** Lets the user pick a file (open) or a location and name (save); the chosen path, `null` if canceled. */
export async function chooseFile(options: FileDialogOptions): Promise<string | null> {
	return (await chooseFiles({ ...options, multiple: false }))?.[0] ?? null;
}

/** Saving with `merge`: the chosen path and whether the user chose to merge with the file there */
export function chooseSaveTarget(options: FileDialogOptions): Promise<{ path: string; merge: boolean } | null> {
	closeFileDialog(null);
	return new Promise((resolve) => {
		fileDialogState.current = { ...options, mode: 'save', multiple: false, resolve: (paths, merge) => resolve(paths?.[0] ? { path: paths[0], merge } : null) };
	});
}

export function closeFileDialog(paths: string[] | null, merge = false) {
	const open = fileDialogState.current;
	fileDialogState.current = null;
	open?.resolve(paths, merge);
}
