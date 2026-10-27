import {
	ALL_FORMATS,
	BlobSource,
	canEncodeAudio,
	Conversion,
	Input,
	Mp4OutputFormat,
	Output,
	StreamTarget,
	type AudioCodec
} from 'mediabunny';
import { newId, type Source } from '#lib/project/types.js';
import { deleteMediaFile, mediaFile, mediaWritable } from '#lib/storage/opfs.js';
import { m } from '#lib/i18n/index.js';

export function openInput(blob: Blob) {
	return new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
}

/**
 * First available audio encoding in the given order (Chrome on Linux sometimes lacks AAC). AAC plays everywhere,
 * Opus sounds better at the same bitrate (no low-pass around 16 kHz).
 */
export async function pickAudioCodec(preferred: readonly AudioCodec[] = ['aac', 'opus']): Promise<AudioCodec | null> {
	for (const codec of preferred) {
		if (await canEncodeAudio(codec)) return codec;
	}
	return null;
}

/** File types that can be imported (video and audio-only) */
export const MEDIA_ACCEPT =
	'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac';
const MEDIA_TYPES = /^(video|audio)\/|\.(mp4|webm|mov|mkv|mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i;

export const isMediaFile = (f: File) => MEDIA_TYPES.test(f.type) || MEDIA_TYPES.test(f.name);

/** Reads duration, dimensions and audio track of a media file. Audio-only files have no picture (0×0). */
export async function probe(blob: Blob) {
	using input = openInput(blob);
	const video = await input.getPrimaryVideoTrack();
	if (video && !(await video.canDecode())) {
		throw new Error(m.errors.codecUnsupported(String(await video.getCodec())));
	}
	const audio = await input.getPrimaryAudioTrack();
	const hasAudio = !!audio && (await audio.canDecode());
	if (!video && !hasAudio) throw new Error(m.errors.noMediaTrack);
	return {
		duration: await input.computeDuration(),
		hasVideo: !!video,
		width: video ? await video.getDisplayWidth() : 0,
		height: video ? await video.getDisplayHeight() : 0,
		hasAudio
	};
}

/** Creates the `Source` entry for a media file already stored in the OPFS. */
export async function describeSource(
	projectId: string,
	file: string,
	name: string,
	kind: Source['kind']
): Promise<Source> {
	const info = await probe(await mediaFile(projectId, file));
	return { id: file.replace(/\.\w+$/, ''), file, name, kind, ...info };
}

/**
 * Adds a video or audio file to the project. It is remuxed into MP4 (usually without re-encoding)
 * so timestamps start at 0 and both preview and export can seek reliably.
 */
export async function importFile(
	projectId: string,
	file: File,
	onProgress?: (p: number) => void
): Promise<Source> {
	const id = newId();
	const fileName = `${id}.mp4`;
	using input = openInput(file);
	if (!(await input.canRead())) throw new Error(m.errors.unsupportedFormat(file.name));

	const writable = await mediaWritable(projectId, fileName);
	const output = new Output({
		format: new Mp4OutputFormat({ fastStart: false }),
		target: new StreamTarget(writable, { chunked: true })
	});
	try {
		const conversion = await Conversion.init({ input, output, tracks: 'primary' });
		if (!conversion.isValid) {
			const reasons = conversion.discardedTracks.map((t) => t.reason).join(', ');
			throw new Error(m.errors.cannotImport(reasons));
		}
		if (onProgress) conversion.onProgress = onProgress;
		await conversion.execute();
	} catch (e) {
		await output.cancel().catch(() => {});
		await deleteMediaFile(projectId, fileName);
		throw e;
	}
	return describeSource(projectId, fileName, file.name, 'import');
}
