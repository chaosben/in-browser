import { deleteMediaFile, saveProject } from '#lib/storage/opfs.js';
import { addItem, clipsOf, findItem, groupOf, isClip, setTrackState } from '#lib/timeline/ops.js';
import { createClip } from './defaults.js';
import { pruneHistory } from './history.js';
import { canvasSize, placeRecording, placeSource, recordingSources, type Recording } from './project.js';
import type { Item, Project, Selection, Source, Timeline, TrackState } from './types.js';
import { m } from '#lib/i18n/index.js';
import { parseColor } from '#lib/util/color.js';

const HISTORY_LIMIT = 100;

/**
 * Holds the open project. Timeline changes go through `update`, which maintains undo/redo
 * and saves automatically (debounced). The project is only ever replaced immutably.
 */
export class Editor {
	project: Project = $state.raw()!;
	selection = $state<Selection>(null);
	saving = $state(false);

	#undo = $state.raw<Timeline[]>([]);
	#redo = $state.raw<Timeline[]>([]);
	#lastMergeKey: string | null = null;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * @param onTimelineChange called after every change; `clipsChanged` is false if only annotations,
	 * zoom or the background changed (then redrawing the preview is enough).
	 */
	constructor(
		project: Project,
		private onTimelineChange: (clipsChanged: boolean) => void = () => {}
	) {
		this.project = project;
	}

	get canUndo() {
		return this.#undo.length > 0;
	}

	get canRedo() {
		return this.#redo.length > 0;
	}

	/** IDs of the selected items on the tracks */
	get selectedIds(): string[] {
		const s = this.selection;
		return s?.kind === 'items' ? s.ids : [];
	}

	get selectedItems(): Item[] {
		return this.selectedIds.map((id) => findItem(this.project.timeline, id)).filter((item) => !!item);
	}

	/**
	 * The item whose properties are being edited: the clicked one (even if its group is selected
	 * too) or the only selected one.
	 */
	get selectedItem() {
		const s = this.selection;
		if (s?.kind !== 'items') return null;
		const id = s.primary && s.ids.includes(s.primary) ? s.primary : s.ids.length === 1 ? s.ids[0] : null;
		return id ? (findItem(this.project.timeline, id) ?? null) : null;
	}

	get selectedClip() {
		const item = this.selectedItem;
		return item && isClip(item) ? item : null;
	}

	get selectedOverlay() {
		const item = this.selectedItem;
		return item?.type === 'annotation' ? item : null;
	}

	get selectedZoom() {
		const s = this.selection;
		return s?.kind === 'zoom' ? (this.project.timeline.zoom.find((z) => z.id === s.id) ?? null) : null;
	}

	/** Colors used in the project (`#rrggbb`, without opacity), offered for reuse in the color fields */
	get colors(): string[] {
		const values: (string | null)[] = [];
		for (const item of this.project.timeline.items) {
			if (item.type !== 'annotation') continue;
			if ('color' in item) values.push(item.color);
			if ('background' in item) values.push(item.background);
		}
		values.push(this.project.background);
		return [...new Set(values.filter((v) => v !== null).map((v) => parseColor(v).hex))];
	}

	/** Selects exactly one item or zoom segment */
	select(kind: 'item' | 'zoom', id: string) {
		this.selection = kind === 'zoom' ? { kind, id } : { kind: 'items', ids: [id] };
	}

	selectItems(ids: string[], primary?: string) {
		this.selection = ids.length ? { kind: 'items', ids, primary } : null;
	}

	/**
	 * Click on an item: selects it along with its group (`single`: only the item). `additive` adds to the
	 * selection, or removes it again if all of it was already selected.
	 */
	clickItem(id: string, { single = false, additive = false } = {}) {
		const ids = single ? [id] : groupOf(this.project.timeline, id);
		if (!additive) return this.selectItems(ids, id);
		const current = this.selectedIds;
		const all = ids.every((i) => current.includes(i));
		if (all) this.selectItems(current.filter((i) => !ids.includes(i)));
		else this.selectItems([...new Set([...current, ...ids])], id);
	}

	isSelected(kind: 'item' | 'zoom', id: string) {
		const s = this.selection;
		if (s?.kind === 'zoom') return kind === 'zoom' && s.id === id;
		return kind === 'item' && !!s?.ids.includes(id);
	}

	source(id: string): Source | undefined {
		return this.project.sources.find((s) => s.id === id);
	}

	/**
	 * Changes the timeline. Consecutive calls with the same `mergeKey` (e.g. during a mouse drag)
	 * form one undo step; `fn` is always applied to the state before the gesture, so intermediate
	 * steps (e.g. annotations cut away along the way) don't destroy anything.
	 */
	update(fn: (timeline: Timeline) => Timeline, mergeKey?: string) {
		const before = this.project.timeline;
		const merging = !!mergeKey && mergeKey === this.#lastMergeKey && this.#undo.length > 0;
		const base = merging ? this.#undo.at(-1)! : before;
		const after = fn(base);
		if (after === before) return;
		if (!merging) this.#undo = [...this.#undo, before].slice(-HISTORY_LIMIT);
		this.#lastMergeKey = mergeKey ?? null;
		this.#redo = [];
		this.#setTimeline(after, before);
	}

