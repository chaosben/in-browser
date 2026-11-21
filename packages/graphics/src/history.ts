// Undo and redo, the same in every tool that edits by steps (Notes, the PDF Editor): a step is already done when it
// is pushed and knows how to take itself back and do itself again.

/** One undo step (already done when pushed) */
export interface HistoryStep {
	undo(): void;
	redo(): void;
}

/** Steps kept for undoing; older ones are dropped */
export const HISTORY_LIMIT = 300;

/** Undo and redo of steps (redo is dropped when a new step comes) */
export class History<S extends HistoryStep = HistoryStep> {
	private undoSteps: S[] = [];
	private redoSteps: S[] = [];

	constructor(private readonly limit = HISTORY_LIMIT) {}

	get canUndo() {
		return this.undoSteps.length > 0;
	}

	get canRedo() {
		return this.redoSteps.length > 0;
	}

	/** The step `undo` would take back */
	get last(): S | undefined {
		return this.undoSteps.at(-1);
	}

	push(step: S) {
		this.undoSteps.push(step);
		if (this.undoSteps.length > this.limit) this.undoSteps.shift();
		this.redoSteps = [];
	}

	/** Undoes the last step; false: nothing to undo */
	undo(): boolean {
		const step = this.undoSteps.pop();
		if (!step) return false;
		step.undo();
		this.redoSteps.push(step);
		return true;
	}

	/** Does the last undone step again; false: nothing to redo */
	redo(): boolean {
		const step = this.redoSteps.pop();
		if (!step) return false;
		step.redo();
		this.undoSteps.push(step);
		return true;
	}

	clear() {
		this.undoSteps = [];
		this.redoSteps = [];
	}
}

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
