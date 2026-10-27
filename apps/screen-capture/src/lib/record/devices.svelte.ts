// Microphone and camera selection for recordings. Device names are only available after the user has granted
// access once, so the dialog opens the device (preview, level meter) before the list is refreshed.

import { CAMERA_FPS, cameraSize, type RecordSettings } from './settings.js';

/** What the constraints of a device depend on */
export type DeviceSettings = Pick<RecordSettings, 'cameraResolution' | 'micProcessing'>;

const STORAGE_KEY = 'screen-capture:record-devices';

export type DeviceKind = 'microphone' | 'camera';

function constraints(kind: DeviceKind, settings: DeviceSettings): MediaTrackConstraints {
	if (kind === 'microphone') return { ...settings.micProcessing };
	const { width, height } = cameraSize(settings.cameraResolution);
	return { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: CAMERA_FPS } };
}

/** Opens the chosen device with the given settings; if it is gone, falls back to the default device once. */
export async function openDevice(kind: DeviceKind, deviceId: string | undefined, settings: DeviceSettings): Promise<MediaStream> {
	// Read the constraints right away (also outside a retry), so effects calling this depend on them
	const base = constraints(kind, settings);
	const request = (id?: string) => {
		const track = { ...base, ...(id && { deviceId: { exact: id } }) };
		return navigator.mediaDevices.getUserMedia(kind === 'microphone' ? { audio: track } : { video: track });
	};
	if (!deviceId) return request();
	try {
		return await request(deviceId);
	} catch (e) {
		if (e instanceof DOMException && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) return request();
		throw e;
	}
}

function load(): Partial<Record<DeviceKind, string>> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
	} catch {
		// localStorage not available
		return {};
	}
}

/** Available devices and the chosen ones (persisted) */
class Devices {
	microphones = $state.raw<MediaDeviceInfo[]>([]);
	cameras = $state.raw<MediaDeviceInfo[]>([]);
	/** Chosen device IDs; missing = default device */
	selected = $state(load());

	async refresh() {
		const all = await navigator.mediaDevices.enumerateDevices();
		// Without permission, browsers list devices without ID – those cannot be chosen. Chromium's aliases
		// "default"/"communications" are covered by the "default device" entry.
		const usable = (d: MediaDeviceInfo) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications';
		this.microphones = all.filter((d) => d.kind === 'audioinput' && usable(d));
		this.cameras = all.filter((d) => d.kind === 'videoinput' && usable(d));
	}

	select(kind: DeviceKind, deviceId: string | undefined) {
		this.selected[kind] = deviceId;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.selected));
		} catch {
			// ignore
		}
	}

	/** Keeps the lists up to date while devices are plugged in or out */
	watch() {
		const refresh = () => this.refresh().catch(() => {});
		navigator.mediaDevices.addEventListener('devicechange', refresh);
		refresh();
		return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
	}
}

export const devices = new Devices();
