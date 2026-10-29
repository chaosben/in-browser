/**
 * Drops all history steps that still use something (e.g. a media source about to be deleted): undo keeps only
 * the steps after the last one using it, redo is cleared entirely if any step uses it.
 */
export function pruneHistory<T>(undo: T[], redo: T[], uses: (state: T) => boolean): { undo: T[]; redo: T[] } {
	const last = undo.findLastIndex(uses);
	return {
		undo: last < 0 ? undo : undo.slice(last + 1),
		redo: redo.some(uses) ? [] : redo
	};
}
