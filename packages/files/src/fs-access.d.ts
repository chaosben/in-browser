// Parts of the File System Access API (Chromium) missing from lib.dom

declare global {
	interface Window {
		showDirectoryPicker(options?: {
			id?: string;
			mode?: 'read' | 'readwrite';
			startIn?: string | FileSystemHandle;
		}): Promise<FileSystemDirectoryHandle>;
	}

	interface FileSystemHandle {
		queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
		requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
	}
}

export {};
