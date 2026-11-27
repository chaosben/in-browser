import { debug } from '@in-browser/brand/debug.js';
import { FilesError, type Entry } from '../../entry.js';
import * as opfs from '../../opfs.js';
import { basename, join, parent, segments } from '../../path.js';
import { opfsTree } from '../../sync/opfs-tree.js';
import { trashInTree, untrashInTree } from '../../trash.js';
import type { RandomAccess, Source } from '../source.js';
import {
	cipherNameKind,
	CONFIG_FILE,
	DIRIV_FILE,
	formatMasterKey,
	GocryptfsKeys,
	HEADER_LEN,
	longNameFile,
	newConfig,
	newDirIV,
	newMasterKey,
	parseConfig,
	parseDirIV,
	PLAIN_BS,
	plainSize,
	unlockMasterKey,
	VaultFormatError
} from './gocryptfs.js';
import type { VaultFormat } from './formats.js';
import { memoryWritable } from './memory-writable.js';

// The gocryptfs format behind `VaultFormat` (`formats.ts`), and an encrypted folder of My files in it (`gocryptfs.ts`)
// as a connected source: the decrypted view of the folder
// at `root`. Only the encrypted form is ever written, through `opfs.ts` – so the syncs carry it like any folder and
// see nothing else, and no plain content is kept anywhere: a file being written is collected in memory, never in a
// temporary file. `keys` throws `locked` while the folder isn't unlocked in this browser.
//
// Deleting moves the encrypted item into the trash of My files (where it shows with its encrypted name). A long
// name's `.name` file stays in place meanwhile, so restoring finds it.

interface Located {
	/** Encrypted path in My files */
	path: string;
	/** Encrypted folder it lies in */
	folder: string;
	/** Name of the entry in that folder */
	stored: string;
	/** Long names: the encrypted name, kept in `<stored>.name` */
	long: string | null;
}

