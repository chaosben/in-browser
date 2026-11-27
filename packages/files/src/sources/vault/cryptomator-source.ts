import { debug } from '@in-browser/brand/debug.js';
import { FilesError, type Entry } from '../../entry.js';
import * as opfs from '../../opfs.js';
import { basename, join, parent, segments } from '../../path.js';
import { opfsTree } from '../../sync/opfs-tree.js';
import { trashInTree, untrashInTree } from '../../trash.js';
import type { RandomAccess, Source } from '../source.js';
import {
	checkConfig,
	CIPHER_CHUNK,
	CONFIG_FILE,
	CONTENTS_FILE,
	cipherEntryKind,
	CryptomatorKeys,
	DATA_DIR,
	DIR_FILE,
	DIR_ID_BACKUP,
	fingerprintOf,
	HEADER_LEN,
	MASTERKEY_FILE,
	NAME_FILE,
	newMasterkey,
	newVaultFiles,
	parseMasterkeyFile,
	PLAIN_CHUNK,
	plainSize,
	unlockMasterkey,
	verifyConfig
} from './cryptomator.js';
import { VaultFormatError } from './errors.js';
import type { VaultFormat } from './formats.js';
import { memoryWritable } from './memory-writable.js';

// The Cryptomator format behind `VaultFormat` (`formats.ts`), and a vault of My files in it (`cryptomator.ts`) as a
// connected source. Like the gocryptfs one it writes only the encrypted form, through `opfs.ts`, and collects writes
// in memory. A folder is an entry (`<name>.c9r/dir.c9r`, its id) pointing to its own folder under `d/`, so moving a
// folder moves only its entry; deleting one removes its folders under `d/` too, children first.
//
// Deleting moves the entry into the trash of My files: a file whole, a folder only as its entry – its contents stay
// under `d/` meanwhile (encrypted), so restoring brings it back; when the trash entry goes, they stay behind there.

interface Located {
	/** The entry: `<name>.c9r` (a file, or a folder holding `dir.c9r`) or `<hash>.c9s/` (a long name) */
	path: string;
	/** The folder of `d/` it lies in */
	folder: string;
	/** The id of the folder it lies in */
	dirId: string;
	stored: string;
	/** Long names: the full encrypted name for `name.c9s` */
	long: string | null;
}

const text = async (path: string) => (await opfs.read(path)).text();