	/** Ends a gesture: the next change becomes its own undo step, even with the same `mergeKey`. */
	endGesture() {
		this.#lastMergeKey = null;
	}

	undo() {
		const previous = this.#undo.at(-1);
		if (!previous) return;
		this.#undo = this.#undo.slice(0, -1);
		this.#redo = [...this.#redo, this.project.timeline];
		this.#lastMergeKey = null;
		this.#setTimeline(previous, this.project.timeline);
	}

	redo() {
		const next = this.#redo.at(-1);
		if (!next) return;
		this.#redo = this.#redo.slice(0, -1);
		this.#undo = [...this.#undo, this.project.timeline];
		this.#lastMergeKey = null;
		this.#setTimeline(next, this.project.timeline);
	}

	rename(name: string) {
		this.project = { ...this.project, name: name.trim() || m.common.untitled };
		this.#scheduleSave();
	}

	/** Canvas background color (`#rrggbb`) */
	setBackground(color: string) {
		this.project = { ...this.project, background: color };
		this.onTimelineChange(false);
		this.#scheduleSave();
	}

	setTrackState(track: number, patch: Partial<TrackState>) {
		this.update((t) => setTrackState(t, track, patch));
	}

	/** New sources into the media bin; the first one with a picture sets the working resolution. */
	#addSources(sources: Source[]) {
		const first = !this.project.sources.some((s) => s.hasVideo) && sources.some((s) => s.hasVideo);
		this.project = {
			...this.project,
			sources: [...this.project.sources, ...sources],
			...(first && canvasSize(sources))
		};
	}

	/**
	 * Adds an imported source: videos appended at the end of track 0, audio-only sources at `at`
	 * (start or drop position on the timeline) in front of everything already there.
	 */
	addSource(source: Source, at = 0) {
		this.#addSources([source]);
		const { width, height } = this.project;
		this.update((t) => placeSource(t, source, width, height, at));
	}

	/** Adds a recording (screen, optionally webcam and microphone, linked). */
	addRecording(recording: Recording) {
		this.#addSources(recordingSources(recording));
		const { width, height } = this.project;
		this.update((t) => placeRecording(t, recording, width, height));
	}

	/** Inserts a source at `at` – on a track in front of everything already there – and selects it. */
	insertSource(sourceId: string, at: number) {
		const source = this.source(sourceId);
		if (!source) return;
		const clip = createClip(source, this.project.width, this.project.height, at);
		this.update((t) => addItem(t, clip));
		this.select('item', clip.id);
	}

	/** Is the source used in the timeline or in the undo/redo history? */
	isSourceInTimeline(sourceId: string) {
		return usesSource(this.project.timeline, sourceId);
	}

	/** Is the source only kept alive by the undo/redo history? */
	isSourceInHistory(sourceId: string) {
		const uses = (t: Timeline) => usesSource(t, sourceId);
		return this.#undo.some(uses) || this.#redo.some(uses);
	}

	/**
	 * Permanently deletes a source (including its file) that is not in the timeline. History steps that still
	 * use it are dropped, so undo can no longer bring it back.
	 */
	async removeSource(sourceId: string) {
		const source = this.source(sourceId);
		if (!source || this.isSourceInTimeline(sourceId)) return;
		const pruned = pruneHistory(this.#undo, this.#redo, (t) => usesSource(t, sourceId));
		this.#undo = pruned.undo;
		this.#redo = pruned.redo;
		this.#lastMergeKey = null;
		this.project = { ...this.project, sources: this.project.sources.filter((s) => s.id !== sourceId) };
		await this.save();
		await deleteMediaFile(this.project.id, source.file);
	}

	#setTimeline(timeline: Timeline, previous: Timeline) {
		this.project = { ...this.project, timeline };
		const s = this.selection;
		if (s) {
			if (s.kind === 'zoom') {
				if (!timeline.zoom.some((z) => z.id === s.id)) this.selection = null;
			} else {
				const ids = s.ids.filter((id) => timeline.items.some((item) => item.id === id));
				if (ids.length !== s.ids.length) this.selectItems(ids, s.primary);
			}
		}
		this.onTimelineChange(clipsChanged(timeline, previous));
		this.#scheduleSave();
	}

	#scheduleSave() {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.save(), 400);
	}

	async save() {
		clearTimeout(this.#saveTimer);
		this.saving = true;
		try {
			this.project = { ...this.project, updatedAt: Date.now() };
			await saveProject(this.project);
		} finally {
			this.saving = false;
		}
	}
}

const usesSource = (t: Timeline, sourceId: string) => clipsOf(t).some((c) => c.sourceId === sourceId);

/** Have clips changed in time? Position/size in the frame (`rect`) alone doesn't count – redrawing is enough. */
function clipsChanged(a: Timeline, b: Timeline) {
	const key = (t: Timeline) =>
		clipsOf(t)
			.map(({ rect: _rect, ...timing }) => JSON.stringify(timing))
			.join();
	return a.items !== b.items && key(a) !== key(b);
}
