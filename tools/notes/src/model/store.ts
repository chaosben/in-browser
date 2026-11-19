// Notebooks in the shared file system. A notebook is the package `<Name>.note/` (see `types.ts`); at runtime its
// path is its identity.

import { isPackage, PACKAGE_MANIFEST } from '@in-browser/files/formats.js';
import { chooseFile } from '@in-browser/files/dialog.svelte.js';
import { FilesError, list, mkdir, move, read, readText, remove, stat, write } from '@in-browser/files/fs.js';
import { basename, extname, join, normalize, parent, safeName, stem } from '@in-browser/files/path.js';
import { connectedDocuments, forgetConnected, rememberConnected } from '@in-browser/files/sources/recent.js';
import { m } from '#lib/i18n/index.js';
import { GRACE_MS, unusedAssets } from './gc.js';
import { assetsOf, backgroundAssets, newNotebook, newPage, NOTEBOOK_EXT, parseNotebook, parsePage, serializePage, type Notebook, type PageContent } from './types.js';

/** Folder last used for a notebook (start of the open/save dialogs) */
const FOLDER_KEY = 'notes:folder';

export const pagePath = (notebook: string, id: string) => join(notebook, 'pages', `${id}.json`);
export const manifestPath = (notebook: string) => join(notebook, PACKAGE_MANIFEST);
export const assetsPath = (notebook: string) => join(notebook, 'assets');

export function lastFolder(): string {
	try {
		return localStorage.getItem(FOLDER_KEY) ?? '/';
	} catch {
		return '/';
	}
}

export function rememberNotebook(path: string) {
	// Connected folders aren't searched: notebooks there are listed because they are remembered
	rememberConnected('notes', path);
	try {
		localStorage.setItem(FOLDER_KEY, parent(path));
	} catch {
		// Storage blocked: the dialogs just start at the top
	}
}

export function notebookName(path: string): string {
	return stem(basename(path));
}

export interface NotebookEntry {
	path: string;
	name: string;
	pages: number;
	modified: number;
}

/** Paths of all notebooks anywhere in the file system (hidden folders and package contents skipped) */
async function findNotebooks(folder: string, into: string[] = []): Promise<string[]> {
	for (const entry of await list(folder)) {
		if (entry.kind !== 'directory' || entry.name.startsWith('.')) continue;
		if (extname(entry.name) === NOTEBOOK_EXT) into.push(entry.path);
		else if (!isPackage(entry.name, 'directory')) await findNotebooks(entry.path, into);
	}
	return into;
}

/**
 * All notebooks, last changed first: those in My files and those remembered in connected folders; broken ones and
 * those the browser doesn't allow access to right now are skipped, gone ones are forgotten
 */
export async function listNotebooks(): Promise<NotebookEntry[]> {
	const connected = connectedDocuments('notes');
	const entries = await Promise.all(
		[...(await findNotebooks('/')), ...connected].map(async (path): Promise<NotebookEntry | null> => {
			try {
				const notebook = await readNotebook(path);
				const modified = (await stat(manifestPath(path)))?.modified ?? notebook.updatedAt;
				return { path, name: notebookName(path), pages: notebook.pages.length, modified: Math.max(modified, notebook.updatedAt) };
			} catch (e) {
				if (connected.includes(path) && e instanceof FilesError && e.code === 'notFound') forgetConnected('notes', path);
				return null;
			}
		})
	);
	return entries.filter((e): e is NotebookEntry => e !== null).sort((a, b) => b.modified - a.modified);
}

export async function readNotebook(path: string): Promise<Notebook> {
	return parseNotebook(JSON.parse(await readText(manifestPath(normalize(path)))));
}

export async function writeNotebook(path: string, notebook: Notebook): Promise<void> {
	await write(manifestPath(path), JSON.stringify(notebook));
}

