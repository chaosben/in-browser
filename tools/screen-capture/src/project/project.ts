import { saveProject } from '#lib/storage/store.js';
import { addItem, appendClip, duration, emptyTimeline, findItem, itemEnd } from '#lib/timeline/ops.js';
import type { Size } from './canvas.js';
import { cameraRect, createClip, createImage, DEFAULT_BACKGROUND, fitRect } from './defaults.js';
import { FORMAT, newId, VERSION, type ImageAsset, type Project, type Source, type Timeline } from './types.js';
import { formatDateTime, m } from '#lib/i18n/index.js';

export { newId };

/** A recording: screen, optionally webcam and microphone as separate sources */
export interface Recording {
	screen: Source;
	camera?: Source;
	mic?: Source;
}

export const recordingSources = (r: Recording) => [r.screen, r.camera, r.mic].filter((s): s is Source => !!s);

/**
 * Places a recording: screen appended at the end of track 0, webcam (bottom right, rounded) and
 * microphone above it at the same time. All parts are linked.
 */
export function placeRecording(timeline: Timeline, recording: Recording, width: number, height: number): Timeline {
	const { screen, camera, mic } = recording;
	const group = camera || mic ? newId() : undefined;
	const clip = { ...createClip(screen, width, height), group };
	let result = appendClip(timeline, clip);
	const start = findItem(result, clip.id)!.start;
	if (camera) {
		const cam = createClip(camera, width, height, start);
		result = addItem(result, { ...cam, rect: cameraRect(camera, width, height), shape: 'rounded', group });
	}
	if (mic) result = addItem(result, { ...createClip(mic, width, height, start), group });
	return result;
}

/**
 * Inserts a source: videos appended at the end of track 0, audio-only sources at `at` in front of everything
 * already there.
 */
export function placeSource(timeline: Timeline, source: Source, width: number, height: number, at = 0): Timeline {
	if (source.hasVideo) return appendClip(timeline, createClip(source, width, height));
	return addItem(timeline, createClip(source, width, height, at));
}

/** Seconds an image of a new project stays on screen (same as inserting one in the editor) */
export const IMAGE_SECONDS = 3;

/**
 * Images as content of a new project (e.g. a slideshow): one after another from `start`, each `IMAGE_SECONDS`,
 * fitted into the canvas.
 */
export function placeImages(timeline: Timeline, images: ImageAsset[], width: number, height: number, start: number): Timeline {
	return images.reduce((result, image, i) => {
		const t = start + i * IMAGE_SECONDS;
		const item = createImage(image, t, t + IMAGE_SECONDS, width, height);
		return addItem(result, { ...item, rect: fitRect(image, width, height) });
	}, timeline);
}

/** Working resolution: that of the first source with a picture, otherwise of the first image (even, 16–7680 px) */
export function canvasSize(sources: Source[], images: ImageAsset[] = []) {
	const first = sources.find((s) => s.hasVideo);
	if (first) return { width: first.width, height: first.height };
	const even = (px: number) => Math.min(7680, Math.max(16, Math.round(px / 2) * 2));
	if (images[0]) return { width: even(images[0].width), height: even(images[0].height) };
	return { width: 1920, height: 1080 };
}

/**
 * Creates a project with the given sources or a recording (and images after them) and saves it. Without `size`
 * the first source with a picture sets the canvas, otherwise the first image.
 */
export async function createProject(
	id: string,
	name: string,
	content: Source[] | Recording,
	size?: Size,
	images: ImageAsset[] = []
): Promise<Project> {
	const now = Date.now();
	const sources = Array.isArray(content) ? content : recordingSources(content);
	const { width, height } = size ?? canvasSize(sources, images);
	let timeline = emptyTimeline();
	if (Array.isArray(content)) for (const s of content) timeline = placeSource(timeline, s, width, height);
	else timeline = placeRecording(timeline, content, width, height);
	timeline = placeImages(timeline, images, width, height, videoEnd(timeline, sources));
	const project: Project = {
		format: FORMAT,
		version: VERSION,
		id,
		name,
		createdAt: now,
		updatedAt: now,
		width,
		height,
		background: DEFAULT_BACKGROUND,
		sources,
		images,
		timeline,
		library: []
	};
	await saveProject(project);
	return project;
}

/** End of the clips with a picture (images of a new project follow them; audio may run alongside) */
function videoEnd(timeline: Timeline, sources: Source[]): number {
	const pictures = new Set(sources.filter((s) => s.hasVideo).map((s) => s.id));
	return timeline.items.reduce((end, item) => (item.type !== 'annotation' && pictures.has(item.sourceId) ? Math.max(end, itemEnd(item)) : end), 0);
}

export function projectDuration(project: Project): number {
	return duration(project.timeline);
}

export function defaultProjectName(): string {
	return m.common.recordingName(formatDateTime(Date.now(), 'short'));
}

/** Name suggested for an empty project */
export function emptyProjectName(): string {
	return m.common.projectName(formatDateTime(Date.now(), 'short'));
}
