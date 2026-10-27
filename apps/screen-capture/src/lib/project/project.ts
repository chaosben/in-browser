import { saveProject } from '#lib/storage/opfs.js';
import { addItem, appendClip, duration, emptyTimeline, findItem } from '#lib/timeline/ops.js';
import { cameraRect, createClip, DEFAULT_BACKGROUND } from './defaults.js';
import { newId, type Project, type Source, type Timeline } from './types.js';
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

/** Working resolution: that of the first source with a picture */
export function canvasSize(sources: Source[]) {
	const first = sources.find((s) => s.hasVideo);
	return { width: first?.width ?? 1920, height: first?.height ?? 1080 };
}

/** Creates a project with the given sources or a recording and saves it. */
export async function createProject(id: string, name: string, content: Source[] | Recording): Promise<Project> {
	const now = Date.now();
	const sources = Array.isArray(content) ? content : recordingSources(content);
	const { width, height } = canvasSize(sources);
	let timeline = emptyTimeline();
	if (Array.isArray(content)) for (const s of content) timeline = placeSource(timeline, s, width, height);
	else timeline = placeRecording(timeline, content, width, height);
	const project: Project = {
		version: 1,
		id,
		name,
		createdAt: now,
		updatedAt: now,
		width,
		height,
		background: DEFAULT_BACKGROUND,
		sources,
		timeline
	};
	await saveProject(project);
	return project;
}

export function projectDuration(project: Project): number {
	return duration(project.timeline);
}

export function defaultProjectName(): string {
	return m.common.recordingName(formatDateTime(Date.now(), 'short'));
}