export function vaultSource(root: string, keys: () => Promise<CryptomatorKeys>): Source {
	let warned = false;

	const folderOf = async (k: CryptomatorKeys, dirId: string) => join(root, await k.dirPath(dirId));

	/** The id of a folder entry, `null` for a file entry */
	async function dirIdOf(entryPath: string): Promise<string | null> {
		const file = await opfs.stat(join(entryPath, DIR_FILE));
		return file?.kind === 'file' ? text(file.path) : null;
	}

	/** Where the file content of a file entry lies */
	const dataOf = (at: Located) => (at.long ? join(at.path, CONTENTS_FILE) : at.path);

	async function place(k: CryptomatorKeys, dirId: string, name: string): Promise<Located> {
		const folder = await folderOf(k, dirId);
		const { stored, long } = await k.encryptName(name, dirId);
		return { path: join(folder, stored), folder, dirId, stored, long };
	}

	/** The id of the folder at `path` (`''` for the top one) */
	async function idOf(k: CryptomatorKeys, path: string): Promise<string> {
		let dirId = '';
		for (const name of segments(path)) {
			const at = await place(k, dirId, name);
			const id = await dirIdOf(at.path);
			if (id === null) throw new FilesError('notFound', path);
			dirId = id;
		}
		return dirId;
	}

	async function locate(k: CryptomatorKeys, path: string): Promise<Located> {
		if (path === '/') throw new FilesError('root', path);
		return place(k, await idOf(k, parent(path)), basename(path));
	}

	/** Errors name the plain path (never an encrypted one) */
	async function run<T>(path: string, action: (k: CryptomatorKeys) => Promise<T>): Promise<T> {
		const k = await keys();
		try {
			return await action(k);
		} catch (e) {
			if (e instanceof FilesError) throw new FilesError(e.code, path);
			if (e instanceof VaultFormatError || (e instanceof DOMException && e.name === 'OperationError')) {
				console.warn('[vault]', path, e);
				throw new FilesError('damaged', path);
			}
			throw e;
		}
	}

	/** The plain entry of an entry of a folder under `d/` (`null`: not part of the vault, a symbolic link) */
	async function entryOf(k: CryptomatorKeys, entry: Entry, dirId: string, path: string): Promise<Entry | null> {
		const kind = cipherEntryKind(entry.name);
		if (kind === 'internal') return null;
		let full = entry.name;
		if (kind === 'long') {
			if (entry.kind !== 'directory') return null;
			const nameFile = await opfs.stat(join(entry.path, NAME_FILE));
			if (nameFile?.kind !== 'file') return null;
			full = (await text(nameFile.path)).trim();
		}
		const name = await k.decryptName(full, dirId);
		if (!name) {
			if (!warned) debug('[vault] entries that are not encrypted names are left out, e.g.', entry.name);
			warned = true;
			return null;
		}
		const at = join(path, name);
		if (entry.kind === 'file') return kind === 'name' ? { name, path: at, kind: 'file', size: plainSize(entry.size ?? 0), modified: entry.modified } : null;
		if (await dirIdOf(entry.path)) return { name, path: at, kind: 'directory' };
		if (kind === 'long') {
			const contents = await opfs.stat(join(entry.path, CONTENTS_FILE));
			if (contents?.kind === 'file') return { name, path: at, kind: 'file', size: plainSize(contents.size ?? 0), modified: contents.modified };
		}
		// A symbolic link (`symlink.c9r`): the browser has none
		return null;
	}

	async function statAt(k: CryptomatorKeys, at: Located, path: string): Promise<Entry | null> {
		const entry = await opfs.stat(at.path);
		if (!entry) return null;
		return entryOf(k, { ...entry, name: at.stored }, at.dirId, parent(path));
	}

	/** Makes a new folder of the vault: its own folder under `d/` (with the backup of its id), then its entry */
	async function makeFolder(k: CryptomatorKeys, at: Located): Promise<void> {
		const id = crypto.randomUUID();
		const folder = await folderOf(k, id);
		await opfs.mkdir(folder);
		await opfs.write(join(folder, DIR_ID_BACKUP), await k.encryptFile(new TextEncoder().encode(id)));
		await opfs.mkdir(at.path);
		if (at.long) await opfs.write(join(at.path, NAME_FILE), at.long);
		await opfs.write(join(at.path, DIR_FILE), id);
	}

	/** Removes the folders under `d/` of the folder `dirId` and of everything in it */
	async function dropFolder(k: CryptomatorKeys, dirId: string): Promise<void> {
		const folder = await folderOf(k, dirId);
		for (const entry of (await opfs.stat(folder)) ? await opfs.list(folder) : []) {
			if (entry.kind !== 'directory') continue;
			const child = await dirIdOf(entry.path);
			if (child !== null) await dropFolder(k, child);
		}
		await opfs.remove(folder);
	}

	return {
		caps: { readOnly: false, trash: true },

		list: (path) =>
			run(path, async (k) => {
				const dirId = await idOf(k, path);
				const folder = await folderOf(k, dirId);
				const entries = await Promise.all((await opfs.list(folder)).map((entry) => entryOf(k, entry, dirId, path)));
				return entries.filter((e): e is Entry => e !== null);
			}),

		stat: (path) =>
			run(path, async (k) => {
				if (path === '/') return { name: '', path: '/', kind: 'directory' };
				let at: Located;
				try {
					at = await locate(k, path);
				} catch (e) {
					if (e instanceof FilesError && e.code === 'notFound') return null;
					throw e;
				}
				return statAt(k, at, path);
			}),

		read: (path) =>
			run(path, async (k) => {
				const file = await opfs.read(dataOf(await locate(k, path)));
				const plain = await k.decryptFile(new Uint8Array(await file.arrayBuffer()));
				return new File([plain], basename(path), { lastModified: file.lastModified });
			}),

		open: (path) =>
			run(path, async (k): Promise<RandomAccess> => {
				const file = await opfs.read(dataOf(await locate(k, path)));
				const header = await k.header(new Uint8Array(await file.slice(0, HEADER_LEN).arrayBuffer()));
				return {
					size: plainSize(file.size),
					type: '',
					modified: file.lastModified,
					read: (start, end) =>
						run(path, async () => {
							if (start >= end) return new Uint8Array();
							const first = Math.floor(start / PLAIN_CHUNK);
							const last = Math.floor((end - 1) / PLAIN_CHUNK);
							const cipher = await file.slice(HEADER_LEN + first * CIPHER_CHUNK, HEADER_LEN + (last + 1) * CIPHER_CHUNK).arrayBuffer();
							const plain = await k.decryptChunks(new Uint8Array(cipher), first, header);
							return plain.subarray(start - first * PLAIN_CHUNK, end - first * PLAIN_CHUNK);
						})
				};
			}),

		writable: (path) =>
			run(path, async (k) => {
				const at = await locate(k, path);
				return memoryWritable(async (plain) => {
					const encrypted = await k.encryptFile(plain);
					if (!at.long) return opfs.write(at.path, encrypted);
					await opfs.mkdir(at.path);
					await opfs.write(join(at.path, NAME_FILE), at.long);
					await opfs.write(join(at.path, CONTENTS_FILE), encrypted);
				});
			}),

		mkdir: (path) => run(path, async (k) => makeFolder(k, await locate(k, path))),

		remove: (path) =>
			run(path, async (k) => {
				let at: Located;
				try {
					at = await locate(k, path);
				} catch (e) {
					if (e instanceof FilesError && e.code === 'notFound') return;
					throw e;
				}
				if (!(await opfs.stat(at.path))) return;
				const id = await dirIdOf(at.path);
				if (id !== null) await dropFolder(k, id);
				await opfs.remove(at.path);
			}),

		move: (from, to) =>
			run(from, async (k) => {
				const a = await locate(k, from);
				const b = await locate(k, to);
				const folder = (await dirIdOf(a.path)) !== null;
				if (folder || (a.long && b.long)) {
					// A folder entry (or a long name) moves as a whole; its name file is written anew
					await opfs.move(a.path, b.path);
					if (b.long) await opfs.write(join(b.path, NAME_FILE), b.long);
					else if (a.long) await opfs.remove(join(b.path, NAME_FILE));
				} else if (b.long) {
					await opfs.mkdir(b.path);
					await opfs.write(join(b.path, NAME_FILE), b.long);
					await opfs.move(dataOf(a), join(b.path, CONTENTS_FILE));
					if (a.long) await opfs.remove(a.path);
				} else {
					await opfs.move(dataOf(a), b.path);
					if (a.long) await opfs.remove(a.path);
				}
			}),

		trash: (path) =>
			run(path, async (k) => {
				const ref = await trashInTree(opfsTree, (await locate(k, path)).path);
				return { entry: ref.entry, path };
			}),

		untrash: (ref) =>
			run(ref.path, async (k) => {
				const at = await locate(k, ref.path);
				if (await opfs.stat(at.path)) throw new FilesError('exists', ref.path);
				await untrashInTree(opfsTree, { entry: ref.entry, path: at.path });
			})
	};
}

