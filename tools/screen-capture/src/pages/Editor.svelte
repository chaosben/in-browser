<script lang="ts">
	import { untrack } from 'svelte';
	import { innerHeight } from 'svelte/reactivity/window';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { BRAND, editorUrl } from '#lib/brand.js';
	import CanvasDialog from '#lib/components/CanvasDialog.svelte';
	import { setBrandBar, startRename } from '@in-browser/brand/brand-bar.svelte.js';
	import ExportDialog from '#lib/components/ExportDialog.svelte';
	import HelpWindow from '#lib/components/HelpWindow.svelte';
	import Inspector from '#lib/components/Inspector.svelte';
	import OverlayEditor from '#lib/components/OverlayEditor.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import ToolPanel from '#lib/components/ToolPanel.svelte';
	import ToolRail from '#lib/components/ToolRail.svelte';
	import { IMAGE_ACCEPT, importImage, isImageFile } from '#lib/media/images.js';
	import { importFile, isMediaFile, MEDIA_ACCEPT } from '#lib/media/media.js';
	import type { Recording } from '#lib/project/project.js';
	import { Player } from '#lib/preview/player.svelte.js';
	import { createIcon, createImage, createOverlay, createZoom, FREEZE_ICON } from '#lib/project/defaults.js';
	import { applyStyle, loadStyle } from '#lib/project/styles.js';
	import { Editor } from '#lib/project/editor.svelte.js';
	import type { Annotation, IconData, Point, Timeline as TimelineData, ToolKind } from '#lib/project/types.js';
	import { setImageProject } from '#lib/render/images.svelte.js';
	import { moveAnnotation, overlayBounds } from '#lib/render/overlays.js';
	import { hasDragPayload, readDragPayload, type DragPayload } from '#lib/tools/drag.js';
	import type { DropPlace, ToolActions } from '#lib/tools/types.js';
	import {
		chooseMediaFromFiles,
		cleanupMedia,
		libraryMediaFile,
		loadProject,
		mediaFile,
		PROJECT_EXT,
		projectFileDate,
		rememberProject
	} from '#lib/storage/store.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { PACKAGE_MANIFEST } from '@in-browser/files/formats.js';
	import { copy, watch } from '@in-browser/files/fs.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, join, normalize, parent } from '@in-browser/files/path.js';
	import {
		clampTimelineHeight,
		DEFAULT_TIMELINE_HEIGHT,
		loadTimelineHeight,
		storeTimelineHeight
	} from '#lib/ui/timeline-height.js';
	import {
		addItem,
		addZoom,
		bringForward,
		bringToFront,
		clipsAt,
		insertFreeze,
		itemEnd,
		nextStepNumber,
		remove,
		removeZoom,
		sendBackward,
		trackState,
		sendToBack,
		split,
		viewAt
	} from '#lib/timeline/ops.js';
	import { toolState } from '#lib/tools/state.svelte.js';
	import { snapping } from '#lib/ui/snapping.svelte.js';
	import { helpState } from '#lib/ui/help.svelte.js';
	import { openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { clipboard } from '#lib/project/clipboard.svelte.js';
	import { prepareMedia, type ItemsWithMedia } from '#lib/project/transfer.js';
	import { globalLibrary } from '#lib/project/library.svelte.js';
	import { mediaOf } from '#lib/project/library.js';
	import { libraryUi, saveSelection, type LibraryScope } from '#lib/ui/library.svelte.js';
	import LibrarySaveDialog from '#lib/components/LibrarySaveDialog.svelte';
	import DragGhost from '#lib/components/DragGhost.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';

	const FRAME = 1 / 30;

	let editor = $state<Editor | null>(null);
	let player = $state<Player | null>(null);
	let loadError = $state<string | null>(null);
	let dialog = $state<'record' | 'export' | null>(null);
	let importing = $state<{ name: string; progress: number } | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let timeline = $state<ReturnType<typeof Timeline>>();
	/** Height of the timeline (persisted); the preview gets the rest and never jumps when tracks are added */
	let timelineHeight = $state(loadTimelineHeight());
	const shownTimelineHeight = $derived(clampTimelineHeight(timelineHeight, innerHeight.current ?? 900));

	/** Dragging the splitter above the timeline changes its height; stored at the end */
	function resizeTimeline(e: PointerEvent) {
		if (e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const y0 = e.clientY;
		const h0 = shownTimelineHeight;
		const onmove = (ev: PointerEvent) => (timelineHeight = clampTimelineHeight(h0 - (ev.clientY - y0), innerHeight.current ?? 900));
		const onup = () => {
			el.removeEventListener('pointermove', onmove);
			el.removeEventListener('pointerup', onup);
			el.removeEventListener('pointercancel', onup);
			storeTimelineHeight(timelineHeight);
		};
		el.addEventListener('pointermove', onmove);
		el.addEventListener('pointerup', onup);
		el.addEventListener('pointercancel', onup);
	}

	function setTimelineHeight(px: number) {
		timelineHeight = clampTimelineHeight(px, innerHeight.current ?? 900);
		storeTimelineHeight(timelineHeight);
	}
	let freezeSeconds = $state(3);
	let draggingFiles = $state(false);
	/** A tile or media entry is dragged over the preview (highlighted as drop target) */
	let overPreview = $state(false);

	/** Holds the project's lock until the returned function is called; `null` if another tab holds it */
	function lockProject(path: string): Promise<(() => void) | null> {
		return new Promise((resolve) => {
			navigator.locks.request(`screen-capture:project:${path}`, { ifAvailable: true }, (lock) => {
				if (!lock) return resolve(null);
				return new Promise<void>((release) => resolve(release));
			});
		});
	}

	// The project of the address (`?path=` of its package): one tab at a time edits it (Web Lock); changes from
	// elsewhere (sync from another computer) reload it unless there are unsaved changes.
	$effect(() => {
		const param = page.url.searchParams.get('path');
		if (!param) return;
		const path = normalize(param);
		let ed: Editor | null = null;
		let pl: Player | null = null;
		let disposed = false;
		let release: (() => void) | null = null;
		let stopWatch: (() => void) | null = null;

		const close = () => {
			pl?.destroy();
			pl = null;
			editor = null;
			player = null;
		};

		async function open(): Promise<Editor | null> {
			const project = await loadProject(path);
			let next: Editor;
			const nextPlayer = new Player(() => next.project);
			next = new Editor(project, (clipsChanged) => (clipsChanged ? nextPlayer.refresh() : nextPlayer.redraw()));
			next.lastWrite = (await projectFileDate(path)) ?? 0;
			await nextPlayer.syncSources();
			if (disposed) {
				nextPlayer.destroy();
				return null;
			}
			close();
			ed = editor = next;
			pl = player = nextPlayer;
			return next;
		}

		async function checkExternal() {
			const date = await projectFileDate(path);
			if (!ed || date === undefined || date === ed.lastWrite || ed.saving) return;
			if (ed.dirty) {
				ed.lastWrite = date;
				return toast(m.editor.changedElsewhere, 'warning', 8000);
			}
			await open();
			toast(m.editor.reloaded, 'info');
		}

		(async () => {
			try {
				release = await lockProject(path);
				if (disposed) return release?.();
				if (!release) {
					loadError = m.editor.openElsewhere;
					return;
				}
				const opened = await open();
				if (!opened) return;
				rememberProject(path);
				// Remove leftover files (e.g. aborted recordings) in the background
				cleanupMedia(opened.project).catch(() => {});
				const manifest = join(path, PACKAGE_MANIFEST);
				stopWatch = watch((paths) => {
					if (paths.includes(manifest)) checkExternal().catch((e) => console.error(e));
				});
			} catch (e) {
				loadError = m.editor.loadFailed(errorMessage(e));
			}
		})();

		// Closing the tab: save what is still waiting (the 400 ms of the autosave)
		const flush = () => {
			if (ed?.dirty) ed.save();
		};
		window.addEventListener('pagehide', flush);
		return () => {
			disposed = true;
			window.removeEventListener('pagehide', flush);
			stopWatch?.();
			const last = ed;
			close();
			Promise.resolve(last?.dirty ? last.save() : undefined).finally(() => release?.());
		};
	});

	const previewSize = $derived.by(() => {
		if (!editor) return { width: 1280, height: 720 };
		const { width, height } = editor.project;
		const scale = Math.min(1, 1920 / width, 1080 / height);
		return { width: Math.round(width * scale), height: Math.round(height * scale) };
	});

	// Project name with its actions on the left of the BrandBar, help and export on the right
	$effect(() => {
		if (!editor || !player) return;
		const ed = editor;
		return setBrandBar({
			crumbs: [
				{
					label: ed.project.name,
					status: ed.saving ? m.common.saving : m.common.saved,
					rename: (name) => ed.rename(name),
					menu: [
						{ label: m.editor.rename, icon: 'icon-[material-symbols-light--edit-outline]', run: startRename },
						{ label: m.editor.saveAs, icon: 'icon-[material-symbols-light--save-as-outline]', run: saveAs }
					]
				}
			],
			actions: barActions
		});
	});

	// Pictures of image annotations are loaded from this project
	$effect(() => {
		if (editor) setImageProject(editor.project.id, editor.project.images);
	});

	// Setting the canvas size clears it (e.g. after growing the canvas or undoing that): draw again
	$effect(() => {
		void previewSize;
		untrack(() => player?.redraw());
	});

	/** Selected items on unlocked tracks */
	function editable() {
		if (!editor) return [];
		const timeline = editor.project.timeline;
		return editor.selectedItems.filter((item) => !trackState(timeline, item.track).locked);
	}

	/**
	 * Selected items under the playhead – cutting tools then only affect those; without any
	 * (`undefined`) they affect all clips under the playhead.
	 */
	function selectedAt(t: number) {
		const ids = editable()
			.filter((item) => item.start <= t && t <= itemEnd(item))
			.map((item) => item.id);
		return ids.length ? ids : undefined;
	}

	const hasVideo = (sourceId: string) => !!editor?.source(sourceId)?.hasVideo;

	function splitAtPlayhead() {
		if (!editor || !player) return;
		const t = player.time;
		const ids = selectedAt(t);
		editor.update((tl) => split(tl, t, ids));
	}

	function holdFrame() {
		if (!editor || !player) return;
		const t = player.time;
		const ids = selectedAt(t);
		editor.update((tl) => insertFreeze(tl, t, freezeSeconds, ids, hasVideo));
		const freeze = clipsAt(editor.project.timeline, t + 0.001).find((c) => c.type === 'freeze');
		if (freeze) editor.select('item', freeze.id);
		player.seek(t);
	}

	/** Annotation from a tool tile; same settings as the last annotation of this type */
	function addAnnotation(kind: ToolKind, at: DropPlace = {}) {
		if (!editor || !player) return;
		const start = at.start ?? player.time;
		placeAnnotation(applyStyle(createOverlay(kind, start, start + 3, nextStepNumber(editor.project.timeline)), loadStyle(kind)), at);
	}

	/** Own image from the media bin */
	function addImage(imageId: string, at: DropPlace = {}) {
		const image = editor?.image(imageId);
		if (!editor || !player || !image) return;
		const start = at.start ?? player.time;
		const { width, height } = editor.project;
		placeAnnotation(applyStyle(createImage(image, start, start + 3, width, height), loadStyle('image')), at);
	}

	function addIcon(icon: IconData, at: DropPlace = {}) {
		if (!editor || !player) return;
		const start = at.start ?? player.time;
		const { width, height } = editor.project;
		placeAnnotation(applyStyle(createIcon(icon, start, start + 3, width, height), loadStyle('icon')), at);
	}

	/** Adds a new annotation, centered on the drop point if there is one, and selects it */
	function placeAnnotation(overlay: Annotation, at: DropPlace) {
		if (!editor || !player) return;
		const start = overlay.start;
		if (at.point) {
			// Center on the drop point
			const b = overlayBounds(overlay, editor.project.width, editor.project.height);
			const move = moveAnnotation(overlay, at.point.x - (b.x + b.w / 2), at.point.y - (b.y + b.h / 2));
			overlay = { ...overlay, ...move } as Annotation;
		}
		editor.update((t) => addItem(t, overlay));
		editor.select('item', overlay.id);
		// Dropped onto the timeline: show it
		if (at.start !== undefined) player.seek(start);
	}

	/** Zoom section starting at the playhead (within the timeline) */
	function newZoomRange(length: number, start = player?.time ?? 0) {
		if (!player) return null;
		const end = Math.min(start + length, player.duration);
		if (end - start < 0.2) {
			toast(m.editor.playheadAtEnd, 'warning');
			return null;
		}
		return { start, end };
	}

	function addZoomSegment(at: DropPlace = {}) {
		const range = newZoomRange(4, at.start);
		if (!editor || !player || !range) return;
		const segment = createZoom(range.start, range.end);
		if (at.point) {
			// Centered on the drop point, within the frame
			const { w, h } = segment.rect;
			const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
			segment.rect = { w, h, x: clamp(at.point.x - w / 2, 1 - w), y: clamp(at.point.y - h / 2, 1 - h) };
		}
		editor.update((t) => addZoom(t, segment));
		if (editor.project.timeline.zoom.some((z) => z.id === segment.id)) editor.select('zoom', segment.id);
		else toast(m.editor.zoomExists, 'warning');
		if (at.start !== undefined) player.seek(range.start);
	}

	/** Deletes the selection (excluding locked tracks); later clips move up, with `gap` a gap remains. */
	function removeSelected(gap = false) {
		const s = editor?.selection;
		if (!editor || !s) return;
		if (s.kind === 'zoom') return editor.update((t) => removeZoom(t, s.id));
		const ids = editable().map((item) => item.id);
		const ed = editor;
		if (ids.length) ed.update((t) => remove(t, ids, !gap, (id) => !!ed.source(id)?.hasVideo));
	}

	function copySelected(items = editor?.selectedItems ?? []) {
		if (editor && items.length) clipboard.copy(editor.project, items);
	}

	function cutSelected() {
		copySelected(editable());
		removeSelected();
	}

	/**
	 * Inserts copied items at `at`; media they lack is copied into the project first (`read` opens it where it is,
	 * `null`: already in this project's folder)
	 */
	async function insertWithMedia(data: ItemsWithMedia, at: number, read: ((file: string) => Promise<File>) | null) {
		if (!editor || !data.items.length) return;
		const ed = editor;
		try {
			const { items, sources, images, skipped } = await prepareMedia(data, ed.project, read, () =>
				toast(m.editor.copyingMedia)
			);
			if (items.length) ed.paste(items, at, sources, images);
			if (sources.length) await sourcesAdded();
			if (skipped) toast(m.editor.pasteSkipped(skipped), 'warning', 6000);
		} catch (e) {
			console.error(e);
			toast(errorMessage(e), 'error', 8000);
		}
	}

	/** Pastes at the playhead; media from another project is copied into this one first */
	function paste() {
		const data = clipboard.data;
		if (!editor || !player || !data) return;
		const from = data.projectId;
		insertWithMedia(data, player.time, from === editor.project.id ? null : (file) => mediaFile(from, file));
	}

	function libraryEntry(scope: LibraryScope, id: string) {
		return (scope === 'project' ? editor?.project.library : globalLibrary.entries)?.find((e) => e.id === id);
	}

	/** Library entry at the playhead or the dropped time (it keeps its place in the picture) */
	async function insertLibrary(scope: LibraryScope, id: string, at?: DropPlace) {
		const entry = libraryEntry(scope, id);
		if (!editor || !player || !entry) return;
		const start = at?.start ?? player.time;
		await insertWithMedia(entry, start, scope === 'project' ? null : libraryMediaFile);
		if (at?.start !== undefined) player.seek(at.start);
	}

	/** Adds items to a library: in the project, or globally with copies of their media */
	async function addToLibrary(name: string, scope: LibraryScope, items: TimelineData['items']) {
		if (!editor) return;
		if (scope === 'project') editor.addToLibrary(name, items);
		else await globalLibrary.add(name, { items, ...mediaOf(items, editor.project.sources, editor.project.images) }, editor.project.id);
	}

	async function saveToLibrary(name: string, scope: LibraryScope, items: TimelineData['items']) {
		try {
			await addToLibrary(name, scope, items);
			libraryUi.scope = scope;
			toolState.group = 'library';
			toast(m.library.added(name), 'success');
		} catch (e) {
			console.error(e);
			toast(errorMessage(e), 'error', 8000);
		}
	}

	/** Copies or moves an entry into the other library; on errors it stays where it was */
	async function transferLibrary(scope: LibraryScope, id: string, move: boolean) {
		const entry = libraryEntry(scope, id);
		if (!editor || !entry) return;
		const ed = editor;
		const target: LibraryScope = scope === 'project' ? 'global' : 'project';
		try {
			if (target === 'global') await addToLibrary(entry.name, 'global', entry.items);
			else {
				const { items, sources, images, skipped } = await prepareMedia(entry, ed.project, libraryMediaFile, () =>
					toast(m.editor.copyingMedia)
				);
				// Not complete: keep the global entry
				if (skipped) return toast(m.editor.pasteSkipped(skipped), 'warning', 6000);
				ed.addMedia(sources, images);
				if (sources.length) await sourcesAdded();
				ed.addToLibrary(entry.name, items);
			}
			if (move) {
				if (scope === 'project') ed.removeLibraryEntry(id);
				else await globalLibrary.remove(id);
			}
			const where = target === 'project' ? m.library.project : m.library.global;
			toast(move ? m.library.moved(entry.name, where) : m.library.copied(entry.name, where), 'success');
		} catch (e) {
			console.error(e);
			toast(errorMessage(e), 'error', 8000);
		}
	}

	type Arrange = (timeline: TimelineData, id: string) => TimelineData;

	/** The selected item (on an unlocked track), if `op` would change its stacking order */
	function arrangeable(op: Arrange) {
		const item = editor?.selectedItem;
		if (!editor || !item || trackState(editor.project.timeline, item.track).locked) return null;
		return op(editor.project.timeline, item.id) === editor.project.timeline ? null : item;
	}

	/** Moves the selected item one layer (track) or all the way to the front or back */
	function arrange(op: Arrange) {
		const item = arrangeable(op);
		if (item) editor?.update((t) => op(t, item.id));
	}

	/**
	 * Context menu for the selection (preview and timeline). New functions for elements go here; `extra` adds
	 * entries of the place it was opened (e.g. the elements under the mouse pointer in the preview).
	 */
	function itemMenu(e: MouseEvent, extra: MenuEntry[] = []) {
		const items = editor?.selectedItems ?? [];
		const ctrl = m.keys.ctrl;
		openContextMenu(e, [
			{
				label: m.menu.cut,
				icon: 'icon-[material-symbols-light--content-cut]',
				keys: `${ctrl}+X`,
				disabled: !editable().length,
				run: cutSelected
			},
			{
				label: m.menu.copy,
				icon: 'icon-[material-symbols-light--content-copy]',
				keys: `${ctrl}+C`,
				disabled: !items.length,
				run: copySelected
			},
			{
				label: m.menu.paste,
				icon: 'icon-[material-symbols-light--content-paste]',
				keys: `${ctrl}+V`,
				disabled: clipboard.empty,
				run: paste
			},
			{
				label: m.menu.delete,
				icon: 'icon-[material-symbols-light--delete-outline]',
				keys: m.keys.del,
				disabled: !editor?.selection || (editor.selection.kind === 'items' && !editable().length),
				run: () => removeSelected()
			},
			{ separator: true },
			...(
				[
					[m.menu.toFront, 'icon-[material-symbols-light--flip-to-front]', `${ctrl}+${m.keys.shift}+↑`, bringToFront],
					[m.menu.forward, 'icon-[material-symbols-light--arrow-upward]', `${ctrl}+↑`, bringForward],
					[m.menu.backward, 'icon-[material-symbols-light--arrow-downward]', `${ctrl}+↓`, sendBackward],
					[m.menu.toBack, 'icon-[material-symbols-light--flip-to-back]', `${ctrl}+${m.keys.shift}+↓`, sendToBack]
				] as const
			).map(([label, icon, keys, op]) => ({ label, icon, keys, disabled: !arrangeable(op), run: () => arrange(op) })),
			{ separator: true },
			{
				label: m.library.add,
				icon: 'icon-[material-symbols-light--bookmark-add-outline]',
				disabled: !items.length,
				run: () => editor && saveSelection(editor)
			},
			...(extra.length ? [{ separator: true } as const, ...extra] : [])
		]);
	}

	function openRecordDialog() {
		player?.pause();
		dialog = 'record';
	}

	const actions: ToolActions = {
		addAnnotation,
		addImage,
		addIcon,
		addZoom: addZoomSegment,
		insertLibrary,
		transferLibrary,
		record: openRecordDialog,
		importFromFiles: async () => {
			if (importing || !editor) return;
			try {
				const files = await chooseMediaFromFiles(parent(editor.project.id));
				if (files.length) await importFiles(files);
			} catch (e) {
				console.error(e);
				toast(filesErrorText(e), 'error', 8000);
			}
		},
		importMedia: () => {
			if (!importing) fileInput?.click();
		}
	};

	/** After new sources: the preview loads their videos and redraws */
	async function sourcesAdded() {
		if (!player) return;
		await player.syncSources();
		player.refresh();
	}

	async function recorded(recording: Recording) {
		dialog = null;
		editor?.addRecording(recording);
		await sourcesAdded();
		toast(m.editor.recordingAdded, 'success');
	}

	/** Source from the media bin into the timeline: at the drop time, otherwise at the playhead */
	function insertSource(sourceId: string, at: DropPlace) {
		if (!editor || !player) return;
		editor.insertSource(sourceId, at.start ?? player.time);
		if (at.start !== undefined) player.seek(at.start);
	}

	/**
	 * Imports files into the media bin. Dropped onto the timeline or the preview (`place`), each one is also
	 * inserted there, just like an entry dragged from the bin.
	 */
	async function importFiles(files: FileList | File[] | null | undefined, place?: DropPlace) {
		const all = Array.from(files ?? []);
		const media = all.filter((f) => isMediaFile(f) || isImageFile(f));
		if (!media.length || !editor) return;
		try {
			let added = 0;
			for (const file of media) {
				importing = { name: file.name, progress: 0 };
				if (isImageFile(file)) {
					const image = await importImage(editor.project.id, file);
					editor.addImage(image);
					if (place) addImage(image.id, place);
				} else {
					const source = await importFile(editor.project.id, file, (p) => (importing!.progress = p));
					editor.addSource(source);
					await sourcesAdded();
					if (place) insertSource(source.id, place);
				}
				added++;
			}
			if (!place) {
				// Only in the bin: show it there
				toolState.group = 'media';
				toast(m.editor.importedToBin(added), 'success');
			}
		} catch (e) {
			toast(errorMessage(e), 'error', 8000);
		} finally {
			importing = null;
			if (fileInput) fileInput.value = '';
		}
	}

	/** Copies the package to a new place/name and continues editing the copy */
	async function saveAs() {
		if (!editor) return;
		const from = editor.project.id;
		const path = await chooseFile({ mode: 'save', folder: parent(from), accept: [PROJECT_EXT], name: basename(from) });
		if (!path) return;
		try {
			await editor.save();
			await copy(from, path);
			await goto(editorUrl(path));
			toast(m.editor.savedAs(basename(path)), 'success');
		} catch (e) {
			console.error(e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	function onKey(e: KeyboardEvent) {
		if (!editor || !player || dialog) return;
		if (e.key === 'F1') {
			// Also from within fields; not the browser's own help
			e.preventDefault();
			return helpState.toggle();
		}
		const target = e.target as HTMLElement;
		if (target.closest('input, select, textarea, [contenteditable]')) return;
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();
		if (mod && key === 'z') {
			e.preventDefault();
			if (e.shiftKey) editor.redo();
			else editor.undo();
		} else if (mod && key === 'y') {
			e.preventDefault();
			editor.redo();
		} else if (mod && key === 'g') {
			e.preventDefault();
			if (e.shiftKey) editor.unlink();
			else editor.link();
		} else if ((key === 'c' || key === 'x') && mod && window.getSelection()?.toString()) {
			// Selected text (e.g. in the help): the browser copies it
			return;
		} else if (mod && key === 'c') {
			e.preventDefault();
			copySelected();
		} else if (mod && key === 'x') {
			e.preventDefault();
			cutSelected();
		} else if (mod && key === 'v') {
			e.preventDefault();
			paste();
		} else if (mod && key === 'a') {
			e.preventDefault();
			editor.selectItems(editor.project.timeline.items.map((item) => item.id));
		} else if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && editor.selectedItem) {
			// Track of the selected item (stacking order)
			e.preventDefault();
			const up = e.key === 'ArrowUp';
			arrange(e.shiftKey ? (up ? bringToFront : sendToBack) : up ? bringForward : sendBackward);
		} else if (mod) {
			return;
		} else if (e.key === '?') {
			helpState.toggle();
		} else if (e.key === ' ' || key === 'k') {
			e.preventDefault();
			player.toggle();
		} else if (key === 's') {
			splitAtPlayhead();
		} else if (key === 'f') {
			holdFrame();
		} else if (e.key === 'Escape') {
			editor.selection = null;
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			removeSelected(e.shiftKey);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			player.seek(player.time - (e.shiftKey ? 1 : FRAME));
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			player.seek(player.time + (e.shiftKey ? 1 : FRAME));
		} else if (e.key === 'Home') {
			player.seek(0);
		} else if (e.key === 'End') {
			player.seek(player.duration);
		}
	}

	/** Where a tile or media entry may be dropped */
	function dropZone(e: DragEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('[data-timeline]')) return 'timeline';
		if (target.closest('[data-preview]')) return 'preview';
		return null;
	}

	function onDragOver(e: DragEvent) {
		if (hasDragPayload(e)) {
			const zone = dropZone(e);
			overPreview = zone === 'preview';
			if (!zone) return;
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
			return;
		}
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		draggingFiles = true;
	}

	/** Content coordinates under the mouse in the preview (also when zoomed in) */
	function previewPoint(e: DragEvent): Point | undefined {
		const el = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
		if (!el || !editor || !player) return undefined;
		const rect = el.getBoundingClientRect();
		const view = player.forcedView ?? viewAt(editor.project.timeline, player.time);
		return {
			x: view.x + ((e.clientX - rect.left) / rect.width) * view.w,
			y: view.y + ((e.clientY - rect.top) / rect.height) * view.h
		};
	}

	/** Tile or media entry dropped: on the timeline at the time under the mouse, in the preview at that spot */
	function dropPayload(payload: DragPayload, e: DragEvent) {
		const zone = dropZone(e);
		if (!editor || !player || !zone) return;
		const at: DropPlace =
			zone === 'timeline' && timeline ? { start: timeline.timeAtClient(e.clientX) } : { point: previewPoint(e) };
		if (payload.type === 'annotation') addAnnotation(payload.kind, at);
		else if (payload.type === 'zoom') addZoomSegment(at);
		else if (payload.type === 'image') addImage(payload.id, at);
		else if (payload.type === 'icon') addIcon(payload.icon, at);
		else if (payload.type === 'library') insertLibrary(payload.scope, payload.id, at);
		else insertSource(payload.id, at);
	}

	function onDrop(e: DragEvent) {
		draggingFiles = false;
		overPreview = false;
		const payload = readDragPayload(e);
		if (payload) {
			e.preventDefault();
			dropPayload(payload, e);
			return;
		}
		if (!e.dataTransfer?.files.length) return;
		e.preventDefault();
		// Onto the timeline: inserted at the drop time; onto the preview: at the playhead (images at that spot);
		// anywhere else only into the media bin
		const zone = dropZone(e);
		const place: DropPlace | undefined =
			zone === 'timeline' && timeline ? { start: timeline.timeAtClient(e.clientX) } : zone === 'preview' ? { point: previewPoint(e) } : undefined;
		importFiles(e.dataTransfer.files, place);
	}
</script>

{#snippet barActions()}
	{#if editor && player}
		<button
			class="btn btn-sm btn-ghost {helpState.open ? 'btn-active' : ''}"
			onclick={() => helpState.toggle()}
			aria-pressed={helpState.open}
			title={m.help.buttonTitle}
		>
			<span class="icon-[material-symbols-light--help-outline] size-5" aria-hidden="true"></span>
			<span class="hidden md:inline">{m.help.button}</span>
		</button>
		<button
			class="btn btn-sm btn-primary"
			disabled={player.duration === 0}
			onclick={() => {
				player?.pause();
				dialog = 'export';
			}}
		>
			<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span> {m.editor.export}
		</button>
	{/if}
{/snippet}

<!-- Also when a drag is cancelled (Esc) or ends outside the window -->
<svelte:window onkeydown={onKey} ondragend={() => (overPreview = false)} />
<svelte:head><title>{editor?.project.name ?? m.editor.title} · {BRAND.tool}</title></svelte:head>

{#if loadError}
	<main class="mx-auto max-w-xl p-10">
		<div role="alert" class="alert alert-error">{loadError}</div>
		<a class="btn mt-4" href={resolve('/screen-capture')}>{m.editor.backToOverview}</a>
	</main>
{:else if !editor || !player}
	<main class="grid h-full place-items-center"><span class="loading loading-spinner loading-lg"></span></main>
{:else}
	<div
		class="relative flex h-full flex-col overflow-hidden"
		ondragover={onDragOver}
		ondragleave={(e) => {
			if (e.currentTarget === e.target) draggingFiles = overPreview = false;
		}}
		ondrop={onDrop}
		role="application"
	>
		<input
			bind:this={fileInput}
			type="file"
			accept={`${MEDIA_ACCEPT},${IMAGE_ACCEPT}`}
			multiple
			hidden
			onchange={(e) => importFiles(e.currentTarget.files)}
		/>

		{#if importing}
			<div class="bg-base-200 flex items-center gap-3 px-4 pb-2 text-sm">
				{m.common.importing(importing.name)}
				<progress class="progress progress-primary w-64" value={importing.progress} max="1"></progress>
			</div>
		{/if}

		<div class="flex min-h-0 flex-1">
			<ToolRail />
			<ToolPanel {editor} {player} {actions} />

			<section class="flex min-w-0 flex-1 flex-col" data-preview-area>
				<!-- Preview with editing layer -->
				<div class="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4 [container-type:size]">
					<div
						class="relative shadow-lg {overPreview ? 'ring-selection ring-4' : ''}"
						data-preview
						style="width: min(100cqw, calc(100cqh * {previewSize.width / previewSize.height})); aspect-ratio: {previewSize.width} / {previewSize.height}"
					>
						<canvas
							width={previewSize.width}
							height={previewSize.height}
							class="block h-full w-full bg-black"
							{@attach (canvas) => player?.attach(canvas)}
						></canvas>
						<OverlayEditor {editor} {player} {itemMenu} />
					</div>
				</div>
			</section>

			<aside class="bg-base-200 border-base-300 flex w-80 shrink-0 flex-col border-l">
				<h2 class="flex items-center gap-1 px-3 py-2 text-sm font-semibold">
					<span class="icon-[material-symbols-light--tune] size-5" aria-hidden="true"></span> {m.editor.properties}
				</h2>
				<div class="min-h-0 flex-1 overflow-y-auto">
					<Inspector {editor} />
				</div>
			</aside>
		</div>

		<!-- Splitter: drag (or arrow keys) to share the height between preview and timeline, double-click resets it -->
		<button
			type="button"
			class="bg-base-300 hover:bg-primary/40 focus-visible:bg-primary/40 h-1.5 w-full shrink-0 cursor-row-resize outline-none"
			title={m.timeline.resize}
			aria-label={m.timeline.resize}
			onpointerdown={resizeTimeline}
			ondblclick={() => setTimelineHeight(DEFAULT_TIMELINE_HEIGHT)}
			onkeydown={(e) => {
				// Ctrl/Cmd + arrows stay with the editor (track order)
				if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.ctrlKey || e.metaKey) return;
				e.preventDefault();
				setTimelineHeight(shownTimelineHeight + (e.key === 'ArrowUp' ? 16 : -16));
			}}
		></button>

		<section class="flex flex-col gap-2 p-3">
			<div class="flex flex-wrap items-center gap-2">
				<button class="btn btn-sm btn-ghost" onclick={() => player?.seek(0)} aria-label={m.editor.toStart}>
					<span class="icon-[material-symbols-light--skip-previous] size-6" aria-hidden="true"></span>
				</button>
				<button class="btn btn-sm btn-primary w-28" onclick={() => player?.toggle()}>
					{#if player.playing}
						<span class="icon-[material-symbols-light--pause] size-5" aria-hidden="true"></span> {m.editor.pause}
					{:else}
						<span class="icon-[material-symbols-light--play-arrow] size-5" aria-hidden="true"></span> {m.editor.play}
					{/if}
				</button>
				<span class="font-mono text-sm tabular-nums">
					{formatTime(player.time, 2)} / {formatTime(player.duration, 2)}
				</span>
				<div class="divider divider-horizontal mx-1"></div>
				<button class="btn btn-sm" onclick={splitAtPlayhead}>
					<span class="icon-[material-symbols-light--content-cut] size-5" aria-hidden="true"></span> {m.editor.split}
					<kbd class="kbd kbd-xs">S</kbd>
				</button>
				<div class="join">
					<button class="btn btn-sm join-item" onclick={holdFrame} title={m.editor.holdFrameTitle}>
						<span class="{FREEZE_ICON} size-5" aria-hidden="true"></span> {m.editor.holdFrame}
						<kbd class="kbd kbd-xs">F</kbd>
					</button>
					<select class="select select-sm join-item w-20" bind:value={freezeSeconds} aria-label={m.editor.freezeDuration}>
						{#each [1, 2, 3, 5, 8] as s (s)}
							<option value={s}>{s} s</option>
						{/each}
					</select>
				</div>
				<button
					class="btn btn-sm"
					onclick={(e) => removeSelected(e.shiftKey)}
					disabled={!editor.selection}
					title={m.editor.deleteTitle}
				>
					<span class="icon-[material-symbols-light--delete-outline] size-5" aria-hidden="true"></span> {m.editor.delete}
					<kbd class="kbd kbd-xs">{m.keys.del}</kbd>
				</button>
				<div class="divider divider-horizontal mx-1"></div>
				<button class="btn btn-sm btn-ghost" onclick={() => editor?.undo()} disabled={!editor.canUndo}>
					<span class="icon-[material-symbols-light--undo] size-5" aria-hidden="true"></span> {m.editor.undo}
				</button>
				<button class="btn btn-sm btn-ghost" onclick={() => editor?.redo()} disabled={!editor.canRedo}>
					<span class="icon-[material-symbols-light--redo] size-5" aria-hidden="true"></span> {m.editor.redo}
				</button>
				<div class="divider divider-horizontal mx-1"></div>
				<!-- Preview and timeline alike -->
				<button
					class="btn btn-sm btn-ghost {snapping.enabled ? 'btn-active' : ''}"
					onclick={() => (snapping.enabled = !snapping.enabled)}
					aria-pressed={snapping.enabled}
					title={m.editor.snappingTitle}
				>
					<span class="icon-[material-symbols-light--grid-guides-outline] size-5" aria-hidden="true"></span> {m.editor.snapping}
				</button>
			</div>

			<Timeline bind:this={timeline} {editor} {player} {itemMenu} height={shownTimelineHeight} />
		</section>

		<HelpWindow />
		<LibrarySaveDialog onsave={saveToLibrary} />
		<DragGhost {editor} />

		{#if draggingFiles}
			<div
				class="border-selection bg-base-300/80 pointer-events-none absolute inset-2 z-40 grid place-items-center rounded-box border-4 border-dashed"
			>
				<div class="flex flex-col items-center gap-2 text-lg font-semibold">
					<span class="icon-[material-symbols-light--upload-file] size-12" aria-hidden="true"></span>
					{m.editor.dropToImport}
				</div>
			</div>
		{/if}
	</div>

	{#if dialog === 'record'}
		<RecordDialog projectId={editor.project.id} ondone={recorded} oncancel={() => (dialog = null)} />
	{:else if dialog === 'export'}
		<ExportDialog project={editor.project} onclose={() => (dialog = null)} />
	{:else if editor.canvasOffer}
		<CanvasDialog
			canvas={editor.project}
			size={editor.canvasOffer.size}
			onanswer={(grow) => editor?.answerCanvasOffer(grow)}
		/>
	{/if}
{/if}
