// The global library: entries usable in all projects, stored in the OPFS together with copies of the media files
// they use. Other tabs hear about changes and reload.
import {
	deleteLibraryMedia,
	libraryMediaWritable,
	loadLibrary,
	mediaFile,
	saveLibrary
} from '#lib/storage/opfs.js';
import { m } from '#lib/i18n/index.js';
import { unusedFiles } from './library.js';
import { copyMedia, type ItemsWithMedia } from './transfer.js';
import { newId, type LibraryEntry } from './types.js';

const CHANNEL = 'screen-capture:library';

class GlobalLibrary {
	entries = $state.raw<LibraryEntry[]>([]);
	#channel: BroadcastChannel | null = null;
	#loading: Promise<void> | null = null;

	/** Loads once (and again when another tab changed it) */
	load() {
		if (!this.#channel && typeof BroadcastChannel !== 'undefined') {
			this.#channel = new BroadcastChannel(CHANNEL);
			this.#channel.onmessage = () => {
				this.#loading = null;
				this.load();
			};
		}
		this.#loading ??= loadLibrary().then(
			(entries) => {
				this.entries = entries;
			},
			(e) => {
				this.#loading = null;
				throw e;
			}
		);
		return this.#loading;
	}

	async #commit(entries: LibraryEntry[]) {
		this.entries = entries;
		await saveLibrary(entries);
		this.#channel?.postMessage('changed');
	}

	/** Adds a copy of `data` from project `projectId`; media files the library lacks are copied into it */
	async add(name: string, data: ItemsWithMedia, projectId: string) {
		await this.load();
		const has = new Set(this.entries.flatMap((e) => [...e.sources, ...e.images].map((m) => m.id)));
		const missing = [...data.sources, ...data.images].filter((m) => !has.has(m.id));
		const copied = await copyMedia(missing, (file) => mediaFile(projectId, file), libraryMediaWritable);
		if (copied.size < missing.length) throw new Error(m.errors.libraryMedia);
		const entry: LibraryEntry = { id: newId(), name, ...$state.snapshot(data) };
		await this.#commit([...this.entries, entry]);
		return entry;
	}

	async rename(id: string, name: string) {
		await this.#commit(this.entries.map((e) => (e.id === id ? { ...e, name } : e)));
	}

	/** Removes an entry and the media files no other entry uses */
	async remove(id: string) {
		const entry = this.entries.find((e) => e.id === id);
		if (!entry) return;
		const rest = this.entries.filter((e) => e.id !== id);
		await this.#commit(rest);
		await Promise.all(unusedFiles(rest, entry).map(deleteLibraryMedia));
	}
}

export const globalLibrary = new GlobalLibrary();
