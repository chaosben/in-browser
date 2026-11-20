// PDFs opened here, newest first (this device only, `pdf-editor:recent`), and the folder of the last one opened
// (`pdf-editor:folder`) where the dialogs start.

import { loadJson, storeJson, readStored, writeStored } from '@in-browser/brand/storage.js';
import { parent } from '@in-browser/files/path.js';
import { forgetConnected, rememberConnected } from '@in-browser/files/sources/recent.js';

const KEY = 'pdf-editor:recent';
const FOLDER = 'pdf-editor:folder';
const MAX = 30;

export function recentPdfs(): string[] {
	const value = loadJson<unknown>(KEY, []);
	return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : [];
}

/** A PDF was opened: first in the list, its folder is where dialogs start next time */
export function rememberPdf(path: string) {
	storeJson(KEY, [path, ...recentPdfs().filter((p) => p !== path)].slice(0, MAX));
	writeStored(FOLDER, parent(path));
	// Connected folders: the start page's access notice knows about it
	rememberConnected('pdf-editor', path);
}

export function forgetPdf(path: string) {
	storeJson(KEY, recentPdfs().filter((p) => p !== path));
	forgetConnected('pdf-editor', path);
}

export const lastFolder = (): string => readStored(FOLDER) ?? '/';
