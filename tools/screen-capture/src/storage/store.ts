import { cacheDir } from '@in-browser/files/cache.js';
import { PACKAGE_MANIFEST } from '@in-browser/files/formats.js';
import { chooseFiles } from '@in-browser/files/dialog.svelte.js';
import { documentName, packageDocuments } from '@in-browser/files/documents.js';
import { FilesError, list, mkdir, open, read, readText, remove, stat, write, writable, type RandomAccess } from '@in-browser/files/fs.js';
import { join, normalize } from '@in-browser/files/path.js';
import { m } from '#lib/i18n/index.js';
import { IMAGE_EXTENSIONS } from '#lib/media/images.js';
import { MEDIA_EXTENSIONS } from '#lib/media/media.js';
import { fillItem, parseProject, type LibraryEntry, type Project } from '#lib/project/types.js';

export { requestPersistence, storageEstimate } from '@in-browser/files/cache.js';

// Projects are packages in the shared file system (see @in-browser/files):
//   <any folder>/<Name>.screencapture/project.json
//   <folder>/<Name>.screencapture/media/<file>   (recordings/imports as MP4, own images, waveform caches – files
//                                                are only ever added under new names, never overwritten)
//   /.apps/screen-capture/library/…              (global library: entries usable in all projects; synced)
//   cache/screen-capture/exports/<file>          (temporary export files; local only)
// At runtime `project.id` is the path of the package: everything that stores or looks up media uses it.

export const PROJECT_EXT = '.screencapture';
const LIBRARY = '/.apps/screen-capture/library';
const projects = packageDocuments('screen-capture', PROJECT_EXT);

/** Path of a media file of a project */
export const mediaPath = (project: string, file: string) => join(project, 'media', file);

export const lastFolder = projects.lastFolder;
export const rememberProject = projects.remember;
/** Lets the user pick a project in the shared file system */
export const chooseProject = () => projects.choose();

/** All projects (see `packageDocuments`; incomplete ones, e.g. of an aborted recording, are skipped), newest first */
export async function listProjects(): Promise<Project[]> {
	return (await projects.list(loadProject)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(path: string): Promise<Project> {
	path = normalize(path);
	const project = parseProject(JSON.parse(await readText(join(path, PACKAGE_MANIFEST))));
	return { ...project, id: path };
}

export async function saveProject(project: Project): Promise<void> {
	await write(join(project.id, PACKAGE_MANIFEST), JSON.stringify(project));
}

/** Last change of the project's `project.json`, `undefined` if it is gone */
export async function projectFileDate(path: string): Promise<number | undefined> {
	return (await stat(join(path, PACKAGE_MANIFEST)))?.modified;
}

/** Name of the project in the package at `path` (its file name without extension) */
export const projectName = documentName;

/**
 * Asks where a new project goes (save dialog, suggested name from `title`) and creates its empty package;
 * returns its path (= project id), `null` if canceled.
 */
export async function chooseNewProject(title: string): Promise<string | null> {
	const path = await projects.chooseNew(title, m.home.newProjectTitle, m.common.untitled);
	if (!path) return null;
	await mkdir(join(path, 'media'));
	rememberProject(path);
	return path;
}

/** Lets the user pick media and images in the shared file system; their contents, `[]` if canceled. */
export async function chooseMediaFromFiles(folder: string): Promise<File[]> {
	const paths = await chooseFiles({
		mode: 'open',
		multiple: true,
		folder,
		accept: [...MEDIA_EXTENSIONS, ...IMAGE_EXTENSIONS],
		title: m.editor.chooseFromFiles
	});
	return paths ? Promise.all(paths.map((path) => read(path))) : [];
}

export async function deleteProject(path: string): Promise<void> {
	await remove(path);
}

export async function mediaFile(project: string, file: string): Promise<File> {
	return read(mediaPath(project, file));
}

/** A media file read in pieces (only what is decoded is read – also from another device) */
export function mediaAccess(project: string, file: string): Promise<RandomAccess> {
	return open(mediaPath(project, file));
}

/** Opens a project media file for writing (compatible with Mediabunny's `StreamTarget`). */
export async function mediaWritable(project: string, file: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	return writable(mediaPath(project, file));
}

export async function deleteMediaFile(project: string, file: string): Promise<void> {
	await remove(mediaPath(project, file)).catch((e) => console.warn('[screen-capture]', e));
}

export async function listMediaFiles(project: string): Promise<string[]> {
	try {
		return (await list(join(project, 'media'))).filter((e) => e.kind === 'file').map((e) => e.name);
	} catch (e) {
		if (e instanceof FilesError) return [];
		throw e;
	}
}

/** Deletes files in the media folder that belong to no source or image of the project (e.g. after aborts). */
export async function cleanupMedia(project: Project): Promise<void> {
	const keep = new Set([...project.sources.flatMap((s) => [s.file, `${s.id}.peaks.json`]), ...project.images.map((i) => i.file)]);
	const orphans = (await listMediaFiles(project.id)).filter((name) => !keep.has(name));
	await Promise.all(orphans.map((name) => deleteMediaFile(project.id, name)));
}

export async function writeMediaText(project: string, file: string, text: string): Promise<void> {
	await write(mediaPath(project, file), text);
}

export async function exportWritable(
	file: string
): Promise<{ writable: FileSystemWritableFileStream; getFile: () => Promise<File> }> {
	const handle = await (await cacheDir('screen-capture', 'exports')).getFileHandle(file, { create: true });
	return { writable: await handle.createWritable(), getFile: () => handle.getFile() };
}

/** Deletes old export files, except the given one. */
export async function clearExports(keep?: string): Promise<void> {
	const exportsDir = await cacheDir('screen-capture', 'exports');
	const names: string[] = [];
	for await (const name of exportsDir.keys()) if (name !== keep) names.push(name);
	await Promise.all(names.map((n) => exportsDir.removeEntry(n).catch((e) => console.warn('[screen-capture]', e))));
}

/** Path of the global library file (other tabs and the sync change it too) */
export const LIBRARY_FILE = join(LIBRARY, 'library.json');

/** Entries of the global library */
export async function loadLibrary(): Promise<LibraryEntry[]> {
	try {
		const raw = JSON.parse(await readText(LIBRARY_FILE));
		return Array.isArray(raw) ? raw.map((e: LibraryEntry) => ({ ...e, items: e.items.map(fillItem) })) : [];
	} catch (e) {
		if (e instanceof FilesError && e.code === 'notFound') return [];
		throw e;
	}
}

export async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
	await write(LIBRARY_FILE, JSON.stringify(entries));
}

export async function libraryMediaFile(file: string): Promise<File> {
	return read(join(LIBRARY, 'media', file));
}

export async function libraryMediaWritable(file: string): Promise<WritableStream<FileSystemWriteChunkType>> {
	return writable(join(LIBRARY, 'media', file));
}

export async function deleteLibraryMedia(file: string): Promise<void> {
	await remove(join(LIBRARY, 'media', file)).catch((e) => console.warn('[screen-capture]', e));
}
