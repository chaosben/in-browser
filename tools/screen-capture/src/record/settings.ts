import { Quality, type VideoCodec } from 'mediabunny';
import type { QualityPreset } from '#lib/export/settings.js';

export type RecordLevel = Exclude<QualityPreset, 'custom'>;

export const RECORD_LEVELS: readonly RecordLevel[] = ['low', 'medium', 'high', 'very-high'];
export const AUDIO_RATES = [96, 128, 192, 256] as const;
export const CAMERA_RESOLUTIONS = [720, 1080] as const;
export const FRAME_RATES = [30, 60] as const;
/** `auto`: hardware encoder if available (low CPU load), `sharp`: software VP9 (sharpest text) */
export const SCREEN_ENCODER_MODES = ['auto', 'sharp'] as const;
export type ScreenEncoderMode = (typeof SCREEN_ENCODER_MODES)[number];
/** Browser voice processing, switchable per audio source */
export const AUDIO_FILTERS = ['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const;

export type AudioProcessing = Record<(typeof AUDIO_FILTERS)[number], boolean>;
export type AudioKbps = (typeof AUDIO_RATES)[number];

/** Webcams are always recorded at this frame rate */
export const CAMERA_FPS = 30;

/** Recording settings: sources, countdown and quality per source (persisted) */
export interface RecordSettings {
	microphone: boolean;
	camera: boolean;
	systemAudio: boolean;
	/** 3-second countdown before recording starts */
	countdown: boolean;
	screenQuality: RecordLevel;
	cameraQuality: RecordLevel;
	cameraResolution: (typeof CAMERA_RESOLUTIONS)[number];
	/** Audio bitrates in kbit/s */
	micKbps: AudioKbps;
	systemKbps: AudioKbps;
	/** Voice processing: meant for speech, dulls music */
	micProcessing: AudioProcessing;
	systemProcessing: AudioProcessing;
	frameRate: (typeof FRAME_RATES)[number];
	/** A shared window/tab may grow while recording: encodes at monitor size (more CPU) instead of the start size */
	growWindow: boolean;
	screenEncoder: ScreenEncoderMode;
}

export const DEFAULT_RECORD_SETTINGS: RecordSettings = {
	microphone: true,
	camera: false,
	systemAudio: false,
	countdown: true,
	screenQuality: 'high',
	cameraQuality: 'very-high',
	cameraResolution: 720,
	micKbps: 192,
	systemKbps: 192,
	micProcessing: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
	systemProcessing: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
	frameRate: 30,
	growWindow: false,
	screenEncoder: 'auto'
};

/**
 * Screen recordings are encoded at constant quality (quantizer, like CRF) where the encoder supports it: still
 * screens cost almost nothing and stay sharp, motion gets the bits it needs. Mediabunny maps the level to the
 * codec's quantizer scale (or to a bitrate as fallback). Text needs more than its video default.
 */
export const SCREEN_QUALITY: Record<RecordLevel, number> = { low: 0.5, medium: 0.65, high: 0.8, 'very-high': 0.92 };

/**
 * Quality of the screen video. H.264 (usually a hardware encoder here) lacks screen-content tools: it gets an
 * explicit quantizer (scale 0–51, like Mediabunny's mapping of `SCREEN_QUALITY`) and our generous bitrate as
 * fallback, since hardware encoders often only support bitrates.
 */
export function screenQuality(codec: VideoCodec, level: RecordLevel, width: number, height: number, fps: number) {
	if (codec !== 'avc') return new Quality({ quality: SCREEN_QUALITY[level], bitrateMode: 'variable' });
	return new Quality({
		quantizer: avcQuantizer(level),
		bitrate: recordBitrate('screen', level, width, height, fps),
		bitrateMode: 'variable'
	});
}

export const avcQuantizer = (level: RecordLevel) => Math.round(41 - 25 * SCREEN_QUALITY[level]);

// Bits per pixel and frame. Live tracks are encoded in realtime mode: webcam images are noisy and move constantly,
// screen recordings need headroom for sharp text edges (they are re-encoded on export). For the screen this is only
// the upper estimate shown in the dialog, see `SCREEN_QUALITY`.
const BITS_PER_PIXEL: Record<'screen' | 'camera', Record<RecordLevel, number>> = {
	screen: { low: 0.06, medium: 0.1, high: 0.16, 'very-high': 0.25 },
	camera: { low: 0.06, medium: 0.1, high: 0.14, 'very-high': 0.2 }
};

export function recordBitrate(kind: 'screen' | 'camera', level: RecordLevel, width: number, height: number, fps: number) {
	// At high frame rates less changes per frame – don't scale linearly (as in the export).
	const effectiveFps = Math.min(fps, 30) + Math.max(fps - 30, 0) * 0.5;
	return Math.round(width * height * effectiveFps * BITS_PER_PIXEL[kind][level]);
}

export function cameraSize(resolution: RecordSettings['cameraResolution']) {
	return resolution === 1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

/** Approximate file size per minute of all active sources, in MB (upper estimate for the screen) */
export function estimateMbPerMinute(settings: RecordSettings, screen: { width: number; height: number }) {
	let bitrate = recordBitrate('screen', settings.screenQuality, screen.width, screen.height, settings.frameRate);
	if (settings.camera) {
		const { width, height } = cameraSize(settings.cameraResolution);
		bitrate += recordBitrate('camera', settings.cameraQuality, width, height, CAMERA_FPS);
	}
	if (settings.microphone) bitrate += settings.micKbps * 1000;
	if (settings.systemAudio) bitrate += settings.systemKbps * 1000;
	return (bitrate * 60) / 8 / 1_000_000;
}

const STORAGE_KEY = 'screen-capture:record-settings';

/** Takes over valid values only; everything else falls back to the default. */
export function sanitizeRecordSettings(raw: unknown): RecordSettings {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof RecordSettings | 'audioKbps', unknown>>;
	const pick = <T>(value: unknown, allowed: readonly T[], fallback: T) =>
		allowed.includes(value as T) ? (value as T) : fallback;
	const d = DEFAULT_RECORD_SETTINGS;
	const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
	const filters = (value: unknown, fallback: AudioProcessing) => {
		const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof AudioProcessing, unknown>>;
		return Object.fromEntries(AUDIO_FILTERS.map((f) => [f, flag(v[f], fallback[f])])) as AudioProcessing;
	};
	// Formerly one bitrate for both audio sources
	const kbps = (value: unknown, fallback: AudioKbps) => pick(value ?? r.audioKbps, AUDIO_RATES, fallback);
	return {
		microphone: flag(r.microphone, d.microphone),
		camera: flag(r.camera, d.camera),
		systemAudio: flag(r.systemAudio, d.systemAudio),
		countdown: flag(r.countdown, d.countdown),
		screenQuality: pick(r.screenQuality, RECORD_LEVELS, d.screenQuality),
		cameraQuality: pick(r.cameraQuality, RECORD_LEVELS, d.cameraQuality),
		cameraResolution: pick(r.cameraResolution, CAMERA_RESOLUTIONS, d.cameraResolution),
		micKbps: kbps(r.micKbps, d.micKbps),
		systemKbps: kbps(r.systemKbps, d.systemKbps),
		micProcessing: filters(r.micProcessing, d.micProcessing),
		systemProcessing: filters(r.systemProcessing, d.systemProcessing),
		frameRate: pick(r.frameRate, FRAME_RATES, d.frameRate),
		growWindow: flag(r.growWindow, d.growWindow),
		screenEncoder: pick(r.screenEncoder, SCREEN_ENCODER_MODES, d.screenEncoder)
	};
}

export function loadRecordSettings(): RecordSettings {
	try {
		return sanitizeRecordSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
	} catch {
		// localStorage not available or invalid JSON
		return { ...DEFAULT_RECORD_SETTINGS };
	}
}

export function storeRecordSettings(settings: RecordSettings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
}
