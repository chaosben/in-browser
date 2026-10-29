import { describe, expect, it } from 'vitest';
import {
	avcQuantizer,
	DEFAULT_RECORD_SETTINGS,
	estimateMbPerMinute,
	recordBitrate,
	RECORD_LEVELS,
	sanitizeRecordSettings
} from './settings';

describe('sanitizeRecordSettings', () => {
	it('falls back to the defaults', () => {
		expect(sanitizeRecordSettings(null)).toEqual(DEFAULT_RECORD_SETTINGS);
		expect(sanitizeRecordSettings('x')).toEqual(DEFAULT_RECORD_SETTINGS);
	});
	it('keeps the chosen sources', () => {
		const s = sanitizeRecordSettings({ microphone: false, camera: true, systemAudio: 'yes', countdown: false, growWindow: 1 });
		expect(s).toMatchObject({ microphone: false, camera: true, systemAudio: false, countdown: false, growWindow: false });
		expect(sanitizeRecordSettings({ growWindow: true }).growWindow).toBe(true);
	});
	it('keeps valid values and drops unknown ones', () => {
		const s = sanitizeRecordSettings({
			screenQuality: 'low',
			cameraQuality: 'ultra',
			cameraResolution: 1080,
			micKbps: 100,
			frameRate: 60,
			screenEncoder: 'turbo'
		});
		expect(s).toEqual({ ...DEFAULT_RECORD_SETTINGS, screenQuality: 'low', cameraResolution: 1080, frameRate: 60 });
		expect(sanitizeRecordSettings({ screenEncoder: 'sharp' }).screenEncoder).toBe('sharp');
	});
	it('takes over the filters one by one', () => {
		const s = sanitizeRecordSettings({ micProcessing: { noiseSuppression: false, autoGainControl: 'no' } });
		expect(s.micProcessing).toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: true });
		expect(s.systemProcessing).toEqual(DEFAULT_RECORD_SETTINGS.systemProcessing);
	});
	it('applies the former shared audio bitrate to both sources', () => {
		expect(sanitizeRecordSettings({ audioKbps: 96 })).toMatchObject({ micKbps: 96, systemKbps: 96 });
		expect(sanitizeRecordSettings({ audioKbps: 96, micKbps: 256 })).toMatchObject({ micKbps: 256, systemKbps: 96 });
	});
});

describe('recordBitrate', () => {
	it('increases with the level', () => {
		for (const kind of ['screen', 'camera'] as const) {
			const rates = RECORD_LEVELS.map((level) => recordBitrate(kind, level, 1280, 720, 30));
			expect([...rates].sort((a, b) => a - b)).toEqual(rates);
		}
	});
	it('gives the webcam at "very high" clearly more than the former 2.8 Mbit/s', () => {
		expect(recordBitrate('camera', 'very-high', 1280, 720, 30)).toBeGreaterThan(5_000_000);
	});
});

describe('avcQuantizer', () => {
	it('gets finer with the level', () => {
		expect(RECORD_LEVELS.map(avcQuantizer)).toEqual([29, 25, 21, 18]);
	});
});

describe('estimateMbPerMinute', () => {
	const screen = { width: 1920, height: 1080 };
	const none = { ...DEFAULT_RECORD_SETTINGS, microphone: false, camera: false, systemAudio: false };
	it('only counts active sources', () => {
		const base = estimateMbPerMinute(none, screen);
		const all = estimateMbPerMinute({ ...none, microphone: true, camera: true, systemAudio: true }, screen);
		expect(all).toBeGreaterThan(base);
		// 192 kbit/s ≈ 1.44 MB per minute
		expect(estimateMbPerMinute({ ...none, microphone: true }, screen) - base).toBeCloseTo(1.44, 2);
	});
	it('uses the bitrate of each audio source', () => {
		const base = estimateMbPerMinute(none, screen);
		const audio = estimateMbPerMinute({ ...none, microphone: true, systemAudio: true, systemKbps: 96 }, screen) - base;
		expect(audio).toBeCloseTo(1.44 + 0.72, 2);
	});
});
