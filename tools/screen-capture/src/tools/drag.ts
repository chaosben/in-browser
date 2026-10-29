// Drag & drop of tool tiles and media bin entries onto the preview or the timeline (HTML drag and drop, so it
// works alongside dropping files from the desktop).

import type { AnnotationKind, IconData, ToolKind } from '#lib/project/types.js';
import { isToolKind, OVERLAY_KINDS } from '#lib/project/defaults.js';
import type { LibraryScope } from '#lib/ui/library.svelte.js';

export type DragPayload =
	| { type: 'annotation'; kind: ToolKind }
	| { type: 'zoom' }
	| { type: 'source'; id: string }
	| { type: 'image'; id: string }
	| { type: 'icon'; icon: IconData }
	| { type: 'library'; scope: LibraryScope; id: string };

const isIcon = (i: unknown): i is IconData => {
	const icon = i as IconData | null;
	return !!icon && typeof icon.name === 'string' && typeof icon.body === 'string' && icon.width > 0 && icon.height > 0;
};

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
		if (p?.type === 'annotation' && p.kind in OVERLAY_KINDS && isToolKind(p.kind as AnnotationKind)) {
			return { type: 'annotation', kind: p.kind };
		}
		if (p?.type === 'zoom') return { type: 'zoom' };
		if (p?.type === 'source' && typeof p.id === 'string') return { type: 'source', id: p.id };
		if (p?.type === 'image' && typeof p.id === 'string') return { type: 'image', id: p.id };
		if (p?.type === 'library' && (p.scope === 'project' || p.scope === 'global') && typeof p.id === 'string') {
			return { type: 'library', scope: p.scope, id: p.id };
		}
		if (p?.type === 'icon' && isIcon(p.icon)) {
			const { name, body, width, height } = p.icon;
			return { type: 'icon', icon: { name, body, width, height } };
		}
	} catch {
		// not ours
	}
	return null;
}
