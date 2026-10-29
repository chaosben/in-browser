// Drag & drop inside Files (entries onto folders) next to drops of the computer's files.

/** Own MIME type: JSON array of the dragged paths */
export const DRAG_TYPE = 'application/x-in-browser-files';

export function startDrag(e: DragEvent, paths: string[]) {
	e.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(paths));
	if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove';
}

/** Something Files can take: own entries or files from the computer */
export function acceptsDrag(e: DragEvent): boolean {
	const types = e.dataTransfer?.types ?? [];
	return types.includes(DRAG_TYPE) || types.includes('Files');
}

/** Paths of own entries in a drop, `null` for other drops */
export function droppedPaths(e: DragEvent): string[] | null {
	const data = e.dataTransfer?.getData(DRAG_TYPE);
	return data ? (JSON.parse(data) as string[]) : null;
}

/** Ctrl/Cmd (or Alt) copies instead of moving */
export const copyKey = (e: DragEvent) => e.ctrlKey || e.metaKey || e.altKey;
