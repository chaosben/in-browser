<script lang="ts">
	// Editor page of a project (`?path=` of its package): the ribbon on top, side panels on the left (what you add),
	// the preview with its editing layer, the properties on the right and the timeline below. Every action is a
	// `Command` (`ui/commands.ts`): ribbon, context menus and keys come from there. Changes save themselves; the save
	// state, size, length and a running import sit in the footer. One tab per project.
	import InspectorPane from '@in-browser/brand/Inspector.svelte';
	import { InspectorState } from '@in-browser/brand/inspector.svelte.js';
	import PanelRail from '@in-browser/brand/PanelRail.svelte';
	import { panelCommand } from '@in-browser/brand/panels.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { RibbonTab } from '@in-browser/brand/ribbon.js';
	import { installCommandKeys, matches, type Command } from '@in-browser/brand/commands.js';
	import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';
	import { tick, untrack } from 'svelte';
	import { innerHeight } from 'svelte/reactivity/window';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { editorUrl } from '#lib/brand.js';
	import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import CanvasDialog from '#lib/components/CanvasDialog.svelte';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { saveStateOf, setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import ExportDialog from '#lib/components/ExportDialog.svelte';
	import Inspector from '#lib/components/Inspector.svelte';
	import OverlayEditor from '#lib/components/OverlayEditor.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import { IMAGE_ACCEPT, importImage, isImageFile } from '#lib/media/images.js';
	import { importFile, isMediaFile, MEDIA_ACCEPT } from '#lib/media/media.js';
	import type { Recording } from '#lib/project/project.js';
	import { Player } from '#lib/preview/player.svelte.js';
	import { createIcon, createImage, createOverlay, createZoom, defaultDuration } from '#lib/project/defaults.js';
	import { applyStyle, loadStyle } from '#lib/project/styles.js';
	import { Editor } from '#lib/project/editor.svelte.js';
	import type { Annotation, IconData, ToolKind } from '#lib/project/types.js';
	import { zoomRectAt } from '#lib/project/geometry.js';
	import { setImageProject } from '#lib/render/images.svelte.js';
	import { moveAnnotation, overlayBounds } from '#lib/render/overlays.js';
	import { PANELS } from '#lib/tools/groups.js';
	import { panelState } from '#lib/tools/state.svelte.js';
	import type { DropPlace, PanelContext, ToolActions } from '#lib/tools/types.js';
	import {
		chooseMediaFromFiles,
		cleanupMedia,
		loadProject,
		PROJECT_EXT,
		projectFileDate,
		projectName,
		rememberProject,
		saveProject
	} from '#lib/storage/store.js';
	import { chooseFile } from '@in-browser/files/dialog.svelte.js';
	import { PACKAGE_MANIFEST } from '@in-browser/files/formats.js';
	import { copy, exists, FilesError, remove as removePath, watch } from '@in-browser/files/fs.js';
	import { filesErrorText} from '@in-browser/files/i18n/index.svelte.js';
	import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
	import { basename, join, normalize, parent } from '@in-browser/files/path.js';
	import {
		clampTimelineHeight,
		DEFAULT_TIMELINE_HEIGHT,
		loadTimelineHeight,
		storeTimelineHeight
	} from '#lib/ui/timeline-height.js';
	import { addItem, addZoom, nextStepNumber } from '#lib/timeline/ops.js';
	import { contextMenu, openContextMenu, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { insertLibrary, saveToLibrary, sourcesAdded, transferLibrary } from '#lib/ui/library-actions.js';
	import { editorCommands, itemMenuEntries, type EditorPage } from '#lib/ui/commands.js';
	import { dragOver, drop } from '#lib/ui/drop.js';
	import LibrarySaveDialog from '#lib/components/LibrarySaveDialog.svelte';
	import DragGhost from '#lib/components/DragGhost.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { inTextField } from '@in-browser/brand/ui/typing.js';
	import { m } from '#lib/i18n/index.js';
	import { errorMessage, formatTime } from '#lib/util/format.js';
	import DropOverlay from '@in-browser/brand/DropOverlay.svelte';
	import { pointerDrag } from '@in-browser/brand/ui/drag.js';
	import { ExternalVersions, flushWhenHidden, lockDocument } from '@in-browser/files/documents.js';

	let editor = $state<Editor | null>(null);
	/** The properties on the right (suite inspector: shown or not, width, folded sections) */
	const inspector = new InspectorState('screen-capture');
	let player = $state<Player | null>(null);
	let loadError = $state<string | null>(null);
	/** Opening failed because the browser doesn't allow access to the connected folder right now */
	let loadAccess = $state<ReturnType<typeof accessAction>>(undefined);
	let dialog = $state<'record' | 'export' | null>(null);
	let importing = $state<{ name: string; progress: number } | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let timeline = $state<ReturnType<typeof Timeline>>();
	/** Height of the timeline (persisted); the preview gets the rest and never jumps when tracks are added */
	let timelineHeight = $state(loadTimelineHeight());
	const shownTimelineHeight = $derived(clampTimelineHeight(timelineHeight, innerHeight.current ?? 900));
	/** Zoom of the timeline (1: everything visible) */
	let timelineZoom = $state(1);
	/** Duration of the next still frame (“Hold frame” ▾) */
	let freezeSeconds = $state(3);
	/** The properties' fields (View → “Canvas size” opens the size field there) */
	let properties = $state<ReturnType<typeof Inspector>>();

	/** Dragging the splitter above the timeline changes its height; stored at the end */
	function resizeTimeline(e: PointerEvent) {
		if (e.button !== 0) return;
		const y0 = e.clientY;
		const h0 = shownTimelineHeight;
		pointerDrag(
			e,
			(ev) => (timelineHeight = clampTimelineHeight(h0 - (ev.clientY - y0), innerHeight.current ?? 900)),
			() => storeTimelineHeight(timelineHeight)
		);
	}

	function setTimelineHeight(px: number) {
		timelineHeight = clampTimelineHeight(px, innerHeight.current ?? 900);
		storeTimelineHeight(timelineHeight);
	}
	let draggingFiles = $state(false);
	/** A tile or media entry is dragged over the preview (highlighted as drop target) */
	let overPreview = $state(false);

	/** One tab at a time edits a project */
	const lockProject = (path: string) => lockDocument(`screen-capture:project:${path}`);

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
			next = new Editor(project, (clipsChanged) => (clipsChanged ? nextPlayer.refresh() : nextPlayer.requestRedraw()));
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

		/** Whether versions saved elsewhere are taken (asked, the answer kept while the project is open) */
		const versions = new ExternalVersions();

		async function checkExternal() {
			const date = await projectFileDate(path);
			if (!ed || date === undefined || date === ed.lastWrite || ed.saving) return;
			if (ed.dirty) {
				ed.lastWrite = date;
				return toast(m.editor.changedElsewhere, 'warning', 8000);
			}
			// Asked first (once per version; the answer may be kept while the project is open)
			const silent = versions.silent;
			if (!(await versions.shouldReload(projectName(path), String(date)))) {
				// Not taken: the next change here writes over it
				if (ed) ed.lastWrite = date;
				return;
			}
			if (disposed || ed?.dirty) return;
			await open();
			if (silent) toast(m.editor.reloaded, 'info');
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
				// Remove leftover files (e.g. aborted recordings) in the background; nothing is lost when it fails
				cleanupMedia(opened.project).catch((e) => console.warn('[screen-capture] cleanup', e));
				const manifest = join(path, PACKAGE_MANIFEST);
				stopWatch = watch((paths) => {
					if (!paths.includes(manifest)) return;
					checkExternal().catch((e) => {
						console.error('[screen-capture] reload', e);
						toast(errorMessage(e), 'error', 8000);
					});
				});
			} catch (e) {
				console.error('[screen-capture] open', e);
				loadError = m.editor.loadFailed(errorMessage(e));
				loadAccess = accessAction(e, () => location.reload());
			}
		})();

		// Leaving or hiding the page: save what is still waiting (the 400 ms of the autosave)
		const stopFlush = flushWhenHidden(() => {
			if (ed?.dirty) void ed.save();
		});
		return () => {
			disposed = true;
			stopFlush();
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

	// Canvas size, length of the project and a running import on the left of the BrandFooter
	$effect(() =>
		setBrandFooter({
			status: footerStatus,
			save: editor ? saveStateOf(editor) : null
		})
	);

	// Where you are: the project's name (its file name) – its actions are in the ribbon's tab “File”
	$effect(() => {
		if (!editor) return;
		return setBrandBar({ crumbs: [{ label: editor.project.name }] });
	});

	function openExport() {
		player?.pause();
		dialog = 'export';
	}

	function showInFiles(ed: Editor) {
		location.assign(`${resolve('/files')}?path=${encodeURIComponent(parent(ed.project.id))}`);
	}

	// Pictures of image annotations are loaded from this project
	$effect(() => {
		if (editor) setImageProject(editor.project.id, editor.project.images);
	});

	// Setting the canvas size clears it (e.g. after growing the canvas or undoing that): draw again
	$effect(() => {
		void previewSize;
		untrack(() => player?.redraw());
	});

	/** Annotation from a tool tile; same settings as the last annotation of this type */
	function addAnnotation(kind: ToolKind, at: DropPlace = {}) {
		if (!editor || !player) return;
		const start = at.start ?? player.time;
		placeAnnotation(applyStyle(createOverlay(kind, start, start + defaultDuration(kind), nextStepNumber(editor.project.timeline)), loadStyle(kind)), at);
	}

	/** Own image from the media bin (`image`: its id) or an icon, 3 s long */
	function addPicture(picture: { image: string } | { icon: IconData }, at: DropPlace = {}) {
		if (!editor || !player) return;
		const start = at.start ?? player.time;
		const { width, height } = editor.project;
		if ('icon' in picture) {
			return placeAnnotation(applyStyle(createIcon(picture.icon, start, start + 3, width, height), loadStyle('icon')), at);
		}
		const image = editor.image(picture.image);
		if (image) placeAnnotation(applyStyle(createImage(image, start, start + 3, width, height), loadStyle('image')), at);
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
		// Centered on the drop point, within the frame
		if (at.point) segment.rect = zoomRectAt(at.point.x, at.point.y, segment.rect.w);
		editor.update((t) => addZoom(t, segment));
		if (editor.project.timeline.zoom.some((z) => z.id === segment.id)) editor.select('zoom', segment.id);
		else toast(m.editor.zoomExists, 'warning');
		if (at.start !== undefined) player.seek(range.start);
	}

	function openRecordDialog() {
		player?.pause();
		dialog = 'record';
	}

	const actions: ToolActions = {
		addAnnotation,
		addImage: (image, at) => addPicture({ image }, at),
		addIcon: (icon, at) => addPicture({ icon }, at),
		addZoom: addZoomSegment,
		insertLibrary: async (scope, id, at) => {
			if (editor && player) await insertLibrary(editor, player, scope, id, at);
		},
		transferLibrary: async (scope, id, move) => {
			if (editor && player) await transferLibrary(editor, player, scope, id, move);
		},
		record: openRecordDialog,
		importFromFiles: async () => {
			if (importing || !editor) return;
			try {
				const files = await chooseMediaFromFiles(parent(editor.project.id));
				if (files.length) await importFiles(files);
			} catch (e) {
				console.error('[screen-capture] import from Files', e);
				toast(filesErrorText(e), 'error', 8000);
			}
		},
		importMedia: () => {
			if (!importing) fileInput?.click();
		}
	};

	/** What the side panels get: the open project (getters, so a reload shows the new one) */
	const panelContext: PanelContext = {
		get editor() {
			return editor!;
		},
		get player() {
			return player!;
		},
		actions
	};

	// --- Commands ---

	const commandPage: EditorPage = {
		get editor() {
			return editor;
		},
		get player() {
			return player;
		},
		actions,
		get freezeSeconds() {
			return freezeSeconds;
		},
		set freezeSeconds(s) {
			freezeSeconds = s;
		},
		get timelineZoom() {
			return timelineZoom;
		},
		set timelineZoom(z) {
			timelineZoom = z;
		},
		openPanel: (id) => (panelState.open = id),
		changeCanvas: async () => {
			if (!editor) return;
			editor.selection = null;
			inspector.show();
			// The project's properties are there after the next update
			await tick();
			properties?.openCanvasSize();
		}
	};
	const { commands: c, keyOnly, frames } = editorCommands(commandPage);
	/** “Properties” (View → Panels, Alt+Enter) */
	const propertiesCommand = inspector.command();
	/** The properties of what a context menu was opened on: shown, never hidden */
	const showProperties: Command = { ...propertiesCommand, run: () => inspector.show() };

	const openPanel = { get: () => panelState.open, set: (id: string | null) => (panelState.open = id) };

	// The project itself (tab “File”); it is named after its file – renamed in Files
	const fileCommands = {
		saveAs: { id: 'saveAs', label: m.editor.saveAs, icon: 'icon-[material-symbols-light--save-as-outline]', enabled: () => !!editor, run: () => void saveAs() },
		showInFiles: {
			id: 'showInFiles',
			label: m.editor.showInFiles,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			enabled: () => !!editor,
			run: () => editor && showInFiles(editor)
		},
		export: {
			id: 'export',
			label: m.editor.export,
			icon: 'icon-[material-symbols-light--ios-share]',
			enabled: () => !!player && player.duration > 0,
			run: openExport
		}
	} satisfies Record<string, Command>;

	const tabs: RibbonTab[] = [
		{
			id: 'file',
			label: brandMessages().ribbon.file,
			groups: [{ id: 'project', label: m.ribbon.groups.project, items: [fileCommands.saveAs, fileCommands.showInFiles, fileCommands.export] }]
		},
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'playback', label: m.ribbon.groups.playback, items: [c.toStart, c.play, c.toEnd] },
				{ id: 'edit', label: m.ribbon.groups.edit, items: [c.split, c.holdFrame, c.delete] },
				{ id: 'clipboard', label: m.ribbon.groups.clipboard, items: [c.paste, c.cut, c.copy] },
				{ id: 'select', label: m.ribbon.groups.select, items: [c.selectAll, c.snap] }
			]
		},
		{
			id: 'insert',
			label: m.ribbon.tabs.insert,
			groups: [
				{ id: 'media', label: m.ribbon.groups.media, items: [c.record, c.importMedia, c.importFromFiles] },
				{ id: 'annotations', label: m.ribbon.groups.annotations, items: [c.shapes, c.highlight, c.spotlight, c.blur, c.step, c.click] },
				{ id: 'text', label: m.ribbon.groups.text, items: [c.text, c.callout] },
				{ id: 'icon', label: m.ribbon.groups.icon, items: [c.icon] },
				{ id: 'zoom', label: m.ribbon.groups.zoom, items: [c.zoom] },
				{ id: 'library', label: m.ribbon.groups.library, items: [c.saveToLibrary] }
			]
		},
		{
			id: 'view',
			label: m.ribbon.tabs.view,
			groups: [
				{ id: 'timeline', label: m.ribbon.groups.timeline, items: [c.timelineIn, c.timelineOut, c.timelineFit] },
				{ id: 'panels', label: m.ribbon.groups.panels, items: [...PANELS.map((spec) => panelCommand(spec, openPanel)), propertiesCommand] },
				{ id: 'canvas', label: m.ribbon.groups.canvas, items: [c.canvasSize] }
			]
		},
		// The selection's own tabs: commands that can't act stay, disabled
		{
			id: 'arrange',
			label: m.ribbon.tabs.arrange,
			contextual: true,
			visible: () => !!editor?.selectedItems.length,
			groups: [
				{ id: 'order', label: m.ribbon.groups.order, items: [c.toFront, c.forward, c.backward, c.toBack] },
				{ id: 'link', label: m.ribbon.groups.link, items: [c.link, c.unlink] }
			]
		},
		{
			id: 'clip',
			label: m.ribbon.tabs.clip,
			contextual: true,
			visible: () => !!editor?.selectedClip,
			groups: [
				{ id: 'crop', label: m.ribbon.groups.crop, items: [c.crop, c.removeCrop] },
				{ id: 'placement', label: m.ribbon.groups.placement, items: [c.fit, c.fill, c.fitCanvas] },
				{ id: 'audio', label: m.ribbon.groups.audio, items: [c.mute] }
			]
		}
	];

	/** The shortcut list of the project's properties: the commands with keys */
	const shortcutList: Command[] = [c.play, c.split, c.holdFrame, c.delete, c.deleteGap, c.cut, c.copy, c.paste, c.selectAll, c.link, c.unlink, c.forward, c.toFront, propertiesCommand];

	/** Ctrl+A selects all items only while the preview or the timeline has the focus (elsewhere: the browser's) */
	const inEditArea = () => !!document.activeElement?.closest('[data-preview-area], [data-timeline]');
	/** Selected text (e.g. in the help): Ctrl+C/X copy it, not the items */
	const textSelected = () => !!getSelection()?.toString();

	$effect(() =>
		installCommandKeys(() => {
			if (!editor || !player) return [];
			const text = textSelected();
			const all = [...Object.values(c), ...keyOnly];
			return all.filter((cmd) => !(cmd === c.selectAll && !inEditArea()) && !(text && (cmd === c.copy || cmd === c.cut)));
		})
	);
	$effect(() => installCommandKeys(() => [propertiesCommand]));

	// ←/→ step through frames (Shift: a second) and repeat while held; not while typing or with a dialog open
	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || !editor || inTextField(e.target) || document.querySelector('dialog[open]:modal')) return;
			const frame = frames.find((f) => f.shortcut && matches(e, f.shortcut));
			if (!frame) return;
			e.preventDefault();
			frame.run?.();
		};
		addEventListener('keydown', onKey);
		return () => removeEventListener('keydown', onKey);
	});

	// Esc goes back one level: out of crop mode, then the selection ends (menus, popovers and dialogs take it first)
	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented || !editor || contextMenu.open || inTextField(e.target)) return;
			// The help window (a dialog that isn't modal) takes its own Esc
			if (document.querySelector(':popover-open, dialog[open]:modal')) return;
			if (editor.croppingClip) editor.endCrop();
			else editor.selection = null;
		};
		addEventListener('keydown', onKey);
		return () => removeEventListener('keydown', onKey);
	});

	/**
	 * Context menu of the selection (preview and timeline): every action on items (`itemMenuEntries`); `extra` adds
	 * entries of the place it was opened (e.g. the elements under the mouse pointer in the preview).
	 */
	function itemMenu(e: MouseEvent, extra: MenuEntry[] = []) {
		openContextMenu(e, itemMenuEntries(c, showProperties, extra));
	}

	async function recorded(recording: Recording) {
		dialog = null;
		try {
			editor?.addRecording(recording);
			if (player) await sourcesAdded(player);
			toast(m.editor.recordingAdded, 'success');
		} catch (e) {
			console.error('[screen-capture] recording', e);
			toast(errorMessage(e), 'error', 8000);
		}
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
					if (place) addPicture({ image: image.id }, place);
				} else {
					const source = await importFile(editor.project.id, file, (p) => (importing!.progress = p));
					editor.addSource(source);
					if (player) await sourcesAdded(player);
					if (place) insertSource(source.id, place);
				}
				added++;
			}
			if (!place) {
				// Only in the bin: show it there
				panelState.open = 'media';
				toast(m.editor.importedToBin(added), 'success');
			}
		} catch (e) {
			console.error('[screen-capture] import', e);
			toast(errorMessage(e), 'error', 8000);
		} finally {
			importing = null;
			if (fileInput) fileInput.value = '';
		}
	}

	/**
	 * Copies the package to a new place/name and continues editing the copy. An existing project there is replaced,
	 * unless another tab has it open.
	 */
	async function saveAs() {
		if (!editor) return;
		const from = editor.project.id;
		const path = await chooseFile({
			mode: 'save',
			folder: parent(from),
			accept: [PROJECT_EXT],
			name: basename(from),
			overwrite: true
		});
		if (!path) return;
		let release: (() => void) | null = null;
		try {
			await editor.save();
			// Not saved (the message said so): the copy would miss the latest changes
			if (editor.saveError) return;
			if (path === from) return toast(m.editor.savedAs(basename(path)), 'success');
			if (await exists(path)) {
				// Replacing a folder the project lies in would delete the project itself
				if (from.startsWith(path + '/')) throw new FilesError('intoItself', from);
				release = await lockProject(path);
				if (!release) {
					console.error('[screen-capture] save as: open elsewhere', path);
					return toast(m.editor.targetOpenElsewhere(basename(path)), 'error', 8000);
				}
				await removePath(path);
			}
			await copy(from, path);
			// The copy is named like its package
			await saveProject({ ...(await loadProject(path)), name: projectName(path) });
			// The editor of the copy takes the lock itself
			release?.();
			release = null;
			await goto(editorUrl(path));
			toast(m.editor.savedAs(basename(path)), 'success');
		} catch (e) {
			console.error('[screen-capture] save as', e);
			toast(filesErrorText(e), 'error', 8000);
		} finally {
			release?.();
		}
	}

	function onDragOver(e: DragEvent) {
		const over = dragOver(e);
		if (over === 'files') draggingFiles = true;
		else if (over) overPreview = over.payload === 'preview';
	}

	function onDrop(e: DragEvent) {
		draggingFiles = false;
		overPreview = false;
		if (editor && player) drop(e, { editor, player, timeline, actions, insertSource, importFiles });
	}
