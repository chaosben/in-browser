import { dirAt, moveFile, renameEntry } from '../handles.js';
import { basename, nameKey, parent, segments } from '../path.js';
import type { FileState } from './plan.js';
import { scan, stateOf, DIR } from './scan.js';
import type { Tree } from './tree.js';

// A folder handle as a sync tree: the folder on disk of the folder sync, and each simulated device in the specs

export function handleTree(root: FileSystemDirectoryHandle): Tree {
	const dir = (path: string, create = false) => dirAt(root, segments(path), create);
	const file = async (path: string, create = false) => (await dir(parent(path), create)).getFileHandle(basename(path), { create });
	/** The folder, `null` only if it isn't there (other errors are thrown: unreadable is not empty) */
	const existing = (path: string) =>
		dir(path).catch((e: unknown) => {
			if (e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null;
			throw e;
		});

	return {
		scan: () => scan(root),
		async stat(path): Promise<FileState | null> {
			const folder = await existing(parent(path));
			if (!folder) return null;
			try {
				return stateOf(await (await folder.getFileHandle(basename(path))).getFile());
			} catch (e) {
				if (!(e instanceof DOMException) || (e.name !== 'TypeMismatchError' && e.name !== 'NotFoundError')) throw e;
			}
			try {
				await folder.getDirectoryHandle(basename(path));
				return DIR;
			} catch (e) {
				if (e instanceof DOMException && (e.name === 'TypeMismatchError' || e.name === 'NotFoundError')) return null;
				throw e;
			}
		},
		read: async (path) => (await file(path)).getFile(),
		write: async (path) => (await file(path, true)).createWritable(),
		mkdir: async (path) => void (await dir(path, true)),
		remove: async (path) => (await dir(parent(path))).removeEntry(basename(path), { recursive: true }),
		async move(from, to) {
			const source = await dir(parent(from));
			if (parent(from) === parent(to) && nameKey(basename(from)) === nameKey(basename(to))) {
				// Upper/lower case only: copying would land in the same file on Windows/macOS, so only a real rename
				return renameEntry(source, basename(from), basename(to));
			}
			await moveFile(source, basename(from), await dir(parent(to), true), basename(to));
		},
		async names(folder) {
			const handle = await existing(folder);
			if (!handle) return [];
			const names: string[] = [];
			for await (const key of handle.keys()) names.push(key);
			return names;
		}
	};
}
