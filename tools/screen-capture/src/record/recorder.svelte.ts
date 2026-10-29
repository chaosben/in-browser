import {
	MediaStreamAudioTrackSource,
	MediaStreamVideoTrackSource,
	Mp4OutputFormat,
	Output,
	Quality,
	StreamTarget,
	type AudioCodec,
	type VideoSample
} from 'mediabunny';
import { captureLayout, placeInBox } from '#lib/media/content.js';
import { pickAudioCodec } from '#lib/media/media.js';
import { openDevice } from './devices.svelte.js';
import { pickEncoder, pickScreenEncoder } from './encoder.js';
import { CAMERA_FPS, recordBitrate, screenQuality, type RecordLevel, type RecordSettings } from './settings.js';
import { newId, type Source, type SourceSize } from '#lib/project/types.js';
import { deleteMediaFile, mediaWritable } from '#lib/storage/store.js';
import { m } from '#lib/i18n/index.js';

export interface RecordOptions {
	microphone: boolean;
	/** Also record system or tab audio (only partially supported by browsers). */
	systemAudio: boolean;
	/** Record the webcam as a separate file */
	camera: boolean;
	/** Chosen devices (missing: default device) */
	microphoneId?: string;
	cameraId?: string;
	/** Quality per source, frame rate */
	settings: RecordSettings;
}

/**
 * Keyframe interval in seconds. Screen recordings get one per second so seeking stays fast; webcams get fewer,
 * which leaves more of their bitrate for detail.
 */
const KEYFRAMES = { screen: 1, camera: 2 } as const;

/** Recordings are re-encoded on export anyway, so prefer the better-sounding Opus for them. */
const RECORD_AUDIO_CODECS = ['opus', 'aac'] as const;

export type RecorderState = 'idle' | 'recording' | 'paused' | 'finalizing' | 'done';

type Role = 'screen' | 'camera' | 'mic';

interface Size {
	width: number;
	height: number;
}

const even = (n: number) => Math.ceil(n / 2) * 2;

type TrackSource = MediaStreamVideoTrackSource | MediaStreamAudioTrackSource;

/** One output file of the recording */
interface Part {
	role: Role;
	fileName: string;
	output: Output;
	sources: TrackSource[];
}

/**
 * Records the screen (+ system audio), optionally webcam and microphone simultaneously as separate MP4 files in
 * the OPFS – they become separate, linked tracks in the project. Keyframes every second so preview and
 * export can seek quickly.
 */
export class Recorder {
	state = $state<RecorderState>('idle');
	elapsed = $state(0);
	/** Notice, e.g. when no audio could be recorded. */
	warning = $state<string | null>(null);
	/** Webcam stream (for the preview in the dialog) */
	camera = $state.raw<MediaStream | null>(null);

	#display: MediaStream | null = null;
	#mic: MediaStream | null = null;
	#parts: Part[] = [];
	#timer: ReturnType<typeof setInterval> | undefined;
	#lastTick = 0;
	#onEnded: (() => void) | null = null;
	/** Fixed size of the screen video; windows are drawn 1:1 and centered into it, see `#video` */
	#box: Size | null = null;
	/** Largest window and size changes over time */
	#max: Size = { width: 0, height: 0 };
	#sizes: SourceSize[] = [];

	constructor(private projectId: string) {}

