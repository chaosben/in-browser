import { describe, expect, it } from 'vitest';
import { DEFAULT_RECORD_SETTINGS, sanitizeRecordSettings } from './settings';

describe('sanitizeRecordSettings', () => {
	it('keeps valid values and falls back to the defaults for everything else', () => {
		expect(sanitizeRecordSettings('x')).toEqual(DEFAULT_RECORD_SETTINGS);
		const s = sanitizeRecordSettings({
			camera: true,
			systemAudio: 'yes',
			screenQuality: 'low',
			cameraQuality: 'ultra',
			micKbps: 100,
			frameRate: 60,
			micProcessing: { noiseSuppression: false, autoGainControl: 'no' }
		});
		expect(s).toEqual({
			...DEFAULT_RECORD_SETTINGS,
			camera: true,
			screenQuality: 'low',
			frameRate: 60,
			micProcessing: { ...DEFAULT_RECORD_SETTINGS.micProcessing, noiseSuppression: false }
		});
	});
	it('applies the former shared audio bitrate to both sources', () => {
		expect(sanitizeRecordSettings({ audioKbps: 96 })).toMatchObject({ micKbps: 96, systemKbps: 96 });
		expect(sanitizeRecordSettings({ audioKbps: 96, micKbps: 256 })).toMatchObject({ micKbps: 256, systemKbps: 96 });
	});
});
