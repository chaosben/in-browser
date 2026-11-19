import { isConnected } from '../path.js';

// Documents of a tool that lie in connected folders: tools don't search connected folders (they can be large), so
// they remember what was opened or created there and list it on their start page (this device only).

const MAX = 50;

const key = (tool: string) => `${tool}:connected`;

function load(tool: string, storage: Storage): string[] {
	try {
		const value: unknown = JSON.parse(storage.getItem(key(tool)) ?? '[]');
		return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string' && isConnected(p)) : [];
	} catch {
		return [];
	}
}

function store(tool: string, paths: string[], storage: Storage) {
	try {
		storage.setItem(key(tool), JSON.stringify(paths));
	} catch {
		// Storage blocked: the document just isn't listed later
	}
}

/** Remembers a document of `tool` if it lies in a connected folder (newest first) */
export function rememberConnected(tool: string, path: string, storage: Storage = localStorage): void {
	if (!isConnected(path)) return;
	store(tool, [path, ...load(tool, storage).filter((p) => p !== path)].slice(0, MAX), storage);
}

/** Remembered documents of `tool` in connected folders, newest first */
export function connectedDocuments(tool: string, storage: Storage = localStorage): string[] {
	return load(tool, storage);
}

/** Forgets a document (gone, or its connection was removed) */
export function forgetConnected(tool: string, path: string, storage: Storage = localStorage): void {
	store(tool, load(tool, storage).filter((p) => p !== path), storage);
}
