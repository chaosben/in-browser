import type { AudioCodec, VideoCodec } from 'mediabunny';
import { m } from '#lib/i18n/index.js';

export type ExportFormat = 'mp4' | 'webm' | 'gif';
export type QualityPreset = 'low' | 'medium' | 'high' | 'very-high' | 'custom';

export interface ExportSettings {
	format: ExportFormat;
	/** Target height in pixels, `0` = original project resolution. */
	height: number;
	fps: 15 | 24 | 30 | 60;
	quality: QualityPreset;
	/** Only with `quality: 'custom'`, in Mbit/s. */
	customMbps: number;
	/** Audio bitrate in kbit/s, `0` = no audio. */
	audioKbps: 0 | 96 | 128 | 192 | 256;
	/** GIF only: maximum width in pixels, `0` = original project resolution. */
	gifWidth: number;
	gifFps: 10 | 15 | 20 | 25;
	gifLoop: boolean;
}

export const DEFAULT_SETTINGS: ExportSettings = {
	format: 'mp4',
	height: 0,
	fps: 30,
	quality: 'high',
	customMbps: 8,
	audioKbps: 192,
	gifWidth: 800,
	gifFps: 15,
	gifLoop: true
};

export const FORMATS: readonly ExportFormat[] = ['mp4', 'webm', 'gif'];
export const RESOLUTIONS = [2160, 1440, 1080, 720, 480] as const;
export const GIF_WIDTHS = [1280, 1024, 800, 640, 480] as const;
export const GIF_FRAME_RATES = [10, 15, 20, 25] as const;

/** Codecs per container, in order of preference */
export const VIDEO_CODECS: Record<Exclude<ExportFormat, 'gif'>, VideoCodec[]> = {
	mp4: ['avc', 'vp9', 'av1'],
	webm: ['vp9', 'av1', 'vp8']
};
export const AUDIO_CODECS: Record<Exclude<ExportFormat, 'gif'>, AudioCodec[]> = {
	mp4: ['aac', 'opus'],
	webm: ['opus', 'vorbis']
};

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

/** Sizes the project doesn't offer (not smaller than the original) become "original". */
export function fitToProject(settings: ExportSettings, projectWidth: number, projectHeight: number): ExportSettings {
	return {
		...settings,
		height: settings.height < projectHeight ? settings.height : 0,
		gifWidth: settings.gifWidth < projectWidth ? settings.gifWidth : 0
	};
}

/** GIF output size: limited width, same aspect ratio, never upscaled. */
export function gifSize(settings: Pick<ExportSettings, 'gifWidth'>, projectWidth: number, projectHeight: number) {
	const width = settings.gifWidth > 0 ? Math.min(settings.gifWidth, projectWidth) : projectWidth;
	return { width, height: Math.max(1, Math.round((projectHeight / projectWidth) * width)) };
}

/** GIFs grow quickly: long or large ones are better exported as video. */
export function gifIsLarge(width: number, height: number, seconds: number): boolean {
	return seconds > 30 || width * height > 1280 * 720;
}

/**
 * Display time of frame `k` in 1/100 s (the unit of GIF). Rounded cumulatively, so frame rates
 * that don't divide 100 (e.g. 15 fps) keep the right speed overall.
 */
export function frameDelay(k: number, fps: number): number {
	return Math.round(((k + 1) * 100) / fps) - Math.round((k * 100) / fps);
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
