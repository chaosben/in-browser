/** What was shared: a whole screen, a window or a browser tab */
export type ShareSurface = 'monitor' | 'window' | 'browser';

export interface ShareInfo {
	/** null when the browser doesn't tell */
	surface: ShareSurface | null;
	/** 0 when unknown */
	frameRate: number;
}

/**
 * Facts about a shared screen for the preview before recording, from the video track's settings. Not the size:
 * Chromium reports the maximum capture size there, not the shared window's – that comes from the frames.
 */
export function describeShare(settings: MediaTrackSettings & { displaySurface?: string }): ShareInfo {
	const surface = settings.displaySurface;
	return {
		surface: surface === 'monitor' || surface === 'window' || surface === 'browser' ? surface : null,
		frameRate: Math.round(settings.frameRate ?? 0)
	};
}

/** Display scaling of the system in percent (from `devicePixelRatio`), rounded to whole percent */
export const scalePercent = (pixelRatio: number) => Math.round(pixelRatio * 100);