export function vaultSource(root: string, keys: () => Promise<GocryptfsKeys>): Source {
	let warned = false;

	async function dirIV(folder: string): Promise<Uint8Array> {
		return parseDirIV(new Uint8Array(await (await opfs.read(join(folder, DIRIV_FILE))).arrayBuffer()));
	}

	/** The encrypted place of `path` (not the root); its folders are read anew every time – a folder deleted and made
	 * again elsewhere has another diriv, and a remembered one would encrypt names no one could read */
	async function locate(k: GocryptfsKeys, path: string): Promise<Located> {
		let folder = root;
		const names = segments(path);
		for (const [i, name] of names.entries()) {
			const { stored, long } = await k.encryptName(name, await dirIV(folder));
			if (i === names.length - 1) return { path: join(folder, stored), folder, stored, long };
			folder = join(folder, stored);
		}
		throw new FilesError('root', path);
	}

	/** Runs an action; its errors name the plain path (never an encrypted one) */
	async function run<T>(path: string, action: (k: GocryptfsKeys) => Promise<T>): Promise<T> {
		const k = await keys();
		try {
			return await action(k);
		} catch (e) {
			if (e instanceof FilesError) throw new FilesError(e.code, path);
			// Damaged, or changed by something that doesn't know the key: never shown as something else
			if (e instanceof VaultFormatError || (e instanceof DOMException && e.name === 'OperationError')) {
				console.warn('[vault]', path, e);
				throw new FilesError('damaged', path);
			}
			throw e;
		}
	}

	async function entryOf(k: GocryptfsKeys, folder: string, entry: Entry, iv: Uint8Array, path: string): Promise<Entry | null> {
		const kind = cipherNameKind(entry.name);
		if (kind === 'internal') return null;
		let encrypted = entry.name;
		if (kind === 'long') {
			const file = await opfs.stat(join(folder, longNameFile(entry.name)));
			if (file?.kind !== 'file') return null;
			encrypted = await (await opfs.read(file.path)).text();
		}
		const name = await k.decryptName(encrypted, iv);
		if (!name) {
			// A conflict copy of a sync, a file another program put there: not part of the encrypted folder
			if (!warned) debug('[vault] entries that are not encrypted names are left out, e.g.', entry.name);
			warned = true;
			return null;
		}
		const at = join(path, name);
		return entry.kind === 'directory'
			? { name, path: at, kind: 'directory' }
			: { name, path: at, kind: 'file', size: plainSize(entry.size ?? 0, k.cipherBS), modified: entry.modified };
	}

	return {
		caps: { readOnly: false, trash: true },

		list: (path) =>
			run(path, async (k) => {
				const folder = path === '/' ? root : (await locate(k, path)).path;
				const iv = await dirIV(folder);
				const entries = await Promise.all((await opfs.list(folder)).map((entry) => entryOf(k, folder, entry, iv, path)));
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
				const entry = await opfs.stat(at.path);
				if (!entry) return null;
				return entry.kind === 'directory'
					? { name: basename(path), path, kind: 'directory' }
					: { name: basename(path), path, kind: 'file', size: plainSize(entry.size ?? 0, k.cipherBS), modified: entry.modified };
			}),

		read: (path) =>
			run(path, async (k) => {
				const file = await opfs.read((await locate(k, path)).path);
				const plain = await k.decryptFile(new Uint8Array(await file.arrayBuffer()));
				return new File([plain], basename(path), { lastModified: file.lastModified });
			}),

		open: (path) =>
			run(path, async (k): Promise<RandomAccess> => {
				const file = await opfs.read((await locate(k, path)).path);
				const id = k.fileId(new Uint8Array(await file.slice(0, HEADER_LEN).arrayBuffer()), file.size);
				const size = plainSize(file.size, k.cipherBS);
				return {
					size,
					type: '',
					modified: file.lastModified,
					read: (start, end) =>
						run(path, async () => {
							if (!id || start >= end) return new Uint8Array();
							const first = Math.floor(start / PLAIN_BS);
							const last = Math.floor((end - 1) / PLAIN_BS);
							const cipher = await file.slice(HEADER_LEN + first * k.cipherBS, HEADER_LEN + (last + 1) * k.cipherBS).arrayBuffer();
							const plain = await k.decryptBlocks(new Uint8Array(cipher), first, id);
							return plain.subarray(start - first * PLAIN_BS, end - first * PLAIN_BS);
						})
				};
			}),

		writable: (path) =>
			run(path, async (k) => {
				const at = await locate(k, path);
				return memoryWritable(async (plain) => {
					if (at.long) await opfs.write(join(at.folder, longNameFile(at.stored)), at.long);
					await opfs.write(at.path, await k.encryptFile(plain));
				});
			}),

		mkdir: (path) =>
			run(path, async (k) => {
				const at = await locate(k, path);
				if (at.long) await opfs.write(join(at.folder, longNameFile(at.stored)), at.long);
				await opfs.mkdir(at.path);
				await opfs.write(join(at.path, DIRIV_FILE), newDirIV());
			}),

		remove: (path) =>
			run(path, async (k) => {
				let at: Located;
				try {
					at = await locate(k, path);
				} catch (e) {
					if (e instanceof FilesError && e.code === 'notFound') return;
					throw e;
				}
				await opfs.remove(at.path);
				if (at.long) await opfs.remove(join(at.folder, longNameFile(at.stored)));
			}),

		move: (from, to) =>
			run(from, async (k) => {
				const a = await locate(k, from);
				const b = await locate(k, to);
				if (b.long) await opfs.write(join(b.folder, longNameFile(b.stored)), b.long);
				await opfs.move(a.path, b.path);
				if (a.long && a.path !== b.path) await opfs.remove(join(a.folder, longNameFile(a.stored)));
			}),

		trash: (path) =>
			run(path, async (k) => {
				const ref = await trashInTree(opfsTree, (await locate(k, path)).path);
				// The plain path: for the message and for putting it back (its folder's diriv gives the name again)
				return { entry: ref.entry, path };
			}),

		untrash: (ref) =>
			run(ref.path, async (k) => {
				const at = await locate(k, ref.path);
				// Under another name it couldn't be decrypted: something new of that name keeps it in the trash
				if (await opfs.stat(at.path)) throw new FilesError('exists', ref.path);
				if (!(await opfs.stat(parent(at.path)))) throw new FilesError('notFound', ref.path);
				await untrashInTree(opfsTree, { entry: ref.entry, path: at.path });
			})
	};
}

// --- The format ---

async function configOf(folder: string) {
	return parseConfig(await (await opfs.read(join(folder, CONFIG_FILE))).text());
}

/** Keys derived from a master key, once per unlocked key object (`keys.ts` keeps one per folder) */
const derived = new WeakMap<Uint8Array, Promise<GocryptfsKeys>>();

export const gocryptfsFormat: VaultFormat = {
	id: 'gocryptfs',
	name: 'gocryptfs',
	async detect(folder) {
		const [config, diriv] = await Promise.all([opfs.stat(join(folder, CONFIG_FILE)), opfs.stat(join(folder, DIRIV_FILE))]);
		return config?.kind === 'file' && diriv?.kind === 'file';
	},
	async fingerprint(folder) {
		const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', (await configOf(folder)).encryptedKey as Uint8Array<ArrayBuffer>));
		return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
	},
	async unlock(folder, password) {
		return unlockMasterKey(await configOf(folder), password);
	},
	async create(folder, password) {
		const master = newMasterKey();
		await opfs.mkdir(folder);
		await opfs.write(join(folder, DIRIV_FILE), newDirIV());
		await opfs.write(join(folder, CONFIG_FILE), await newConfig(master, password));
		return master;
	},
	showKey: formatMasterKey,
	source: (folder, master) =>
		vaultSource(folder, async () => {
			const key = await master();
			let keys = derived.get(key);
			if (!keys) {
				keys = configOf(folder).then((config) => GocryptfsKeys.create(key, config));
				// A failed derivation (folder gone) is tried again next time
				keys.catch(() => derived.delete(key));
				derived.set(key, keys);
			}
			return keys;
		})
};
