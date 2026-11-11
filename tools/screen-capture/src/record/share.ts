/** What was shared: a whole screen, a window or a browser tab */
export type ShareSurface = 'monitor' | 'window' | 'browser';

export interface ShareInfo {
	/** null when the browser doesn't tell */
	surface: ShareSurface | null;
	/** 0 when unknown */
	frameRate: number;
	/** Whether the mouse pointer is in the picture; null when the browser doesn't tell */
	cursor: 'always' | 'motion' | 'never' | null;
}

/**
 * Facts about a shared screen for the preview before recording, from the video track's settings. Not the size:
 * Chromium reports the maximum capture size there, not the shared window's – that comes from the frames.
 */
export function describeShare(settings: MediaTrackSettings & { displaySurface?: string; cursor?: string }): ShareInfo {
	const surface = settings.displaySurface;
	const cursor = settings.cursor;
	return {
		surface: surface === 'monitor' || surface === 'window' || surface === 'browser' ? surface : null,
		frameRate: Math.round(settings.frameRate ?? 0),
		cursor: cursor === 'always' || cursor === 'motion' || cursor === 'never' ? cursor : null
	};
}

/**
 * The pointer should be hidden but the browser didn't confirm it (it ignores the option or doesn't report it).
 * Shared tabs never contain the pointer.
 */
export const cursorNotHidden = (share: ShareInfo, record: boolean) => !record && share.surface !== 'browser' && share.cursor !== 'never';

/** Display scaling of the system in percent (from `devicePixelRatio`), rounded to whole percent */
export const scalePercent = (pixelRatio: number) => Math.round(pixelRatio * 100);
