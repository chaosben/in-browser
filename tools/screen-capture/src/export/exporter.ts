import {
	AudioBufferSink,
	AudioBufferSource,
	CanvasSink,
	CanvasSource,
	canEncodeVideo,
	getFirstEncodableVideoCodec,
	Mp4OutputFormat,
	Output,
	Quality,
	StreamTarget,
	type Input,
	type InputVideoTrack,
	type WrappedCanvas
} from 'mediabunny';
import { sourceCrop, visibleAt } from '#lib/media/content.js';
import { openInput, pickAudioCodec } from '#lib/media/media.js';
import type { Project, VideoClip } from '#lib/project/types.js';
import { renderFrame, type Frame } from '#lib/render/compositor.js';
import { fontsOf, loadFont } from '#lib/render/fonts.svelte.js';
import { loadPictures, setImageProject } from '#lib/render/images.svelte.js';
import { clearExports, exportWritable, mediaFile } from '#lib/storage/store.js';
import { clipsAt, clipsOf, duration, fadeAlpha, fadeEdges, itemEnd, sourceTime, trackState } from '#lib/timeline/ops.js';
import { outputSize, videoBitrate, type ExportSettings } from './settings';
import { m } from '#lib/i18n/index.js';

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
/** Audio is mixed in windows of this length (seconds) to keep memory usage low. */
const AUDIO_WINDOW = 5;

export interface ExportProgress {
	/** 0…1 */
	progress: number;
	phase: 'video' | 'finalizing';
}

export class ExportCanceledError extends Error {
	constructor() {
		super(m.export.canceled);
	}
}

/** Checks up front whether the browser can encode these settings. Returns an error message or null. */
export async function checkEncodable(project: Project, settings: ExportSettings): Promise<string | null> {
	const { width, height } = outputSize(settings, project.width, project.height);
	const quality = new Quality({ bitrate: videoBitrate(settings, width, height) });
	const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height, quality });
	if (!codec) return m.export.cannotEncode(width, height);
	if (!(await canEncodeVideo(codec, { width, height, quality, frameRate: settings.fps }))) {
		return m.export.frameRateUnsupported(width, height);
	}
	return null;
}

/**
 * Renders the timeline frame-accurately into an MP4 file (in the OPFS) and returns it.
 * Video and audio run in parallel so the muxer can interleave them.
 */
