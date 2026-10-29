// Copying media files between projects and the global library (all in the shared file system)
import { mediaFile, mediaWritable } from '#lib/storage/store.js';
import { imageOf, sourceOf } from './library.js';
import type { ImageAsset, Item, Project, Source } from './types.js';

/** Items plus the media they use, as kept by the clipboard and library entries */
export interface ItemsWithMedia {
	items: Item[];
	sources: Source[];
	images: ImageAsset[];
}

type Read = (file: string) => Promise<File>;
type Write = (file: string) => Promise<WritableStream<FileSystemWriteChunkType>>;

async function copy(read: Read, write: Write, file: string) {
	await (await read(file)).stream().pipeTo(await write(file));
}

/** Copies the files of sources (with their waveform cache) and images; returns the ids that could be copied */
export async function copyMedia(media: (Source | ImageAsset)[], read: Read, write: Write): Promise<Set<string>> {
	const copied = new Set<string>();
	for (const item of media) {
		try {
			await copy(read, write, item.file);
		} catch (e) {
			console.error(e);
			continue;
		}
		// Waveform cache: nice to have
		if ('hasVideo' in item) await copy(read, write, `${item.id}.peaks.json`).catch(() => {});
		copied.add(item.id);
	}
	return copied;
}

/**
 * Prepares inserting `data` into `project`: copies the media files it lacks (`read` opens them where they are;
 * `null`: they are already in the project's folder). Items whose media cannot be found are left out (`skipped`);
 * `sources`/`images` are the ones to add to the media bin.
 */
export async function prepareMedia(data: ItemsWithMedia, project: Project, read: Read | null, onCopying?: () => void) {
	const has = new Set([...project.sources.map((s) => s.id), ...project.images.map((i) => i.id)]);
	const missing = [...data.sources, ...data.images].filter((media) => !has.has(media.id));
	let available = new Set(has);
	if (missing.length) {
		if (read) {
			onCopying?.();
			const copied = await copyMedia(missing, read, (file) => mediaWritable(project.id, file));
			available = new Set([...has, ...copied]);
		} else {
			// Same project: files of media removed from the bin may still be there
			for (const media of missing) {
				if (await mediaFile(project.id, media.file).then(() => true, () => false)) available.add(media.id);
			}
		}
	}
	const usable = (item: Item) => [sourceOf(item), imageOf(item)].every((id) => id === undefined || available.has(id));
	const items = data.items.filter(usable);
	return {
		items,
		sources: data.sources.filter((s) => !has.has(s.id) && available.has(s.id)),
		images: data.images.filter((i) => !has.has(i.id) && available.has(i.id)),
		skipped: data.items.length - items.length
	};
}
