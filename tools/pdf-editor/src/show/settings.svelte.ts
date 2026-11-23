// What presenting remembers on this device (`pdf-editor:present`): how “Present” starts and the size of the notes'
// text in the presenter view.

const KEY = 'pdf-editor:present';

/** “Present” with the presenter view and the slides in a window of their own, or the slides only (one screen) */
export type PresentMode = 'presenter' | 'display';

/** Sizes of the notes' text (px) */
export const NOTE_SIZES = [14, 16, 18, 21, 24, 28, 34] as const;

class PresentSettings {
	mode = $state<PresentMode>('presenter');
	noteSize = $state(18);

	constructor() {
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { mode?: unknown; noteSize?: unknown };
			if (saved.mode === 'presenter' || saved.mode === 'display') this.mode = saved.mode;
			if (typeof saved.noteSize === 'number' && (NOTE_SIZES as readonly number[]).includes(saved.noteSize)) this.noteSize = saved.noteSize;
		} catch {
			// Storage blocked or broken: the defaults
		}
	}

	store() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ mode: this.mode, noteSize: this.noteSize }));
		} catch {
			// Kept for this page only
		}
	}

	/** The notes' text one size larger (1) or smaller (-1) */
	resizeNotes(by: 1 | -1) {
		const i = NOTE_SIZES.indexOf(this.noteSize as (typeof NOTE_SIZES)[number]);
		const next = NOTE_SIZES[Math.min(NOTE_SIZES.length - 1, Math.max(0, (i < 0 ? 2 : i) + by))];
		if (next === this.noteSize) return;
		this.noteSize = next;
		this.store();
	}
}

export const presentSettings = new PresentSettings();