	/** File names of the recorded parts */
	get files(): Partial<Record<Role, string>> {
		return Object.fromEntries(this.#parts.map((p) => [p.role, p.fileName]));
	}

	/** Size fields of the screen source: only the area of the largest window, see `captureLayout` */
	get screenLayout(): Pick<Source, 'width' | 'height' | 'crop' | 'sizes'> | null {
		return this.#box && this.#max.width > 0 ? captureLayout(this.#box, this.#max, this.#sizes) : null;
	}

	/** Requests screen, microphone and webcam (browser dialogs). Must be called from a user action. */
	async acquire(options: RecordOptions): Promise<MediaStream> {
		this.#display = await navigator.mediaDevices.getDisplayMedia({
			video: { frameRate: { ideal: options.settings.frameRate, max: options.settings.frameRate } },
			audio: options.systemAudio && { ...options.settings.systemProcessing },
			// Chromium-specific options
			...({ selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include' } as object)
		});
		if (options.microphone) {
			try {
				this.#mic = await openDevice('microphone', options.microphoneId, options.settings);
			} catch {
				this.warning = m.record.noMicrophone;
			}
		}
		if (options.camera) {
			try {
				this.camera = await openDevice('camera', options.cameraId, options.settings);
			} catch {
				this.warning ??= m.record.noCamera;
			}
		}
		if (options.systemAudio && this.#display.getAudioTracks().length === 0) {
			this.warning ??= m.record.noSystemAudio;
		}
		return this.#display;
	}

	/** Starts recording. `onEnded` is called when the user stops sharing in the browser. */
	async start(options: RecordOptions, onEnded: () => void) {
		if (!this.#display) throw new Error(m.record.noSource);
		const screenTrack = this.#display.getVideoTracks()[0];
		const audioCodec = this.#display.getAudioTracks().length || this.#mic ? await pickAudioCodec(RECORD_AUDIO_CODECS) : null;
		if ((this.#display.getAudioTracks().length || this.#mic) && !audioCodec) this.warning = m.record.noAudioEncoder;

		// Screen with system audio
		const screen = await this.#part('screen');
		// Keep sharp text over smooth motion (capture and encoder)
		screenTrack.contentHint = 'text';
		const { settings } = options;
		screen.sources.push(await this.#video(screen, screenTrack, 'screen', settings.screenQuality, settings.frameRate, settings));
		const systemAudio = this.#display.getAudioTracks()[0];
		if (systemAudio && audioCodec) screen.sources.push(this.#audio(screen, systemAudio, audioCodec, settings.systemKbps));

		const cameraTrack = this.camera?.getVideoTracks()[0];
		if (cameraTrack) {
			const part = await this.#part('camera');
			part.sources.push(await this.#video(part, cameraTrack, 'camera', settings.cameraQuality, CAMERA_FPS));
		}
		const micTrack = this.#mic?.getAudioTracks()[0];
		if (micTrack && audioCodec) {
			const part = await this.#part('mic');
			part.sources.push(this.#audio(part, micTrack, audioCodec, settings.micKbps));
		}

		this.#onEnded = onEnded;
		screenTrack.addEventListener('ended', this.#handleEnded);
		// Start all files as simultaneously as possible so the tracks are in sync
		await Promise.all(this.#parts.map((p) => p.output.start()));
		this.state = 'recording';
		this.#lastTick = performance.now();
		this.#timer = setInterval(() => {
			const now = performance.now();
			if (this.state === 'recording') this.elapsed += (now - this.#lastTick) / 1000;
			this.#lastTick = now;
		}, 200);
		// Source errors (e.g. encoder crash) end the recording.
		Promise.race(this.#parts.flatMap((p) => p.sources.map((s) => s.errorPromise))).catch((e) => {
			this.warning = m.record.failed(e instanceof Error ? e.message : String(e));
			this.#handleEnded();
		});
	}

	async #part(role: Role): Promise<Part> {
		const fileName = `${newId()}.mp4`;
		const writable = await mediaWritable(this.projectId, fileName);
		const output = new Output({
			format: new Mp4OutputFormat({ fastStart: false }),
			target: new StreamTarget(writable, { chunked: true })
		});
		const part: Part = { role, fileName, output, sources: [] };
		this.#parts.push(part);
		return part;
	}

	async #video(
		part: Part,
		track: MediaStreamTrack,
		kind: 'screen' | 'camera',
		level: RecordLevel,
		frameRate: number,
		screenOptions?: Pick<RecordSettings, 'growWindow' | 'screenEncoder'>
	) {
		const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
		let { width = 1920, height = 1080 } = settings;
		// A shared window can change its size, but the encoder needs a fixed one: record into a box and keep the
		// window unscaled. The box is the start size (larger windows get scaled down) or, if the window may grow,
		// the monitor – at the cost of encoding that much. The source later only uses the largest window. A whole
		// monitor keeps its size and needs no box.
		const box =
			kind === 'screen' && settings.displaySurface !== 'monitor'
				? screenOptions?.growWindow
					? {
							width: even(Math.max(width, screen.width * devicePixelRatio)),
							height: even(Math.max(height, screen.height * devicePixelRatio))
						}
					: { width: even(width), height: even(height) }
				: null;
		// Screen: constant quality, see `screenQuality`; bitrates follow the shared surface, not the box. Webcam:
		// explicit bitrate, since its noise would blow up constant-quality files; it also matches the size estimate.
		const surface = { width, height };
		if (box) ({ width, height } = box);
		const encoder =
			kind === 'screen'
				? await pickScreenEncoder(width, height, screenOptions?.screenEncoder ?? 'auto')
				: await pickEncoder(['avc', 'vp9', 'av1'], width, height);
		if (!encoder) throw new Error(m.record.noVideoEncoder);
		const quality =
			kind === 'screen'
				? screenQuality(encoder.codec, level, surface.width, surface.height, frameRate)
				: new Quality({ bitrate: recordBitrate(kind, level, width, height, frameRate) });
		const source = new MediaStreamVideoTrackSource(
			track as MediaStreamVideoTrack,
			{
				codec: encoder.codec,
				quality,
				keyFrameInterval: KEYFRAMES[kind],
				contentHint: kind === 'screen' ? 'text' : undefined,
				hardwareAcceleration: encoder.acceleration,
				// With window captures the size changes when the window is resized; the box keeps it constant.
				sizeChangeBehavior: box ? 'passThrough' : 'contain',
				transform: box ? { process: this.#intoBox(box) } : undefined
			},
			{ frameRate }
		);
		part.output.addVideoTrack(source, { frameRate });
		return source;
	}

	/** Draws every frame 1:1 and centered into the box and remembers the window size over time */
	#intoBox(box: Size) {
		this.#box = box;
		const canvas = new OffscreenCanvas(box.width, box.height);
		const ctx = canvas.getContext('2d', { alpha: false })!;
		let last: Size | null = null;
		return (sample: VideoSample) => {
			const place = placeInBox(box, { width: sample.displayWidth, height: sample.displayHeight });
			if (place.width !== last?.width || place.height !== last.height) {
				last = { width: place.width, height: place.height };
				this.#sizes.push({ t: sample.timestamp, ...last });
				this.#max = { width: Math.max(this.#max.width, last.width), height: Math.max(this.#max.height, last.height) };
			}
			// Fills the box exactly (the usual case): pass it through without a copy
			if (place.x === 0 && place.y === 0 && place.width === box.width && place.height === box.height) return sample;
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 0, box.width, box.height);
			sample.draw(ctx, place.x, place.y, place.width, place.height);
			return canvas;
		};
	}

	#audio(part: Part, track: MediaStreamTrack, codec: AudioCodec, kbps: number) {
		const source = new MediaStreamAudioTrackSource(track as MediaStreamAudioTrack, {
			codec,
			quality: new Quality({ bitrate: kbps * 1000 })
		});
		part.output.addAudioTrack(source);
		return source;
	}

	#handleEnded = () => {
		if (this.state === 'recording' || this.state === 'paused') this.#onEnded?.();
	};

	pause() {
		if (this.state !== 'recording') return;
		for (const p of this.#parts) p.sources.forEach((s) => s.pause());
		this.state = 'paused';
	}

	resume() {
		if (this.state !== 'paused') return;
		for (const p of this.#parts) p.sources.forEach((s) => s.resume());
		this.state = 'recording';
	}

	/** Stops recording and finalizes all files. */
	async stop(): Promise<void> {
		if (this.state !== 'recording' && this.state !== 'paused') return;
		this.state = 'finalizing';
		clearInterval(this.#timer);
		try {
			await Promise.all(this.#parts.map((p) => p.output.finalize()));
		} finally {
			this.#release();
		}
		this.state = 'done';
	}

	/** Aborts and discards all files. */
	async cancel(): Promise<void> {
		clearInterval(this.#timer);
		for (const p of this.#parts) {
			if (p.output.state !== 'finalized') await p.output.cancel().catch(() => {});
		}
		this.#release();
		await Promise.all(this.#parts.map((p) => deleteMediaFile(this.projectId, p.fileName)));
		this.#parts = [];
		this.state = 'idle';
	}

	#release() {
		this.#display?.getVideoTracks()[0]?.removeEventListener('ended', this.#handleEnded);
		for (const stream of [this.#display, this.#mic, this.camera]) stream?.getTracks().forEach((t) => t.stop());
		this.#display = this.#mic = this.camera = null;
	}
}
