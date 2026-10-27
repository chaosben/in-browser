import { AudioBufferSink, CanvasSink } from 'mediabunny';
import type { Source } from '#lib/project/types.js';
import { mediaFile, readMediaText, writeMediaText } from '#lib/storage/opfs.js';
import { openInput } from './media.js';

// Thumbnails and audio waveform for the timeline. Computed in the background and cached
// (thumbnails in memory, the waveform additionally as `<sourceId>.peaks.json` in the media folder).

export const THUMB_HEIGHT = 48;
const MAX_THUMBS = 240;
const PEAKS_PER_SECOND = 50;

export interface Thumbnails {
	/** Interval between thumbnails in seconds */
	interval: number;
	images: ImageBitmap[];
	aspect: number;
}

export interface Peaks {
	rate: number;
	data: Float32Array;
}

const thumbCache = new Map<string, Promise<Thumbnails | null>>();
const peakCache = new Map<string, Promise<Peaks | null>>();

export function thumbnails(projectId: string, source: Source): Promise<Thumbnails | null> {
	const key = `${projectId}/${source.id}`;
	let promise = thumbCache.get(key);
	if (!promise) {
		promise = computeThumbnails(projectId, source).catch(() => null);
		thumbCache.set(key, promise);
	}
	return promise;
}

export function peaks(projectId: string, source: Source): Promise<Peaks | null> {
	if (!source.hasAudio) return Promise.resolve(null);
	const key = `${projectId}/${source.id}`;
	let promise = peakCache.get(key);
	if (!promise) {
		promise = loadPeaks(projectId, source).catch(() => null);
		peakCache.set(key, promise);
	}
	return promise;
}

async function computeThumbnails(projectId: string, source: Source): Promise<Thumbnails | null> {
	using input = openInput(await mediaFile(projectId, source.file));
	const track = await input.getPrimaryVideoTrack();
	if (!track) return null;
	const interval = Math.max(1, source.duration / MAX_THUMBS);
	const sink = new CanvasSink(track, { height: THUMB_HEIGHT });
	const timestamps = Array.from({ length: Math.ceil(source.duration / interval) }, (_, i) => i * interval);
	const images: ImageBitmap[] = [];
	for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
		if (wrapped) images.push(await createImageBitmap(wrapped.canvas));
		else if (images.length) images.push(images[images.length - 1]);
	}
	if (images.length === 0) return null;
	return { interval, images, aspect: images[0].width / images[0].height };
}

async function loadPeaks(projectId: string, source: Source): Promise<Peaks | null> {
	const file = `${source.id}.peaks.json`;
	const cached = await readMediaText(projectId, file);
	if (cached) {
		const { rate, data } = JSON.parse(cached) as { rate: number; data: number[] };
		return { rate, data: Float32Array.from(data) };
	}

	using input = openInput(await mediaFile(projectId, source.file));
	const track = await input.getPrimaryAudioTrack();
	if (!track || !(await track.canDecode())) return null;
	const data = new Float32Array(Math.ceil(source.duration * PEAKS_PER_SECOND) + 1);
	for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
		const samplesPerPeak = buffer.sampleRate / PEAKS_PER_SECOND;
		const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
		for (let i = 0; i < buffer.length; i++) {
			const bucket = Math.floor(timestamp * PEAKS_PER_SECOND + i / samplesPerPeak);
			if (bucket < 0 || bucket >= data.length) continue;
			for (const channel of channels) {
				const v = Math.abs(channel[i]);
				if (v > data[bucket]) data[bucket] = v;
			}
		}
	}
	await writeMediaText(
		projectId,
		file,
		JSON.stringify({ rate: PEAKS_PER_SECOND, data: Array.from(data, (v) => Math.round(v * 1000) / 1000) })
	).catch(() => {});
	return { rate: PEAKS_PER_SECOND, data };
}
