// The open backup or playlist: its data as read, every change an undo step, saved 1.5 s after a change (right away
// when the page is hidden or left). Saving writes the whole file anew – into a copy of its own database, so what
// JW Library keeps there stays – and only when the file is still the one read; otherwise `conflict` pauses saving.

import { DEVICE_NAME, jwlBlob, readJwl, type JwlFile } from '@in-browser/jwl/jwl-file.js';
import { playlists } from '@in-browser/jwl/edits.js';
import { difference, mergeFiles, sameContent } from '@in-browser/jwl/merge.js';
import type { JwlData } from '@in-browser/jwl/model.js';
import { reportSaveFailure } from '@in-browser/files/documents.js';
import { read, stat, write } from '@in-browser/files/fs.js';
import { basename } from '@in-browser/files/path.js';

const SAVE_AFTER = 1500;
const HISTORY = 100;

interface Step {
	data: JwlData;
	files: Map<string, Blob>;
	template: Uint8Array;
}

/** What “Merge with …” did: counts against the data before, and how many entries both files had differently */
export interface MergeSummary {
	added: number;
	changed: number;
	conflicts: number;
}

export class JwlDocument {
	readonly path: string;
	readonly name: string;
	readonly file: JwlFile;
	data = $state.raw<JwlData>(null!);
	/** The archive's files by hash, with those added since */
	files = $state.raw<Map<string, Blob>>(new Map());
	/** The database the file is written into: its own, or a merged file's of a newer schema */
	private template: Uint8Array;
	/** When this document's content was last changed (ms): the file's time, then each change's */
	private changed: number;
	dirty = $state(false);
	saving = $state(false);
	saveError = $state<string | null>(null);
	/** The file changed elsewhere while this had unsaved changes */
	conflict = $state<'changed' | null>(null);
	private undoStack = $state.raw<Step[]>([]);
	private redoStack = $state.raw<Step[]>([]);
	private stamp: { size: number; modified: number | null };
	private timer: ReturnType<typeof setTimeout> | null = null;
	private pending: Promise<void> | null = null;

	private constructor(path: string, file: JwlFile, stamp: { size: number; modified: number | null }) {
		this.path = path;
		this.name = basename(path);
		this.file = file;
		this.data = file.data;
		this.files = file.files;
		this.template = file.database;
		this.changed = file.modified;
		this.stamp = stamp;
	}

	static async open(path: string): Promise<JwlDocument> {
		const entry = await stat(path);
		const file = await readJwl(await read(path));
		return new JwlDocument(path, file, { size: entry?.size ?? 0, modified: entry?.modified ?? null });
	}

	get kind() {
		return this.file.kind;
	}

	get canUndo() {
		return this.undoStack.length > 0;
	}

	get canRedo() {
		return this.redoStack.length > 0;
	}

	/** One change: the data before it is the undo step */
	change(data: JwlData, files: Map<string, Blob> = this.files, template: Uint8Array = this.template) {
		if (data === this.data && files === this.files) return;
		this.undoStack = [...this.undoStack.slice(-HISTORY + 1), this.step()];
		this.redoStack = [];
		this.set({ data, files, template });
	}

	undo() {
		const step = this.undoStack.at(-1);
		if (!step) return;
		this.undoStack = this.undoStack.slice(0, -1);
		this.redoStack = [...this.redoStack, this.step()];
		this.set(step);
	}

	redo() {
		const step = this.redoStack.at(-1);
		if (!step) return;
		this.redoStack = this.redoStack.slice(0, -1);
		this.undoStack = [...this.undoStack, this.step()];
		this.set(step);
	}

	private step(): Step {
		return { data: this.data, files: this.files, template: this.template };
	}

	private set(step: Step) {
		this.data = step.data;
		this.files = step.files;
		this.template = step.template;
		this.changed = Date.now();
		this.dirty = true;
		this.schedule();
	}

	/**
	 * “Merge with …”: what another backup has is taken into this one as one change (two ways, `jwl.md` “Merging”):
	 * what only one has is kept, where both differ the newer counts. Null when this one has everything already.
	 */
	merge(other: JwlFile): MergeSummary | null {
		const result = mergeFiles({ name: 'mine', time: this.changed, data: this.data }, { name: 'incoming', time: other.modified, data: other.data }, {
			has: (hash) => this.files.has(hash) || other.files.has(hash)
		});
		if (sameContent(result.data, this.data)) return null;
		const counts = difference(this.data, result.data);
		// The newer schema's database takes the result, so nothing of the newer file is left out
		const template = other.data.schema > this.data.schema ? other.database : this.template;
		this.change(result.data, new Map([...other.files, ...this.files]), template);
		return { added: counts.added, changed: counts.changed, conflicts: result.stats.conflicts };
	}

	private schedule() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.save(), SAVE_AFTER);
	}

	/** Saves now what waits (page hidden or left) */
	flush(): Promise<void> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		return this.dirty ? this.save() : (this.pending ?? Promise.resolve());
	}

	/** The playlist's name of a `.jwlplaylist` (its one playlist) */
	private playlistName(): string {
		return playlists(this.data)[0]?.name ?? this.name.replace(/\.jwlplaylist$/i, '');
	}

	async save(): Promise<void> {
		if (this.pending) {
			await this.pending;
			if (!this.dirty) return;
		}
		if (this.conflict) return;
		const data = this.data;
		const files = this.files;
		const template = this.template;
		this.saving = true;
		this.pending = (async () => {
			try {
				const now = await stat(this.path);
				if (!now || now.size !== this.stamp.size || now.modified !== this.stamp.modified) {
					this.conflict = 'changed';
					return;
				}
				const blob = await jwlBlob({
					kind: this.kind,
					name: this.playlistName(),
					deviceName: DEVICE_NAME,
					data,
					template,
					files
				});
				await write(this.path, blob);
				const written = await stat(this.path);
				this.stamp = { size: written?.size ?? blob.size, modified: written?.modified ?? null };
				if (this.data === data && this.files === files) this.dirty = false;
				this.saveError = null;
			} catch (e) {
				console.error('[jwl] save', e);
				reportSaveFailure(this, e, () => void this.save());
			} finally {
				this.saving = false;
				this.pending = null;
			}
		})();
		await this.pending;
		if (this.dirty && !this.conflict && !this.saveError) this.schedule();
	}

	/** Whether the file on disk is still the one read or last written */
	async unchanged(): Promise<boolean> {
		const now = await stat(this.path);
		return !!now && now.size === this.stamp.size && now.modified === this.stamp.modified;
	}

	/**
	 * A change was announced (`watch`): was it someone else's? The announcement of this document's own save comes while
	 * the save still runs – before the stamp is the new one –, so it is compared only once a running save is done.
	 * `conflict`: changed elsewhere while this has unsaved changes (saving pauses); `reload`: the version saved
	 * elsewhere may be shown.
	 */
	async external(paths: string[]): Promise<'none' | 'conflict' | 'reload'> {
		if (!paths.includes(this.path)) return 'none';
		await this.pending;
		if (await this.unchanged()) return 'none';
		if (this.dirty) {
			this.conflict = 'changed';
			return 'conflict';
		}
		return 'reload';
	}

	/** “Keep my version”: the file is written from this one */
	async keepMine() {
		const now = await stat(this.path);
		this.stamp = { size: now?.size ?? 0, modified: now?.modified ?? null };
		this.conflict = null;
		this.dirty = true;
		await this.save();
	}

	dispose() {
		if (this.timer) clearTimeout(this.timer);
	}
}
