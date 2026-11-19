// Device previews of the recording dialog: live webcam picture and microphone level meter, so the right devices
// (and the effect of the filters) can be recognised before recording

import { devices, openDevice, type DeviceKind, type DeviceSettings } from './devices.svelte.js';

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

export class DevicePreview {
	/** Open webcam for the preview */
	camera = $state.raw<MediaStream | null>(null);
	/** The webcam preview shows a picture (until then a spinner keeps the space) */
	cameraPlaying = $state(false);
	/** Peak level of the microphone (0…1), falling off slowly */
	micLevel = $state(0);
	/** Devices that could not be opened */
	error = $state<Partial<Record<DeviceKind, boolean>>>({});

	/**
	 * Opens the chosen device (also unlocks the device names); returns the cleanup. Reads the settings the device
	 * depends on, so an `$effect` calling it reopens it when they change. `onopen` returns its own cleanup.
	 */
	#open(kind: DeviceKind, deviceId: string | undefined, settings: DeviceSettings, onopen: (stream: MediaStream) => () => void) {
		let cancelled = false;
		let stream: MediaStream | null = null;
		let cleanup = () => {};
		openDevice(kind, deviceId, settings)
			.then((s) => {
				if (cancelled) return stopStream(s);
				stream = s;
				this.error[kind] = false;
				cleanup = onopen(s);
				devices.refresh().catch(() => {});
			})
			.catch(() => (this.error[kind] = true));
		return () => {
			cancelled = true;
			cleanup();
			stopStream(stream);
		};
	}

	/** Level meter of the chosen microphone until the returned cleanup runs */
	openMicrophone(deviceId: string | undefined, settings: DeviceSettings) {
		return this.#open('microphone', deviceId, settings, (stream) => this.meter(stream));
	}

	/** Live picture of the chosen webcam in `camera` until the returned cleanup runs */
	openCamera(deviceId: string | undefined, settings: DeviceSettings) {
		return this.#open('camera', deviceId, settings, (stream) => {
			this.camera = stream;
			return () => {
				this.camera = null;
				this.cameraPlaying = false;
			};
		});
	}

	/** Shows the level of a microphone stream in `micLevel` until the returned cleanup runs */
	meter(stream: MediaStream) {
		const context = new AudioContext();
		const analyser = context.createAnalyser();
		analyser.fftSize = 512;
		context.createMediaStreamSource(stream).connect(analyser);
		const data = new Float32Array(analyser.fftSize);
		let raf = 0;
		const measure = () => {
			analyser.getFloatTimeDomainData(data);
			let peak = 0;
			for (const v of data) peak = Math.max(peak, Math.abs(v));
			this.micLevel = Math.max(peak, this.micLevel * 0.85);
			raf = requestAnimationFrame(measure);
		};
		measure();
		return () => {
			cancelAnimationFrame(raf);
			context.close().catch(() => {});
			this.micLevel = 0;
		};
	}
}
