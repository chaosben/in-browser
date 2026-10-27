// Drag & drop of tool tiles and media bin entries onto the preview or the timeline (HTML drag and drop, so it
// works alongside dropping files from the desktop).

import type { AnnotationKind } from '#lib/project/types.js';
import { OVERLAY_KINDS } from '#lib/project/defaults.js';

export type DragPayload = { type: 'annotation'; kind: AnnotationKind } | { type: 'zoom' } | { type: 'source'; id: string };

const MIME = 'application/x-screen-capture';

export function setDragPayload(e: DragEvent, payload: DragPayload) {
	if (!e.dataTransfer) return;
	e.dataTransfer.setData(MIME, JSON.stringify(payload));
	e.dataTransfer.effectAllowed = 'copy';
}

/** During `dragover` only the types are readable, not the data */
export function hasDragPayload(e: DragEvent) {
	return !!e.dataTransfer?.types.includes(MIME);
}

/** Payload of a drop; `null` for anything else (e.g. files) or invalid data */
export function readDragPayload(e: DragEvent): DragPayload | null {
	try {
		const p = JSON.parse(e.dataTransfer?.getData(MIME) || 'null');
		if (p?.type === 'annotation' && p.kind in OVERLAY_KINDS) return { type: 'annotation', kind: p.kind };
		if (p?.type === 'zoom') return { type: 'zoom' };
		if (p?.type === 'source' && typeof p.id === 'string') return { type: 'source', id: p.id };
	} catch {
		// not ours
	}
	return null;
}