// --- The format ---

const masterkeyOf = async (folder: string) => parseMasterkeyFile(await text(join(folder, MASTERKEY_FILE)));

/** Keys derived from a master key, once per unlocked key object (`keys.ts` keeps one per folder) */
const derived = new WeakMap<Uint8Array, Promise<CryptomatorKeys>>();

export const cryptomatorFormat: VaultFormat = {
	id: 'cryptomator',
	name: 'Cryptomator',
	async detect(folder) {
		const [config, masterkey, data] = await Promise.all([
			opfs.stat(join(folder, CONFIG_FILE)),
			opfs.stat(join(folder, MASTERKEY_FILE)),
			opfs.stat(join(folder, DATA_DIR))
		]);
		return config?.kind === 'file' && masterkey?.kind === 'file' && data?.kind === 'directory';
	},
	async fingerprint(folder) {
		// A vault this can't open (Hub, an older format) says so before its password is asked
		checkConfig(await text(join(folder, CONFIG_FILE)));
		return fingerprintOf(await masterkeyOf(folder));
	},
	async unlock(folder, password) {
		const config = await text(join(folder, CONFIG_FILE));
		checkConfig(config);
		const master = await unlockMasterkey(await masterkeyOf(folder), password);
		await verifyConfig(config, master);
		return master;
	},
	async create(folder, password) {
		const master = newMasterkey();
		const files = await newVaultFiles(master, password);
		await opfs.mkdir(folder);
		await opfs.write(join(folder, MASTERKEY_FILE), files.masterkey);
		await opfs.write(join(folder, CONFIG_FILE), files.config);
		// The top folder's own folder under `d/`, with the backup of its id (`""`)
		const keys = await CryptomatorKeys.create(master, 220);
		const top = join(folder, await keys.dirPath(''));
		await opfs.mkdir(top);
		await opfs.write(join(top, DIR_ID_BACKUP), await keys.encryptFile(new Uint8Array()));
		return master;
	},
	// Cryptomator's recovery key is a list of words of its own; a vault made here gets one in Cryptomator
	showKey: () => null,
	source: (folder, master) =>
		vaultSource(folder, async () => {
			const key = await master();
			let keys = derived.get(key);
			if (!keys) {
				keys = text(join(folder, CONFIG_FILE)).then(async (config) => CryptomatorKeys.create(key, (await verifyConfig(config, key)).threshold));
				keys.catch(() => derived.delete(key));
				derived.set(key, keys);
			}
			return keys;
		})
};

