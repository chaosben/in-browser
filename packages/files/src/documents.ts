import { readStored, writeStored } from '@in-browser/brand/storage.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { chooseFile } from './dialog.svelte.js';
import { isPackage } from './formats.js';
import { FilesError, list, move } from './fs.js';
import { filesErrorText, filesMessages } from './i18n/index.svelte.js';
import { basename, extname, join, parent, safeName, stem } from './path.js';
import { accessAction } from './sources/connections.svelte.js';
import { connectedDocuments, forgetConnected, rememberConnected } from './sources/recent.js';

// What the tools do the same way with their documents: one tab edits a document at a time (Web Lock), waiting
// changes are saved when the page is left, a failed automatic save is reported once, and documents that are packages
// (`<Name>.<ext>/`, see `formats.ts`) are found, created, opened and renamed alike.

/** Holds the lock `key` until the returned function is called; `null` if another tab holds it */
export function lockDocument(key: string): Promise<(() => void) | null> {
	return new Promise((resolve) => {
		navigator.locks.request(key, { ifAvailable: true }, (held) => {
			if (!held) return resolve(null);
			return new Promise<void>((release) => resolve(release));
		});
	});
}

/** Calls `flush` when the page is hidden or closed (phones may end it without notice); returns the cleanup */
export function flushWhenHidden(flush: () => void): () => void {
	const hidden = () => document.visibilityState === 'hidden' && flush();
	window.addEventListener('pagehide', flush);
	document.addEventListener('visibilitychange', hidden);
	return () => {
		window.removeEventListener('pagehide', flush);
		document.removeEventListener('visibilitychange', hidden);
	};
}

/**
 * Records a failed save on `doc` (the save state in the footer shows it) and reports it once per run of failures,
 * with “Allow access” where that helps; `retry` saves again.
 */
export function reportSaveFailure(doc: { saveError: string | null }, e: unknown, retry: () => void) {
	const reported = doc.saveError !== null;
	doc.saveError = filesErrorText(e);
	if (!reported) toast(filesMessages().document.saveFailed(doc.saveError), 'error', 10000, accessAction(e, retry));
}

/** Name of a document: its file name without extension */
export const documentName = (path: string) => stem(basename(path));

/** Package documents of one tool (`tool`: its folder, e.g. `notes`; `ext`: with dot) */
export function packageDocuments(tool: string, ext: string) {
	const folderKey = `${tool}:folder`;

	/** Paths of all packages below `folder` (hidden folders, package contents and remote folders skipped) */
	async function find(folder: string, into: string[] = []): Promise<string[]> {
		for (const entry of await list(folder)) {
			// Not searched over the network: folders this device doesn't sync (and connected ones) are left out
			if (entry.kind !== 'directory' || entry.name.startsWith('.') || entry.remote) continue;
			if (extname(entry.name) === ext) into.push(entry.path);
			else if (!isPackage(entry.name, 'directory')) await find(entry.path, into);
		}
		return into;
	}

	/** Folder the open/save dialogs start in: the one last used, otherwise the top folder */
	const lastFolder = () => readStored(folderKey) ?? '/';

	/** Remembers the folder of an opened or created document (and the document, in a connected folder) */
	function remember(path: string) {
		// Connected folders aren't searched: documents there are listed because they are remembered
		rememberConnected(tool, path);
		writeStored(folderKey, parent(path));
	}

	return {
		lastFolder,
		remember,

		/**
		 * All documents read with `load`: those in My files and those remembered in connected folders. Broken ones
		 * and those the browser doesn't allow access to right now are skipped, gone ones are forgotten.
		 */
		async list<T>(load: (path: string) => Promise<T>): Promise<T[]> {
			const connected = connectedDocuments(tool);
			const all = await Promise.all(
				[...new Set([...(await find('/')), ...connected])].map((path) =>
					load(path).catch((e: unknown) => {
						if (connected.includes(path) && e instanceof FilesError && e.code === 'notFound') forgetConnected(tool, path);
						return null;
					})
				)
			);
			return all.filter((doc): doc is Awaited<T> => doc !== null);
		},

		/** Asks where a new document goes (save dialog in the last folder); its path, `null` if canceled */
		chooseNew: (name: string, title: string, untitled: string, folder = lastFolder()): Promise<string | null> =>
			chooseFile({ mode: 'save', folder, accept: [ext], name: safeName(name, untitled) + ext, title }),

		/** Lets the user pick a document in the shared file system */
		async choose(title?: string): Promise<string | null> {
			const path = await chooseFile({ mode: 'open', folder: lastFolder(), accept: [ext], title });
			if (path) remember(path);
			return path;
		},

		/** Renames the package; the new path */
		async rename(path: string, name: string, untitled: string): Promise<string> {
			const target = join(parent(path), safeName(name, untitled) + ext);
			if (target === path) return path;
			await move(path, target);
			remember(target);
			return target;
		}
	};
}