/** Content of a page; a page without a file (new, or not synced yet) is empty */
export async function readPage(path: string, id: string): Promise<PageContent> {
	try {
		return parsePage(JSON.parse(await readText(pagePath(path, id))));
	} catch (e) {
		if (e instanceof FilesError && e.code === 'notFound') return { items: [] };
		throw e;
	}
}

export async function writePage(path: string, id: string, content: PageContent): Promise<void> {
	await write(pagePath(path, id), serializePage(content));
}

/** Stores a file in the notebook's assets under a new name (assets are never overwritten); that name */
export async function addAsset(path: string, data: Blob, ext: string): Promise<string> {
	const name = `${crypto.randomUUID()}.${ext}`;
	await write(join(assetsPath(path), name), data);
	return name;
}

export async function readAsset(path: string, name: string): Promise<File> {
	return read(join(assetsPath(path), name));
}

export async function deletePageFile(path: string, id: string): Promise<void> {
	await remove(pagePath(path, id)).catch(() => {});
}

/** Asks where a new notebook goes and creates it; its path, `null` if canceled */
export async function createNotebook(): Promise<string | null> {
	const path = await chooseFile({
		mode: 'save',
		folder: lastFolder(),
		accept: [NOTEBOOK_EXT],
		name: safeName(m.home.untitled, m.home.untitled) + NOTEBOOK_EXT,
		title: m.home.newTitle
	});
	if (!path) return null;
	await mkdir(join(path, 'pages'));
	await writeNotebook(path, newNotebook());
	rememberNotebook(path);
	return path;
}

/**
 * Asks where a notebook made from a PDF goes (named after it, next to it if it is in the file system) and creates
 * it: the PDF in its assets, one page per PDF page. Its path, `null` if canceled.
 */
export async function createNotebookFromPdf(pdf: Blob, name: string, sizes: { w: number; h: number }[], folder = lastFolder()): Promise<string | null> {
	const path = await chooseFile({
		mode: 'save',
		folder,
		accept: [NOTEBOOK_EXT],
		name: safeName(name, m.home.untitled) + NOTEBOOK_EXT,
		title: m.home.newTitle
	});
	if (!path) return null;
	await mkdir(join(path, 'pages'));
	const asset = await addAsset(path, pdf, 'pdf');
	const notebook = newNotebook();
	notebook.pages = sizes.map((size, i) => ({ ...newPage('blank', size), background: { asset, page: i + 1 } }));
	await writeNotebook(path, notebook);
	rememberNotebook(path);
	return path;
}

/** Lets the user pick a notebook in the shared file system */
export async function chooseNotebook(): Promise<string | null> {
	const path = await chooseFile({ mode: 'open', folder: lastFolder(), accept: [NOTEBOOK_EXT], title: m.home.openTitle });
	if (path) rememberNotebook(path);
	return path;
}

/** Renames the package; the new path */
export async function renameNotebook(path: string, name: string): Promise<string> {
	const target = join(parent(path), safeName(name, m.home.untitled) + NOTEBOOK_EXT);
	if (target === path) return path;
	await move(path, target);
	return target;
}

/**
 * Deletes asset files no page references any more (after the grace period). Reads every page, so it runs in the
 * background after opening and only when there are assets at all.
 */
export async function cleanupAssets(path: string, notebook: Notebook, referencesOf: (content: PageContent) => string[] = assetsOf): Promise<void> {
	let files;
	try {
		files = (await list(assetsPath(path))).filter((e) => e.kind === 'file');
	} catch {
		return;
	}
	if (!files.length) return;
	const now = Date.now();
	// Nothing old enough: no need to read the pages
	if (!files.some((f) => now - (f.modified ?? now) > GRACE_MS)) return;
	const referenced = new Set<string>(backgroundAssets(notebook));
	for (const page of notebook.pages) {
		for (const ref of referencesOf(await readPage(path, page.id))) referenced.add(ref);
	}
	const unused = unusedAssets(files.map((f) => ({ name: f.name, modified: f.modified ?? now })), referenced, now);
	await Promise.all(unused.map((name) => remove(join(assetsPath(path), name)).catch(() => {})));
}