export async function exportProject(
	project: Project,
	settings: ExportSettings,
	onProgress: (p: ExportProgress) => void,
	signal: AbortSignal
): Promise<File> {
	const total = duration(project.timeline);
	if (total <= 0) throw new Error(m.export.emptyTimeline);
	const { width, height } = outputSize(settings, project.width, project.height);
	const bitrate = videoBitrate(settings, width, height);
	const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {
		width,
		height,
		quality: new Quality({ bitrate })
	});
	if (!videoCodec) throw new Error(m.export.cannotEncode(width, height));

	const source = (sourceId: string) => project.sources.find((s) => s.id === sourceId);
	const audible = (track: number) => {
		const state = trackState(project.timeline, track);
		return !state.muted && !state.hidden;
	};
	// Freeze clips are silent
	const audioClips = clipsOf(project.timeline).filter(
		(c): c is VideoClip =>
			c.type === 'video' && !!source(c.sourceId)?.hasAudio && audible(c.track) && (c.volume ?? 1) > 0
	);
	const withAudio = settings.audioKbps > 0 && audioClips.length > 0;
	const audioCodec = withAudio ? await pickAudioCodec() : null;

	// Canvas text only uses fonts that are already loaded
	await Promise.all(fontsOf(project.timeline.items).map(loadFont));
	// Likewise own images and icons
	setImageProject(project.id, project.images);
	await loadPictures(project.timeline.items);

	const fileName = `${project.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'video'}.mp4`;
	await clearExports();
	const { writable, getFile } = await exportWritable(fileName);

	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d', { alpha: false });
	if (!ctx) throw new Error(m.export.noCanvas);

	const output = new Output({
		format: new Mp4OutputFormat({ fastStart: false }),
		target: new StreamTarget(writable, { chunked: true })
	});
	const videoSource = new CanvasSource(canvas, {
		codec: videoCodec,
		quality: new Quality({ bitrate }),
		keyFrameInterval: 2
	});
	output.addVideoTrack(videoSource, { frameRate: settings.fps });
	const audioSource = audioCodec
		? new AudioBufferSource({
				codec: audioCodec,
				quality: new Quality({ bitrate: settings.audioKbps * 1000 })
			})
		: null;
	if (audioSource) output.addAudioTrack(audioSource);

	// One input file per source, shared by the video and audio loops
	const inputs = new Map<string, Input>();
	const getInput = async (sourceId: string) => {
		let input = inputs.get(sourceId);
		if (!input) {
			const source = project.sources.find((s) => s.id === sourceId);
			if (!source) throw new Error(m.export.missingSource);
			input = openInput(await mediaFile(project.id, source.file));
			inputs.set(sourceId, input);
		}
		return input;
	};

	const totalFrames = Math.max(1, Math.round(total * settings.fps));
	const totalSamples = Math.round(total * SAMPLE_RATE);
	let framesDone = 0;
	let samplesDone = 0;
	const report = () => {
		const v = framesDone / totalFrames;
		const progress = audioSource ? (v + samplesDone / totalSamples) / 2 : v;
		onProgress({ progress: Math.min(progress, 1), phase: 'video' });
	};
	const checkAbort = () => {
		if (signal.aborted) throw new ExportCanceledError();
	};

	const tracks = new Map<string, InputVideoTrack>();
	const videoTrack = async (sourceId: string) => {
		let track = tracks.get(sourceId);
		if (!track) {
			track = (await (await getInput(sourceId)).getPrimaryVideoTrack()) ?? undefined;
			if (!track) throw new Error(m.export.noVideoTrack);
			tracks.set(sourceId, track);
		}
		return track;
	};
	const toFrame = (wrapped: WrappedCanvas | null): Frame | null =>
		wrapped && { image: wrapped.canvas, width: wrapped.canvas.width, height: wrapped.canvas.height };

	async function renderVideo() {
		// One decoder per visible clip: video clips deliver their frames in order, freeze clips once
		interface Stream {
			frames?: AsyncGenerator<WrappedCanvas | null>;
			current: Frame | null;
		}
		const streams = new Map<string, Stream>();
		const timeline = project.timeline;
		for (let k = 0; k < totalFrames; k++) {
			checkAbort();
			const t = k / settings.fps;
			// Only clips with a picture on visible tracks
			const active = clipsAt(timeline, t).filter(
				(c) => source(c.sourceId)?.hasVideo && !trackState(timeline, c.track).hidden
			);
			for (const [id, stream] of streams) {
				if (active.some((c) => c.id === id)) continue;
				await stream.frames?.return(undefined);
				streams.delete(id);
			}
			const frames = new Map<string, Frame>();
			for (const clip of active) {
				const src = source(clip.sourceId);
				let stream = streams.get(clip.id);
				if (!stream) {
					// Resized window recordings: only the area of the largest window
					const crop = src?.crop ? sourceCrop(src) : undefined;
					const sink = new CanvasSink(await videoTrack(clip.sourceId), { poolSize: 2, crop });
					if (clip.type === 'freeze') {
						stream = { current: toFrame(await sink.getCanvas(clip.at)) };
					} else {
						// Global frame indices from now on whose time falls within this clip
						const last = Math.min(Math.ceil(itemEnd(clip) * settings.fps - 1e-6), totalFrames);
						const timestamps = Array.from({ length: Math.max(last - k, 1) }, (_, j) =>
							sourceTime(clip, (k + j) / settings.fps)
						);
						stream = { frames: sink.canvasesAtTimestamps(timestamps), current: null };
					}
					streams.set(clip.id, stream);
				}
				if (stream.frames) {
					const next = await stream.frames.next();
					if (!next.done) stream.current = toFrame(next.value) ?? stream.current;
				}
				const visible = src && visibleAt(src, sourceTime(clip, t));
				if (stream.current) frames.set(clip.id, visible ? { ...stream.current, visible, anchor: clip.anchor } : stream.current);
			}
			renderFrame(ctx!, width, height, { t, timeline, background: project.background, frames });
			await videoSource.add(t, 1 / settings.fps);
			framesDone++;
			if (framesDone % 10 === 0) report();
		}
		for (const stream of streams.values()) await stream.frames?.return(undefined);
		videoSource.close();
	}

	async function renderAudio() {
		if (!audioSource) return;
		const sinks = new Map<string, AudioBufferSink | null>();
		const audioSink = async (sourceId: string) => {
			if (!sinks.has(sourceId)) {
				const track = await (await getInput(sourceId)).getPrimaryAudioTrack();
				sinks.set(sourceId, track && (await track.canDecode()) ? new AudioBufferSink(track) : null);
			}
			return sinks.get(sourceId) ?? null;
		};
		for (let s = 0; s < totalSamples; s += AUDIO_WINDOW * SAMPLE_RATE) {
			checkAbort();
			const length = Math.min(AUDIO_WINDOW * SAMPLE_RATE, totalSamples - s);
			const t0 = s / SAMPLE_RATE;
			const t1 = (s + length) / SAMPLE_RATE;
			// All clips with audio that fall into this window
			const parts: AudioPart[] = [];
			for (const clip of audioClips) {
				const from = Math.max(t0, clip.start);
				const to = Math.min(t1, itemEnd(clip));
				if (to <= from) continue;
				const sink = await audioSink(clip.sourceId);
				if (sink) {
					// Volume over time: linear between the window bounds and the fade edges inside it
					const end = itemEnd(clip);
					const gain = (t: number) => (clip.volume ?? 1) * fadeAlpha(t, clip.start, end, clip.fadeIn, clip.fadeOut);
					const edges = fadeEdges(clip.start, end, clip.fadeIn, clip.fadeOut).filter((t) => t > from && t < to);
					parts.push({
						sink,
						srcStart: sourceTime(clip, from),
						srcEnd: sourceTime(clip, to),
						offset: from - t0,
						gain: [from, ...edges, to].map((t) => ({ time: t - t0, value: gain(t) }))
					});
				}
			}
			await audioSource.add(await mixWindow(parts, length));
			samplesDone += length;
			report();
		}
		audioSource.close();
	}

	try {
		await output.start();
		await Promise.all([renderVideo(), renderAudio()]);
		checkAbort();
		onProgress({ progress: 1, phase: 'finalizing' });
		await output.finalize();
	} catch (e) {
		await output.cancel().catch(() => {});
		throw e;
	} finally {
		inputs.forEach((input) => input.dispose());
	}
	return getFile();
}

