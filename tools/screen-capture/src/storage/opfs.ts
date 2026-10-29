import { fillItem, parseProject, type LibraryEntry, type Project } from '#lib/project/types.js';

// Layout in the Origin Private File System:
//   projects/<id>/project.json
//   projects/<id>/media/<file>
//   exports/<file>             (temporary export files)
//   library/library.json       (global library: entries usable in all projects)
//   library/media/<file>       (copies of the media files global entries use)

async function root() {
	return navigator.storage.getDirectory();
}

async function dir(...path: string[]): Promise<FileSystemDirectoryHandle> {
	let handle = await root();
	for (const name of path) handle = await handle.getDirectoryHandle(name, { create: true });
	return handle;
}

/** Asks the browser not to evict the storage automatically. */
export async function requestPersistence(): Promise<boolean> {
	if (!navigator.storage.persist) return false;
	return (await navigator.storage.persisted()) || navigator.storage.persist();
}

export async function storageEstimate() {
	return navigator.storage.estimate();
}

export async function listProjects(): Promise<Project[]> {
	const projects: Project[] = [];
	const projectsDir = await dir('projects');
	for await (const [, handle] of projectsDir.entries()) {
		if (handle.kind !== 'directory') continue;
		try {
			const file = await (await handle.getFileHandle('project.json')).getFile();
			projects.push(parseProject(JSON.parse(await file.text())));
		} catch {
			// Skip incomplete project (e.g. aborted recording)
		}
	}
	return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<Project> {
	const file = await (await (await dir('projects', id)).getFileHandle('project.json')).getFile();
	return parseProject(JSON.parse(await file.text()));
}

export async function saveProject(project: Project): Promise<void> {
	const handle = await (await dir('projects', project.id)).getFileHandle('project.json', {
		create: true
	});
	const writable = await handle.createWritable();
	await writable.write(JSON.stringify(project));
	await writable.close();
}

export async function deleteProject(id: string): Promise<void> {
	await (await dir('projects')).removeEntry(id, { recursive: true });
}

export async function mediaFile(projectId: string, file: string): Promise<File> {
	return (await (await dir('projects', projectId, 'media')).getFileHandle(file)).getFile();
}

/** Opens a project media file for writing (compatible with Mediabunny's `StreamTarget`). */
export async function mediaWritable(
	projectId: string,
	file: string
): Promise<FileSystemWritableFileStream> {
	const handle = await (await dir('projects', projectId, 'media')).getFileHandle(file, {
		create: true
	});
	return handle.createWritable();
}

export async function deleteMediaFile(projectId: string, file: string): Promise<void> {
	await (await dir('projects', projectId, 'media')).removeEntry(file).catch(() => {});
}

export async function listMediaFiles(projectId: string): Promise<string[]> {
	const names: string[] = [];
	for await (const [name, handle] of (await dir('projects', projectId, 'media')).entries()) {
		if (handle.kind === 'file') names.push(name);
	}
	return names;
}

export async function exportWritable(
	file: string
): Promise<{ writable: FileSystemWritableFileStream; getFile: () => Promise<File> }> {
	const exportsDir = await dir('exports');
	const handle = await exportsDir.getFileHandle(file, { create: true });
	return { writable: await handle.createWritable(), getFile: () => handle.getFile() };
}

/** Deletes old export files, except the given one. */
export async function clearExports(keep?: string): Promise<void> {
	const exportsDir = await dir('exports');
	const names: string[] = [];
	for await (const [name] of exportsDir.entries()) if (name !== keep) names.push(name);
	await Promise.all(names.map((n) => exportsDir.removeEntry(n).catch(() => {})));
}

/** Deletes files in the media folder that belong to no source or image of the project (e.g. after aborts). */
export async function cleanupMedia(project: Project): Promise<void> {
	const keep = new Set([...project.sources.flatMap((s) => [s.file, `${s.id}.peaks.json`]), ...project.images.map((i) => i.file)]);
	const orphans = (await listMediaFiles(project.id)).filter((name) => !keep.has(name));
	await Promise.all(orphans.map((name) => deleteMediaFile(project.id, name)));
}

export async function writeMediaText(projectId: string, file: string, text: string): Promise<void> {
	const writable = await mediaWritable(projectId, file);
	await writable.write(text);
	await writable.close();
}

/** Entries of the global library */
export async function loadLibrary(): Promise<LibraryEntry[]> {
	try {
		const file = await (await (await dir('library')).getFileHandle('library.json')).getFile();
		const raw = JSON.parse(await file.text());
		return Array.isArray(raw) ? raw.map((e: LibraryEntry) => ({ ...e, items: e.items.map(fillItem) })) : [];
	} catch (e) {
		if (e instanceof DOMException && e.name === 'NotFoundError') return [];
		throw e;
	}
}

export async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
	const handle = await (await dir('library')).getFileHandle('library.json', { create: true });
	const writable = await handle.createWritable();
	await writable.write(JSON.stringify(entries));
	await writable.close();
}

export async function libraryMediaFile(file: string): Promise<File> {
	return (await (await dir('library', 'media')).getFileHandle(file)).getFile();
}

export async function libraryMediaWritable(file: string): Promise<FileSystemWritableFileStream> {
	return (await (await dir('library', 'media')).getFileHandle(file, { create: true })).createWritable();
}

export async function deleteLibraryMedia(file: string): Promise<void> {
	await (await dir('library', 'media')).removeEntry(file).catch(() => {});
}
