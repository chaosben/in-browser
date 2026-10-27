import { describe, expect, it } from 'vitest';
import {
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
		const s = sanitizeRecordSettings({ microphone: false, camera: true, systemAudio: 'yes', countdown: false });
		expect(s).toMatchObject({ microphone: false, camera: true, systemAudio: false, countdown: false });
	});
	it('keeps valid values and drops unknown ones', () => {
		const s = sanitizeRecordSettings({
			screenQuality: 'low',
			cameraQuality: 'ultra',
			cameraResolution: 1080,
			audioKbps: 100,
			frameRate: 60
		});
		expect(s).toEqual({ ...DEFAULT_RECORD_SETTINGS, screenQuality: 'low', cameraResolution: 1080, frameRate: 60 });
	});
});

describe('recordBitrate', () => {
	it('increases with the level, cameras get more than screens', () => {
		const rates = RECORD_LEVELS.map((level) => recordBitrate('camera', level, 1280, 720, 30));
		expect([...rates].sort((a, b) => a - b)).toEqual(rates);
		expect(recordBitrate('camera', 'high', 1280, 720, 30)).toBeGreaterThan(recordBitrate('screen', 'high', 1280, 720, 30));
	});
	it('gives the webcam at "very high" clearly more than the former 2.8 Mbit/s', () => {
		expect(recordBitrate('camera', 'very-high', 1280, 720, 30)).toBeGreaterThan(5_000_000);
	});
});

describe('estimateMbPerMinute', () => {
	const screen = { width: 1920, height: 1080 };
	it('only counts active sources', () => {
		const base = estimateMbPerMinute(DEFAULT_RECORD_SETTINGS, screen, { camera: false, audioTracks: 0 });
		const all = estimateMbPerMinute(DEFAULT_RECORD_SETTINGS, screen, { camera: true, audioTracks: 2 });
		expect(all).toBeGreaterThan(base);
		// 128 kbit/s per audio track ≈ 0.96 MB per minute
		const audio = estimateMbPerMinute(DEFAULT_RECORD_SETTINGS, screen, { camera: false, audioTracks: 1 }) - base;
		expect(audio).toBeCloseTo(0.96, 2);
	});
});
