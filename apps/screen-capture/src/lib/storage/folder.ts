import { parseProject, newId, type Project } from '#lib/project/types.js';
import { listProjects, mediaFile, mediaWritable, saveProject } from './opfs';
import { m } from '#lib/i18n/index.js';

// Project as a folder on disk (File System Access API, Chromium only):
//   <folder>/project.json
//   <folder>/media/<file>

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function saveToFolder(project: Project): Promise<string> {
	const target = await window.showDirectoryPicker({ id: 'screen-capture-project', mode: 'readwrite' });
	const media = await target.getDirectoryHandle('media', { create: true });
	for (const source of project.sources) {
		const file = await mediaFile(project.id, source.file);
		const writable = await (await media.getFileHandle(source.file, { create: true })).createWritable();
		await file.stream().pipeTo(writable);
	}
	const json = await (await target.getFileHandle('project.json', { create: true })).createWritable();
	await json.write(JSON.stringify(project, null, '\t'));
	await json.close();
	return target.name;
}

/** Reads a project from a folder and imports it into browser storage. Returns the project ID. */
export async function openFromFolder(): Promise<string> {
	const source = await window.showDirectoryPicker({ id: 'screen-capture-project', mode: 'read' });
	let project: Project;
	try {
		const file = await (await source.getFileHandle('project.json')).getFile();
		project = parseProject(JSON.parse(await file.text()));
	} catch (e) {
		if (e instanceof DOMException) throw new Error(m.errors.noProjectJson(source.name));
		throw e;
	}
	// If the project already exists in the browser, import it as a copy instead of overwriting.
	if ((await listProjects()).some((p) => p.id === project.id)) {
		project = { ...project, id: newId(), name: `${project.name} (Kopie)` };
	}
	const media = await source.getDirectoryHandle('media');
	for (const s of project.sources) {
		const file = await (await media.getFileHandle(s.file)).getFile();
		await file.stream().pipeTo(await mediaWritable(project.id, s.file));
	}
	await saveProject({ ...project, updatedAt: Date.now() });
	return project.id;
}
