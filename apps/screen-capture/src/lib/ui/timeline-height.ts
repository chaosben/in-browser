/** Height of the timeline area: fixed and draggable, so adding tracks never squeezes the preview (persisted) */

const STORAGE_KEY = 'screen-capture:timeline-height';
export const DEFAULT_TIMELINE_HEIGHT = 260;
const MIN = 140;
/** Share of the window the timeline may take at most */
const MAX_SHARE = 0.7;

/** Keeps the height usable for the window: at least `MIN`, at most 70 % of the window (but never below `MIN`) */
export function clampTimelineHeight(px: number, windowHeight: number) {
	return Math.round(Math.max(MIN, Math.min(px, windowHeight * MAX_SHARE)));
}

export function loadTimelineHeight(): number {
	try {
		const value = Number(localStorage.getItem(STORAGE_KEY));
		if (Number.isFinite(value) && value > 0) return value;
	} catch {
		// localStorage not available
	}
	return DEFAULT_TIMELINE_HEIGHT;
}

export function storeTimelineHeight(px: number) {
	try {
		localStorage.setItem(STORAGE_KEY, String(Math.round(px)));
	} catch {
		// ignore
	}
}
