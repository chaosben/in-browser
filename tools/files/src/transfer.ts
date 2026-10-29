import { downloadZip } from 'client-zip';
import { list, mkdir, read, stat, writable } from '@in-browser/files/fs.js';
import { basename, join, uniqueName } from '@in-browser/files/path.js';

// Upload (files, folders, drops from the computer) and download (single file directly, everything else as ZIP).

/** File or folder to upload, relative to the target folder (`Folder/sub/file.txt`) */
export type Upload = { relative: string; file: File } | { relative: string; file?: undefined };

/** From `<input type="file">` (with `webkitdirectory`, files carry their relative path) */
export function fromInput(files: FileList): Upload[] {
	return [...files].map((file) => ({ relative: file.webkitRelativePath || file.name, file }));
}

/** From a drop of the computer's files and folders */
export async function fromDrop(data: DataTransfer): Promise<Upload[]> {
	const roots = [...data.items].map((item) => item.webkitGetAsEntry()).filter((e): e is FileSystemEntry => !!e);
	const uploads: Upload[] = [];
	const walk = async (entry: FileSystemEntry, relative: string): Promise<void> => {
		if (entry.isFile) {
			const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
			uploads.push({ relative, file });
			return;
		}
		uploads.push({ relative });
		const reader = (entry as FileSystemDirectoryEntry).createReader();
		// readEntries delivers in batches until an empty one
		for (;;) {
			const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
			if (batch.length === 0) break;
			for (const child of batch) await walk(child, `${relative}/${child.name}`);
		}
	};
	for (const root of roots) await walk(root, root.name);
	return uploads;
}

/**
 * Writes the uploads into `folder`. Top-level names that already exist get a number (` (2)`), nothing is
 * overwritten. Returns the number of files.
 */
export async function upload(uploads: Upload[], folder: string, progress?: (name: string) => void): Promise<number> {
	const taken = (await list(folder)).map((e) => e.name);
	const renamed = new Map<string, string>();
	const target = (relative: string) => {
		const [top, ...rest] = relative.split('/');
		if (!renamed.has(top)) {
			const name = uniqueName(top, taken);
			taken.push(name);
			renamed.set(top, name);
		}
		return join(folder, renamed.get(top)!, ...rest);
	};
	let count = 0;
	for (const item of uploads) {
		const path = target(item.relative);
		if (!item.file) {
			await mkdir(path);
			continue;
		}
		progress?.(item.file.name);
		await item.file.stream().pipeTo(await writable(path));
		count++;
	}
	return count;
}

/** Saves a file through the browser's download */
function save(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** All files below the paths, with their names inside the ZIP */
async function* zipEntries(paths: string[]) {
	for (const path of paths) {
		const entry = await stat(path);
		if (!entry) continue;
		if (entry.kind === 'file') {
			yield { name: entry.name, input: await read(path) };
			continue;
		}
		// The top folder has no name: its content goes to the root of the ZIP
		const inside = (prefix: string, name: string) => (prefix ? `${prefix}/${name}` : name);
		const walk = async function* (dir: string, prefix: string): AsyncGenerator<{ name: string; input?: File }> {
			if (prefix) yield { name: `${prefix}/` };
			for (const child of await list(dir)) {
				if (child.kind === 'file') yield { name: inside(prefix, child.name), input: await read(child.path) };
				else yield* walk(child.path, inside(prefix, child.name));
			}
		};
		yield* walk(path, entry.name);
	}
}

/** Downloads a single file as is, anything else (folders, packages, several) as one ZIP named `zipName`. */
export async function download(paths: string[], zipName: string): Promise<void> {
	if (paths.length === 1) {
		const entry = await stat(paths[0]);
		if (entry?.kind === 'file') return save(await read(paths[0]), entry.name);
	}
	const name = `${zipName}.zip`;
	const zip = downloadZip(zipEntries(paths));
	// Chromium: stream straight into the chosen file (also for many GB); elsewhere via memory
	if ('showSaveFilePicker' in window) {
		let target: FileSystemFileHandle;
		try {
			target = await window.showSaveFilePicker({ suggestedName: name, types: [{ accept: { 'application/zip': ['.zip'] } }] });
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			throw e;
		}
		await zip.body!.pipeTo(await target.createWritable());
		return;
	}
	save(await zip.blob(), name);
}

/** Name of the ZIP for a selection: the single entry's name, otherwise the folder's */
export function zipName(paths: string[], folder: string, rootName: string): string {
	if (paths.length === 1) return basename(paths[0]) || rootName;
	return basename(folder) || rootName;
}
