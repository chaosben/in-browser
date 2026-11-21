import { loadJson, readStored, storeJson, writeStored } from '@in-browser/brand/storage.js';
import { isConnected, parent } from '../path.js';
import { excludedFolderOf } from './registry.js';

// Documents of a tool that lie in connected folders or in folders this device doesn't sync (opened live from the
// other devices): tools don't search them (over the network, possibly large), so they remember what was opened or
// created there and list it on their start page (this device only).

/** Not searched: in a connected folder or a folder opened live from the other devices */
const elsewhere = (path: string) => isConnected(path) || excludedFolderOf(path) !== null;

const MAX = 50;

const key = (tool: string) => `${tool}:connected`;

function load(tool: string, storage: Storage): string[] {
	try {
		const value: unknown = JSON.parse(storage.getItem(key(tool)) ?? '[]');
		return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string' && (isConnected(p) || p.startsWith('/'))) : [];
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
	if (!elsewhere(path)) return;
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

/**
 * “Recently opened” of a tool whose documents are plain files anywhere (Text Editor, PDF Editor): the paths, newest
 * first (`<tool>:recent`, this device only), and the folder dialogs start in (`<tool>:folder`: where the last
 * document was opened or saved). Documents in connected folders are remembered for the start page's access notice
 * too. Tools with packages list all of theirs instead (`packageDocuments`).
 */
export function recentDocuments(tool: string, max = 30) {
	const RECENT = `${tool}:recent`;
	const FOLDER = `${tool}:folder`;
	const list = (): string[] => {
		const value = loadJson<unknown>(RECENT, []);
		return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : [];
	};
	return {
		list,
		/** A document was opened or saved: first in the list, its folder is where dialogs start next time */
		remember(path: string) {
			storeJson(RECENT, [path, ...list().filter((p) => p !== path)].slice(0, max));
			writeStored(FOLDER, parent(path));
			rememberConnected(tool, path);
		},
		/** Off the list (gone, or removed by the user) */
		forget(path: string) {
			storeJson(RECENT, list().filter((p) => p !== path));
			forgetConnected(tool, path);
		},
		lastFolder: (): string => readStored(FOLDER) ?? '/',
		/** A dialog was used in the folder of `path` */
		usedFolderOf: (path: string) => writeStored(FOLDER, parent(path))
	};
}
