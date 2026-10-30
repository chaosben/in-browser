import { AudioBufferSink, CanvasSink } from 'mediabunny';
import type { Item, Source } from '#lib/project/types.js';
import { sourceCrop, visibleRect } from './content.js';
import { mediaFile, writeMediaText } from '#lib/storage/store.js';
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

/** Opens a media file where it is (a project's folder or the global library) */
export type OpenMedia = (file: string) => Promise<File>;

/** Where media lives: cache key (project id or `library`), how to open its files, optionally how to cache text */
export interface MediaPlace {
	key: string;
	open: OpenMedia;
	save?: (file: string, text: string) => Promise<void>;
}

export const projectMedia = (projectId: string): MediaPlace => ({
	key: projectId,
	open: (file) => mediaFile(projectId, file),
	save: (file, text) => writeMediaText(projectId, file, text)
});

export function thumbnails(projectId: string, source: Source): Promise<Thumbnails | null> {
	return thumbnailsIn(projectMedia(projectId), source);
}

export function thumbnailsIn(place: MediaPlace, source: Source): Promise<Thumbnails | null> {
	const key = `${place.key}/${source.id}`;
	let promise = thumbCache.get(key);
	if (!promise) {
		promise = computeThumbnails(place, source).catch(() => null);
		thumbCache.set(key, promise);
	}
	return promise;
}

export function peaks(projectId: string, source: Source): Promise<Peaks | null> {
	return peaksIn(projectMedia(projectId), source);
}

export function peaksIn(place: MediaPlace, source: Source): Promise<Peaks | null> {
	if (!source.hasAudio) return Promise.resolve(null);
	const key = `${place.key}/${source.id}`;
	let promise = peakCache.get(key);
	if (!promise) {
		promise = loadPeaks(place, source).catch(() => null);
		peakCache.set(key, promise);
	}
	return promise;
}

/** Index of the thumbnail showing source time `t` */
export function frameIndex(interval: number, count: number, t: number): number {
	return Math.min(Math.max(Math.round(t / interval), 0), count - 1);
}

async function computeThumbnails(place: MediaPlace, source: Source): Promise<Thumbnails | null> {
	using input = openInput(await place.open(source.file));
	const track = await input.getPrimaryVideoTrack();
	if (!track) return null;
	const interval = Math.max(1, source.duration / MAX_THUMBS);
	// Resized window recordings: only the area of the largest window
	const sink = new CanvasSink(track, { height: THUMB_HEIGHT, crop: source.crop ? sourceCrop(source) : undefined });
	const timestamps = Array.from({ length: Math.ceil(source.duration / interval) }, (_, i) => i * interval);
	const images: ImageBitmap[] = [];
	let i = 0;
	for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
		const t = timestamps[i++];
		if (wrapped) images.push(await createImageBitmap(onlyWindow(wrapped.canvas, source, t)));
		else if (images.length) images.push(images[images.length - 1]);
	}
	if (images.length === 0) return null;
	return { interval, images, aspect: images[0].width / images[0].height };
}

/** Resized window recordings: keeps only the window at time `t`, the rest transparent (same image size) */
function onlyWindow(image: HTMLCanvasElement | OffscreenCanvas, source: Source, t: number) {
	const r = visibleRect(source, t, image.width, image.height);
	if (!r) return image;
	const canvas = new OffscreenCanvas(image.width, image.height);
	canvas.getContext('2d')?.drawImage(image, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
	return canvas;
}

async function loadPeaks(place: MediaPlace, source: Source): Promise<Peaks | null> {
	const file = `${source.id}.peaks.json`;
	const cached = await place
		.open(file)
		.then((f) => f.text())
		.catch(() => null);
	if (cached) {
		const { rate, data } = JSON.parse(cached) as { rate: number; data: number[] };
		return { rate, data: Float32Array.from(data) };
	}

	using input = openInput(await place.open(source.file));
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
	await place
		.save?.(file, JSON.stringify({ rate: PEAKS_PER_SECOND, data: Array.from(data, (v) => Math.round(v * 1000) / 1000) }))
		.catch(() => {});
	return { rate: PEAKS_PER_SECOND, data };
}

/** Pictures for previews of items (library, dragging): what each clip shows */
export interface ItemMedia {
	/** Thumbnail at the start of a clip with a picture, by item id */
	frames: Map<string, ImageBitmap>;
}

/** Loads thumbnails for the clips with a picture among `items` (`sources`: their sources) */
export async function itemMedia(items: readonly Item[], sources: readonly Source[], place: MediaPlace): Promise<ItemMedia> {
	const result: ItemMedia = { frames: new Map() };
	await Promise.all(
		items.map(async (item) => {
			if (item.type === 'annotation') return;
			const source = sources.find((s) => s.id === item.sourceId);
			if (!source?.hasVideo) return;
			const thumbs = await thumbnailsIn(place, source);
			const t = item.type === 'freeze' ? item.at : item.in;
			if (thumbs) result.frames.set(item.id, thumbs.images[frameIndex(thumbs.interval, thumbs.images.length, t)]);
		})
	);
	return result;
}