</script>

{#snippet footerStatus()}
	{#if editor && player}
		<span class="flex items-center gap-3 px-1">
			<span class="opacity-70">{m.editor.footerSize(editor.project.width, editor.project.height)}</span>
			<span class="font-mono tabular-nums opacity-70">{formatTime(player.time, 2)} / {formatTime(player.duration, 2)}</span>
			{#if importing}
				<span class="flex min-w-0 items-center gap-2" role="status">
					<span class="max-w-60 truncate">{m.common.importing(importing.name)}</span>
					<progress class="progress progress-primary w-32" value={importing.progress} max="1"></progress>
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

<!-- Also when a drag is cancelled (Esc) or ends outside the window -->
<svelte:window ondragend={() => (overPreview = false)} />
<svelte:head><title>{editor?.project.name ?? m.editor.title} · {toolName('screen-capture')}</title></svelte:head>

{#if loadError}
	<main class="mx-auto max-w-xl p-10">
		<div role="alert" class="alert alert-error">{loadError}</div>
		<div class="mt-4 flex gap-2">
			{#if loadAccess}<button class="btn btn-primary" onclick={loadAccess.run}>{loadAccess.label}</button>{/if}
			<a class="btn" href={resolve('/screen-capture')}>{m.editor.backToOverview}</a>
		</div>
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

		<Ribbon {tabs} quick={[c.undo, c.redo]} storage="screen-capture" initial="home" />

		<div class="flex min-h-0 flex-1">
			<PanelRail panels={PANELS} context={panelContext} bind:open={panelState.open} storage="screen-capture" initial="media" />

			<section class="flex min-w-0 flex-1 flex-col" data-preview-area>
				<!-- Preview with editing layer -->
				<div class="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4 @container-size">
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

			<InspectorPane state={inspector}>
				<Inspector bind:this={properties} {editor} commands={c} shortcuts={shortcutList} />
			</InspectorPane>
		</div>

		<!-- Splitter: drag (or arrow keys) to share the height between preview and timeline, double-click resets it -->
		<button
			type="button"
			class="bg-base-300 hover:bg-selection/40 focus-visible:bg-selection/40 h-1.5 w-full shrink-0 cursor-row-resize outline-none"
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

		<section class="p-3">
			<Timeline bind:this={timeline} bind:zoom={timelineZoom} {editor} {player} {itemMenu} height={shownTimelineHeight} />
		</section>

		<LibrarySaveDialog onsave={(name, scope, items) => editor && saveToLibrary(editor, name, scope, items)} />
		<DragGhost {editor} />

		{#if draggingFiles}
			<DropOverlay label={m.editor.dropToImport} />
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
