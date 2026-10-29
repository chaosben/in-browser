// Parts of the File System Access API (Chromium) missing from lib.dom

declare global {
	interface Window {
		showSaveFilePicker(options?: {
			suggestedName?: string;
			types?: { description?: string; accept: Record<string, string[]> }[];
		}): Promise<FileSystemFileHandle>;
	}
}

export {};
