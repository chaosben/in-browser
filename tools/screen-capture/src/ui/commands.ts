// Every action of the editor once as a `Command` (`@in-browser/brand/commands.js`): the ribbon, the context menus
// and the keyboard are built from here (listed in the help topic “Keyboard
// shortcuts”). The editing steps themselves (split, hold frame, delete, clipboard, order) live here too, so every
// place that offers them does the same.

import { shortcutLabel, type Command } from '@in-browser/brand/commands.js';
import { brandMessages } from '@in-browser/brand/i18n/index.svelte.js';
import type { MenuAction, MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
import { m } from '#lib/i18n/index.js';
import type { Player } from '#lib/preview/player.svelte.js';
import { clipboard } from '#lib/project/clipboard.svelte.js';
import { croppedSize, FULL } from '#lib/project/crop.js';
import { FREEZE_ICON, fitRect, OVERLAY_KINDS, ZOOM_ICON } from '#lib/project/defaults.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { BarcodeAnnotation, Clip, Timeline, ToolKind } from '#lib/project/types.js';
import {
	bringForward,
	bringToFront,
	clipsAt,
	insertFreeze,
	itemEnd,
	pasteItems,
	remove,
	removeZoom,
	sendBackward,
	sendToBack,
	split,
	trackState,
	updateItem
} from '#lib/timeline/ops.js';
import type { ToolActions } from '#lib/tools/types.js';
import { pasteClipboard } from '#lib/ui/library-actions.js';
import { saveSelection } from '#lib/ui/library.svelte.js';
import { snapping } from '#lib/ui/snapping.svelte.js';

/** Changes the stacking order (track) of one item */
export type Arrange = (timeline: Timeline, id: string) => Timeline;

/** Durations of “Hold frame” in seconds */
export const FREEZE_SECONDS = [1, 2, 3, 5, 8] as const;
/** Step of ←/→ */
const FRAME = 1 / 30;
/** Timeline zoom relative to “everything visible” */
export const TIMELINE_ZOOM = { min: 1, max: 32, step: 1.5 };

/** What the commands need of the page */
export interface EditorPage {
	readonly editor: Editor | null;
	readonly player: Player | null;
	readonly actions: ToolActions;
	/** Duration of the next still frame (seconds) */
	freezeSeconds: number;
	/** Zoom of the timeline (1: everything visible) */
	timelineZoom: number;
	/** Opens a side panel (`icons` for “Icon”) */
	openPanel(id: string): void;
	/** Shows the project's properties with the canvas size open */
	changeCanvas(): void;
	/** Opens the barcode dialog: for a new code, or to change `edit` */
	barcode(edit?: BarcodeAnnotation): void;
}

/** Selected items on unlocked tracks */
export function editableItems(editor: Editor) {
	const timeline = editor.project.timeline;
	return editor.selectedItems.filter((item) => !trackState(timeline, item.track).locked);
}

/**
 * Selected items under the playhead – cutting then only affects those; without any (`undefined`) it affects all
 * clips under the playhead.
 */
function selectedAt(editor: Editor, t: number) {
	const ids = editableItems(editor)
		.filter((item) => item.start <= t && t <= itemEnd(item))
		.map((item) => item.id);
	return ids.length ? ids : undefined;
}

/** The selected item (on an unlocked track), if `op` would change its stacking order */
function arrangeable(editor: Editor, op: Arrange) {
	const item = editor.selectedItem;
	if (!item || trackState(editor.project.timeline, item.track).locked) return null;
	return op(editor.project.timeline, item.id) === editor.project.timeline ? null : item;
}

/** The clip whose properties are shown (the clicked one, also with its group), on an unlocked track */
function soleClip(editor: Editor): Clip | null {
	const clip = editor.selectedClip;
	return clip && !trackState(editor.project.timeline, clip.track).locked ? clip : null;
}

/** A single selected clip with a picture (unlocked) */
function pictureClip(editor: Editor): Clip | null {
	const clip = soleClip(editor);
	return clip && editor.source(clip.sourceId)?.hasVideo ? clip : null;
}

/** Fits the clip into the canvas or lets it fill it (centered); the visible part counts, so a crop does too */
export function placeClip(editor: Editor, clip: Clip, cover: boolean) {
	const source = editor.source(clip.sourceId);
	if (!source) return;
	const rect = fitRect(croppedSize(source, clip.crop), editor.project.width, editor.project.height, cover);
	editor.update((t) => updateItem(t, clip.id, { rect }));
}

/** A command as a menu entry (disabled when not possible, its shortcut on the right) */
export function asEntry(c: Command, label = c.label): MenuAction {
	return {
		label,
		icon: c.icon,
		keys: c.shortcut ? shortcutLabel(c.shortcut, brandMessages().keys) : undefined,
		checked: c.active ? c.active() : undefined,
		disabled: c.enabled ? !c.enabled() : false,
		run: () => c.run?.()
	};
}

export function editorCommands(page: EditorPage) {
	const ready = () => !!page.editor && !!page.player;
	/** Runs with editor and player (both there while a project is open) */
	const withEditor = (run: (editor: Editor, player: Player) => void) => () => {
		const { editor, player } = page;
		if (editor && player) run(editor, player);
	};

	function holdFrame(editor: Editor, player: Player) {
		const t = player.time;
		const ids = selectedAt(editor, t);
		const hasVideo = (id: string) => !!editor.source(id)?.hasVideo;
		editor.update((tl) => insertFreeze(tl, t, page.freezeSeconds, ids, hasVideo));
		const freeze = clipsAt(editor.project.timeline, t + 0.001).find((c) => c.type === 'freeze');
		if (freeze) editor.select('item', freeze.id);
		player.seek(t);
	}

	/** Deletes the selection (except locked tracks); later items move up, with `gap` a gap remains */
	function removeSelected(editor: Editor, gap: boolean) {
		const s = editor.selection;
		if (!s) return;
		if (s.kind === 'zoom') return editor.update((t) => removeZoom(t, s.id));
		const ids = editableItems(editor).map((item) => item.id);
		if (ids.length) editor.update((t) => remove(t, ids, !gap, (id) => !!editor.source(id)?.hasVideo));
	}

	const canRemove = () => {
		const editor = page.editor;
		if (!editor?.selection) return false;
		return editor.selection.kind === 'zoom' || editableItems(editor).length > 0;
	};

	const arrange = (id: string, label: string, icon: string, op: Arrange, key: 'ArrowUp' | 'ArrowDown', shift: boolean): Command => ({
		id,
		label,
		icon,
		shortcut: { key, ctrl: true, shift },
		enabled: () => !!page.editor && !!arrangeable(page.editor, op),
		run: withEditor((editor) => {
			const item = arrangeable(editor, op);
			if (item) editor.update((t) => op(t, item.id));
		})
	});

	const annotation = (kind: ToolKind): Command => ({
		id: `add-${kind}`,
		label: OVERLAY_KINDS[kind].label,
		icon: OVERLAY_KINDS[kind].icon,
		tip: m.editor.insertTip,
		enabled: ready,
		run: () => page.actions.addAnnotation(kind)
	});

	const seek = (id: string, label: string, icon: string, key: string, to: (player: Player) => number, shift = false): Command => ({
		id,
		label,
		icon,
		shortcut: { key, shift },
		enabled: ready,
		run: withEditor((_, player) => player.seek(to(player)))
	});

	const zoomTimeline = (factor: number) =>
		(page.timelineZoom = Math.min(TIMELINE_ZOOM.max, Math.max(TIMELINE_ZOOM.min, page.timelineZoom * factor)));

	const deleteGap: Command = {
		id: 'deleteGap',
		label: m.editor.deleteGap,
		icon: 'icon-[material-symbols-light--delete-sweep-outline]',
		shortcut: { key: 'Delete', shift: true },
		enabled: canRemove,
		run: withEditor((editor) => removeSelected(editor, true))
	};

	const commands = {
		undo: {
			id: 'undo',
			label: m.editor.undo,
			icon: 'icon-[material-symbols-light--undo]',
			shortcut: { key: 'z', ctrl: true },
			enabled: () => !!page.editor?.canUndo,
			run: () => page.editor?.undo()
		},
		redo: {
			id: 'redo',
			label: m.editor.redo,
			icon: 'icon-[material-symbols-light--redo]',
			shortcut: { key: 'z', ctrl: true, shift: true },
			enabled: () => !!page.editor?.canRedo,
			run: () => page.editor?.redo()
		},

		// Playback
		toStart: seek('toStart', m.editor.toStart, 'icon-[material-symbols-light--skip-previous]', 'Home', () => 0),
		play: {
			id: 'play',
			label: m.editor.playPause,
			get icon() {
				return page.player?.playing ? 'icon-[material-symbols-light--pause]' : 'icon-[material-symbols-light--play-arrow]';
			},
			shortcut: { key: ' ' },
			enabled: ready,
			active: () => !!page.player?.playing,
			run: () => page.player?.toggle()
		},
		toEnd: seek('toEnd', m.editor.toEnd, 'icon-[material-symbols-light--skip-next]', 'End', (p) => p.duration),

		// Edit
		split: {
			id: 'split',
			label: m.editor.split,
			tip: m.editor.splitTip,
			icon: 'icon-[material-symbols-light--content-cut]',
			shortcut: { key: 's' },
			enabled: ready,
			run: withEditor((editor, player) => {
				const t = player.time;
				const ids = selectedAt(editor, t);
				editor.update((tl) => split(tl, t, ids));
			})
		},
		holdFrame: {
			id: 'holdFrame',
			label: m.editor.holdFrame,
			tip: m.editor.holdFrameTip,
			icon: FREEZE_ICON,
			shortcut: { key: 'f' },
			enabled: ready,
			run: withEditor(holdFrame),
			menu: () =>
				FREEZE_SECONDS.map((s) => ({
					label: m.editor.seconds(s),
					checked: s === page.freezeSeconds,
					run: () => (page.freezeSeconds = s)
				}))
		},
		delete: {
			id: 'delete',
			label: m.editor.delete,
			tip: m.editor.deleteTip,
			icon: 'icon-[material-symbols-light--delete-outline]',
			shortcut: { key: 'Delete' },
			enabled: canRemove,
			run: withEditor((editor) => removeSelected(editor, false)),
			menu: () => [asEntry(deleteGap)]
		},
		deleteGap,

		// Clipboard
		cut: {
			id: 'cut',
			label: m.menu.cut,
			icon: 'icon-[material-symbols-light--content-cut]',
			shortcut: { key: 'x', ctrl: true },
			enabled: () => !!page.editor && editableItems(page.editor).length > 0,
			run: withEditor((editor) => {
				clipboard.copy(editor.project, editableItems(editor));
				removeSelected(editor, false);
			})
		},
		copy: {
			id: 'copy',
			label: m.menu.copy,
			icon: 'icon-[material-symbols-light--content-copy]',
			shortcut: { key: 'c', ctrl: true },
			enabled: () => !!page.editor?.selectedItems.length,
			run: withEditor((editor) => clipboard.copy(editor.project, editor.selectedItems))
		},
		paste: {
			id: 'paste',
			label: m.menu.paste,
			icon: 'icon-[material-symbols-light--content-paste]',
			shortcut: { key: 'v', ctrl: true },
			enabled: () => ready() && !clipboard.empty,
			run: withEditor((editor, player) => pasteClipboard(editor, player))
		},
		duplicate: {
			id: 'duplicate',
			label: m.menu.duplicate,
			tip: m.menu.duplicateTip,
			icon: 'icon-[material-symbols-light--content-copy-outline]',
			enabled: () => !!page.editor && editableItems(page.editor).length > 0,
			run: withEditor((editor) => {
				// Right after the selection, where it is in the frame; in front of what lies there
				const items = editableItems(editor);
				const at = Math.max(...items.map(itemEnd));
				const { timeline, ids } = pasteItems(editor.project.timeline, items, at);
				editor.update(() => timeline);
				editor.selectItems(ids);
			})
		},

		// Selection
		selectAll: {
			id: 'selectAll',
			label: m.editor.selectAll,
			icon: 'icon-[material-symbols-light--select-all]',
			shortcut: { key: 'a', ctrl: true },
			enabled: () => !!page.editor?.project.timeline.items.length,
			run: withEditor((editor) => editor.selectItems(editor.project.timeline.items.map((item) => item.id)))
		},
		snap: {
			id: 'snap',
			label: m.editor.snapping,
			tip: m.editor.snappingTitle,
			icon: 'icon-[material-symbols-light--grid-guides-outline]',
			active: () => snapping.enabled,
			run: () => (snapping.enabled = !snapping.enabled)
		},

		// Arrange (one item's track) and links
		toFront: arrange('toFront', m.menu.toFront, 'icon-[material-symbols-light--flip-to-front]', bringToFront, 'ArrowUp', true),
		forward: arrange('forward', m.menu.forward, 'icon-[material-symbols-light--arrow-upward]', bringForward, 'ArrowUp', false),
		backward: arrange('backward', m.menu.backward, 'icon-[material-symbols-light--arrow-downward]', sendBackward, 'ArrowDown', false),
		toBack: arrange('toBack', m.menu.toBack, 'icon-[material-symbols-light--flip-to-back]', sendToBack, 'ArrowDown', true),
		link: {
			id: 'link',
			label: m.inspector.link,
			tip: m.inspector.linkTitle,
			icon: 'icon-[material-symbols-light--link]',
			shortcut: { key: 'g', ctrl: true },
			enabled: () => !!page.editor?.canLink,
			run: () => page.editor?.link()
		},
		unlink: {
			id: 'unlink',
			label: m.inspector.unlink,
			tip: m.inspector.unlinkTitle,
			icon: 'icon-[material-symbols-light--link-off]',
			shortcut: { key: 'g', ctrl: true, shift: true },
			enabled: () => !!page.editor && editableItems(page.editor).some((item) => item.group),
			run: () => page.editor?.unlink()
		},

		// Clip
		crop: {
			id: 'crop',
			label: m.inspector.crop,
			tip: m.inspector.cropHint,
			icon: 'icon-[material-symbols-light--crop]',
			enabled: () => !!page.editor && !!pictureClip(page.editor),
			active: () => !!page.editor?.croppingClip,
			run: withEditor((editor) => {
				const clip = pictureClip(editor);
				if (editor.croppingClip) editor.endCrop();
				else if (clip) editor.startCrop(clip.id);
			})
		},
		removeCrop: {
			id: 'removeCrop',
			label: m.inspector.removeCrop,
			icon: 'icon-[material-symbols-light--crop-free]',
			enabled: () => !!page.editor && !!pictureClip(page.editor)?.crop,
			run: withEditor((editor) => {
				const clip = pictureClip(editor);
				if (clip?.crop) editor.setCrop(clip.id, FULL);
			})
		},
		fit: {
			id: 'fit',
			label: m.inspector.fit,
			icon: 'icon-[material-symbols-light--fit-screen-outline]',
			enabled: () => !!page.editor && !!pictureClip(page.editor),
			run: withEditor((editor) => {
				const clip = pictureClip(editor);
				if (clip) placeClip(editor, clip, false);
			})
		},
		fill: {
			id: 'fill',
			label: m.inspector.fill,
			icon: 'icon-[material-symbols-light--fullscreen]',
			enabled: () => !!page.editor && !!pictureClip(page.editor),
			run: withEditor((editor) => {
				const clip = pictureClip(editor);
				if (clip) placeClip(editor, clip, true);
			})
		},
		fitCanvas: {
			id: 'fitCanvas',
			label: m.inspector.fitCanvasToClip,
			tip: m.inspector.fitCanvasToClipHint,
			icon: 'icon-[material-symbols-light--fit-screen-outline]',
			enabled: () => {
				const clip = page.editor && pictureClip(page.editor);
				return !!clip && !!page.editor?.clipCanvasOf(clip.id);
			},
			run: withEditor((editor) => {
				const clip = pictureClip(editor);
				if (clip) editor.fitCanvasToClip(clip.id);
			})
		},
		mute: {
			id: 'mute',
			label: m.inspector.mute,
			get icon() {
				const clip = page.editor && soleClip(page.editor);
				return clip?.type === 'video' && clip.volume === 0
					? 'icon-[material-symbols-light--volume-off-outline]'
					: 'icon-[material-symbols-light--volume-up-outline]';
			},
			enabled: () => {
				const clip = page.editor && soleClip(page.editor);
				return clip?.type === 'video' && !!page.editor?.source(clip.sourceId)?.hasAudio;
			},
			active: () => {
				const clip = page.editor && soleClip(page.editor);
				return clip?.type === 'video' && clip.volume === 0;
			},
			run: withEditor((editor) => {
				const clip = soleClip(editor);
				if (clip?.type === 'video') editor.update((t) => updateItem(t, clip.id, { volume: clip.volume === 0 ? 1 : 0 }));
			})
		},

		// Insert
		record: {
			id: 'record',
			label: m.editor.addRecording,
			icon: 'icon-[material-symbols-light--screen-record-outline]',
			enabled: ready,
			run: () => page.actions.record()
		},
		importMedia: {
			id: 'importMedia',
			label: m.editor.importMedia,
			icon: 'icon-[material-symbols-light--upload-file]',
			enabled: ready,
			run: () => page.actions.importMedia()
		},
		importFromFiles: {
			id: 'importFromFiles',
			label: m.editor.importFromFiles,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			enabled: ready,
			run: () => page.actions.importFromFiles()
		},
		shapes: {
			id: 'shapes',
			label: m.editor.shapes,
			icon: 'icon-[material-symbols-light--shapes-outline]',
			enabled: ready,
			menu: () =>
				(['arrow', 'line', 'rect', 'ellipse'] as const).map((kind) => ({
					label: OVERLAY_KINDS[kind].label,
					icon: OVERLAY_KINDS[kind].icon,
					run: () => page.actions.addAnnotation(kind)
				}))
		},
		highlight: annotation('highlight'),
		spotlight: annotation('spotlight'),
		blur: annotation('blur'),
		step: annotation('step'),
		click: annotation('click'),
		text: annotation('text'),
		callout: annotation('callout'),
		icon: {
			id: 'icon',
			label: m.kinds.icon,
			tip: m.editor.iconTip,
			icon: OVERLAY_KINDS.icon.icon,
			enabled: ready,
			run: () => page.openPanel('icons')
		},
		barcode: {
			id: 'barcode',
			label: m.editor.barcode,
			tip: m.editor.barcodeTip,
			icon: OVERLAY_KINDS.barcode.icon,
			enabled: ready,
			run: () => page.barcode()
		},
		editBarcode: {
			id: 'editBarcode',
			label: m.editor.editBarcode,
			icon: 'icon-[material-symbols-light--edit-outline]',
			enabled: () => page.editor?.selectedOverlay?.kind === 'barcode',
			run: () => {
				const a = page.editor?.selectedOverlay;
				if (a?.kind === 'barcode') page.barcode(a);
			}
		},
		zoom: {
			id: 'zoom',
			label: m.editor.zoomSegment,
			tip: m.editor.insertTip,
			icon: ZOOM_ICON,
			enabled: ready,
			run: () => page.actions.addZoom()
		},
		saveToLibrary: {
			id: 'saveToLibrary',
			label: m.library.add,
			icon: 'icon-[material-symbols-light--bookmark-add-outline]',
			enabled: () => !!page.editor?.selectedItems.length,
			run: withEditor((editor) => saveSelection(editor))
		},

		// View
		timelineIn: {
			id: 'timelineIn',
			label: m.timeline.zoomIn,
			icon: 'icon-[material-symbols-light--zoom-in]',
			enabled: () => page.timelineZoom < TIMELINE_ZOOM.max,
			run: () => zoomTimeline(TIMELINE_ZOOM.step)
		},
		timelineOut: {
			id: 'timelineOut',
			label: m.timeline.zoomOut,
			icon: 'icon-[material-symbols-light--zoom-out]',
			enabled: () => page.timelineZoom > TIMELINE_ZOOM.min,
			run: () => zoomTimeline(1 / TIMELINE_ZOOM.step)
		},
		timelineFit: {
			id: 'timelineFit',
			label: m.timeline.fitAll,
			icon: 'icon-[material-symbols-light--fit-width]',
			enabled: () => page.timelineZoom !== TIMELINE_ZOOM.min,
			run: () => (page.timelineZoom = TIMELINE_ZOOM.min)
		},
		canvasSize: {
			id: 'canvasSize',
			label: m.editor.canvasSize,
			tip: m.inspector.changeCanvasHint,
			icon: 'icon-[material-symbols-light--aspect-ratio-outline]',
			enabled: ready,
			run: () => page.changeCanvas()
		}
	} satisfies Record<string, Command>;

	/** Keys that only run (no place in the ribbon): second keys of commands and stepping through frames */
	const keyOnly: Command[] = [
		{ ...commands.redo, id: 'redoAlt', shortcut: { key: 'y', ctrl: true } },
		{ ...commands.play, id: 'playAlt', shortcut: { key: 'k' } },
		{ ...commands.delete, id: 'deleteAlt', shortcut: { key: 'Backspace' } },
		{ ...deleteGap, id: 'deleteGapAlt', shortcut: { key: 'Backspace', shift: true } }
	];

	/** ←/→ step through frames, with Shift by a second (they repeat while held) */
	const frames: Command[] = [
		seek('frameBack', m.editor.frameBack, 'icon-[material-symbols-light--chevron-left]', 'ArrowLeft', (p) => p.time - FRAME),
		seek('frameForward', m.editor.frameForward, 'icon-[material-symbols-light--chevron-right]', 'ArrowRight', (p) => p.time + FRAME),
		seek('secondBack', m.editor.secondBack, 'icon-[material-symbols-light--keyboard-double-arrow-left]', 'ArrowLeft', (p) => p.time - 1, true),
		seek('secondForward', m.editor.secondForward, 'icon-[material-symbols-light--keyboard-double-arrow-right]', 'ArrowRight', (p) => p.time + 1, true)
	];

	return { commands, keyOnly, frames };
}

export type EditorCommands = ReturnType<typeof editorCommands>['commands'];

/** The context menu of the selection (preview and timeline): every action on items, disabled where it can't act */
export function itemMenuEntries(c: EditorCommands, properties: Command, extra: MenuEntry[] = []): MenuEntry[] {
	return [
		asEntry(c.cut),
		asEntry(c.copy),
		asEntry(c.paste),
		asEntry(c.duplicate),
		asEntry(c.delete),
		asEntry(c.deleteGap),
		{ separator: true },
		asEntry(c.split),
		asEntry(c.holdFrame),
		{ separator: true },
		asEntry(c.toFront),
		asEntry(c.forward),
		asEntry(c.backward),
		asEntry(c.toBack),
		{ separator: true },
		asEntry(c.link),
		asEntry(c.unlink),
		{ separator: true },
		asEntry(c.crop),
		asEntry(c.removeCrop),
		asEntry(c.fit),
		asEntry(c.fill),
		asEntry(c.fitCanvas),
		asEntry(c.editBarcode),
		{ separator: true },
		asEntry(c.saveToLibrary),
		asEntry(c.selectAll),
		asEntry(properties, m.editor.properties),
		...(extra.length ? [{ separator: true } as const, ...extra] : [])
	];
}
