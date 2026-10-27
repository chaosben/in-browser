import { m } from '#lib/i18n/index.js';

export type QualityPreset = 'low' | 'medium' | 'high' | 'very-high' | 'custom';

export interface ExportSettings {
	/** Target height in pixels, `0` = original project resolution. */
	height: number;
	fps: 15 | 24 | 30 | 60;
	quality: QualityPreset;
	/** Only with `quality: 'custom'`, in Mbit/s. */
	customMbps: number;
	/** Audio bitrate in kbit/s, `0` = no audio. */
	audioKbps: 0 | 96 | 128 | 192 | 256;
}

export const DEFAULT_SETTINGS: ExportSettings = {
	height: 0,
	fps: 30,
	quality: 'high',
	customMbps: 8,
	audioKbps: 192
};

export const RESOLUTIONS = [2160, 1440, 1080, 720, 480] as const;

export const QUALITY_LABELS: Record<QualityPreset, string> = m.export.qualities;

// Bits per pixel and frame. Screen content (text, flat areas) compresses well,
// so the values are below typical camera footage.
const BITS_PER_PIXEL: Record<Exclude<QualityPreset, 'custom'>, number> = {
	low: 0.04,
	medium: 0.07,
	high: 0.12,
	'very-high': 0.2
};

/** Output size: never upscale, even pixel counts (required for H.264). */
export function outputSize(
	settings: Pick<ExportSettings, 'height'>,
	projectWidth: number,
	projectHeight: number
) {
	const height = settings.height > 0 ? Math.min(settings.height, projectHeight) : projectHeight;
	const width = (projectWidth / projectHeight) * height;
	const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
	return { width: even(width), height: even(height) };
}

export function videoBitrate(settings: ExportSettings, width: number, height: number): number {
	if (settings.quality === 'custom') return Math.round(settings.customMbps * 1_000_000);
	// At high frame rates less changes per frame – don't scale linearly.
	const effectiveFps = Math.min(settings.fps, 30) + Math.max(settings.fps - 30, 0) * 0.5;
	return Math.round(width * height * effectiveFps * BITS_PER_PIXEL[settings.quality]);
}

export function estimateBytes(settings: ExportSettings, width: number, height: number, seconds: number) {
	const bits = (videoBitrate(settings, width, height) + settings.audioKbps * 1000) * seconds;
	return bits / 8;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const STORAGE_KEY = 'screen-capture:export-settings';

export function loadSettings(): ExportSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
	} catch {
		// localStorage not available
	}
	return { ...DEFAULT_SETTINGS };
}

export function storeSettings(settings: ExportSettings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
}
