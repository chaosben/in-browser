/** Height of the timeline area: fixed and draggable, so adding tracks never squeezes the preview (persisted) */
import { readStored, writeStored } from '@in-browser/brand/storage.js';

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
	const value = Number(readStored(STORAGE_KEY));
	return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMELINE_HEIGHT;
}

export function storeTimelineHeight(px: number) {
	writeStored(STORAGE_KEY, String(Math.round(px)));
}
