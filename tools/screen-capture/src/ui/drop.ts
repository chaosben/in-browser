// Dropping onto the editor: tool tiles, media bin and library entries (`tools/drag.ts`) and files from the desktop

import type { Player } from '#lib/preview/player.svelte.js';
import type { Editor } from '#lib/project/editor.svelte.js';
import type { Point } from '#lib/project/types.js';
import { viewAt } from '#lib/timeline/ops.js';
import { hasDragPayload, readDragPayload, type DragPayload } from '#lib/tools/drag.js';
import type { DropPlace, ToolActions } from '#lib/tools/types.js';

export type DropZone = 'timeline' | 'preview';

/** Where a tile or media entry may be dropped */
function dropZone(e: DragEvent): DropZone | null {
	const target = e.target as HTMLElement;
	if (target.closest('[data-timeline]')) return 'timeline';
	if (target.closest('[data-preview]')) return 'preview';
	return null;
}

/**
 * `dragover` on the editor: tiles and entries are accepted over the preview and the timeline (`payload`: the zone
 * under the mouse), files anywhere (`'files'`); `null` for anything else.
 */
export function dragOver(e: DragEvent): { payload: DropZone | null } | 'files' | null {
	if (hasDragPayload(e)) {
		const zone = dropZone(e);
		if (zone) {
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
		}
		return { payload: zone };
	}
	if (!e.dataTransfer?.types.includes('Files')) return null;
	e.preventDefault();
	return 'files';
}

export interface DropTarget {
	editor: Editor;
	player: Player;
	timeline: { timeAtClient(clientX: number): number } | undefined;
	actions: ToolActions;
	/** Source from the media bin into the timeline */
	insertSource(sourceId: string, at: DropPlace): void;
	/** Into the media bin; with `place` also inserted there */
	importFiles(files: FileList, place?: DropPlace): void;
}

/** Content coordinates under the mouse in the preview (also when zoomed in) */
function previewPoint(e: DragEvent, { editor, player }: DropTarget): Point | undefined {
	const el = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
	if (!el) return undefined;
	const rect = el.getBoundingClientRect();
	const view = player.forcedView ?? viewAt(editor.project.timeline, player.time);
	return {
		x: view.x + ((e.clientX - rect.left) / rect.width) * view.w,
		y: view.y + ((e.clientY - rect.top) / rect.height) * view.h
	};
}

/** On the timeline the time under the mouse, in the preview that spot; elsewhere `undefined` */
function dropPlace(e: DragEvent, target: DropTarget): DropPlace | undefined {
	const zone = dropZone(e);
	if (zone === 'timeline' && target.timeline) return { start: target.timeline.timeAtClient(e.clientX) };
	return zone === 'preview' ? { point: previewPoint(e, target) } : undefined;
}

function dropPayload(payload: DragPayload, at: DropPlace, { actions, insertSource }: DropTarget) {
	if (payload.type === 'annotation') actions.addAnnotation(payload.kind, at);
	else if (payload.type === 'zoom') actions.addZoom(at);
	else if (payload.type === 'image') actions.addImage(payload.id, at);
	else if (payload.type === 'icon') actions.addIcon(payload.icon, at);
	else if (payload.type === 'library') actions.insertLibrary(payload.scope, payload.id, at);
	else insertSource(payload.id, at);
}

/**
 * `drop` on the editor. A tile or entry goes to the time or spot under the mouse. Files go into the media bin;
 * onto the timeline they are also inserted at the drop time, onto the preview at the playhead (images at that spot).
 */
export function drop(e: DragEvent, target: DropTarget) {
	const place = dropPlace(e, target);
	const payload = readDragPayload(e);
	if (payload) {
		e.preventDefault();
		if (place) dropPayload(payload, place, target);
		return;
	}
	if (!e.dataTransfer?.files.length) return;
	e.preventDefault();
	target.importFiles(e.dataTransfer.files, place);
}