interface AudioPart {
	sink: AudioBufferSink;
	/** Source range in seconds */
	srcStart: number;
	srcEnd: number;
	/** Start within the window in seconds */
	offset: number;
	/** Volume 0…1 over time (seconds within the window), linear in between */
	gain: { time: number; value: number }[];
}

/**
 * Returns exactly `length` samples (48 kHz, stereo) with all parts mixed. Web Audio handles
 * resampling and channel mixing; parts without audio stay silent.
 */
async function mixWindow(parts: AudioPart[], length: number): Promise<AudioBuffer> {
	const context = new OfflineAudioContext(CHANNELS, length, SAMPLE_RATE);
	for (const { sink, srcStart, srcEnd, offset, gain } of parts) {
		const volume = context.createGain();
		volume.gain.setValueAtTime(gain[0].value, gain[0].time);
		for (const { time, value } of gain.slice(1)) volume.gain.linearRampToValueAtTime(value, time);
		volume.connect(context.destination);
		// Start a little earlier so the buffer that reaches into the range is definitely included.
		for await (const { buffer, timestamp, duration } of sink.buffers(Math.max(0, srcStart - 0.2), srcEnd)) {
			const skip = Math.max(0, srcStart - timestamp);
			const play = Math.min(duration - skip, srcEnd - Math.max(timestamp, srcStart));
			if (play <= 0) continue;
			const node = context.createBufferSource();
			node.buffer = buffer;
			node.connect(volume);
			node.start(offset + Math.max(0, timestamp - srcStart), skip, play);
		}
	}
	return context.startRendering();
}
