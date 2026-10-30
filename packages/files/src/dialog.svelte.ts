// Open/save dialog of the shared file system for the tools; shown by `FileDialog.svelte`, which each tool places
// once in its layout. Promise-based like `ask()` from @in-browser/brand.

export interface FileDialogOptions {
	mode: 'open' | 'save';
	/** Folder shown first (created if missing) */
	folder: string;
	/** Selectable extensions (packages and files), e.g. `['.screencapture']`; folders are always shown */
	accept: readonly string[];
	/** Suggested name when saving, with extension */
	name?: string;
	/** Own title instead of “Open”/“Save as” */
	title?: string;
	/** Open: several files can be chosen (Ctrl/Shift-click) */
	multiple?: boolean;
	/** Save: an existing file (or package) of an accepted format may be replaced */
	overwrite?: boolean;
}

interface Open extends FileDialogOptions {
	resolve: (paths: string[] | null) => void;
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

export function closeFileDialog(paths: string[] | null) {
	const open = fileDialogState.current;
	fileDialogState.current = null;
	open?.resolve(paths);
}
