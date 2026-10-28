// Clipboard for timeline items, shared by all tabs (localStorage) and so across projects. It holds the items and
// the metadata of the sources/images they use; the media files stay in the source project's folder (all projects
// share the same OPFS) and are copied into the target project when pasting there.
import { mediaFile, mediaWritable } from '#lib/storage/opfs.js';
import type { ImageAsset, Item, Project, Source } from './types.js';

const STORAGE_KEY = 'screen-capture:clipboard';

export interface ClipboardData {
	projectId: string;
	items: Item[];
	sources: Source[];
	images: ImageAsset[];
}

function load(): ClipboardData | null {
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		const valid = raw && typeof raw.projectId === 'string' && [raw.items, raw.sources, raw.images].every(Array.isArray);
		return valid ? raw : null;
	} catch {
		// localStorage not available or invalid JSON
		return null;
	}
}

const sourceOf = (item: Item) => (item.type === 'annotation' ? undefined : item.sourceId);
const imageOf = (item: Item) => (item.type === 'annotation' && item.kind === 'image' ? item.imageId : undefined);

class Clipboard {
	#data = $state.raw(load());

	constructor() {
		// Copied in another tab
		if (typeof window !== 'undefined') {
			window.addEventListener('storage', (e) => {
				if (e.key === STORAGE_KEY) this.#data = load();
			});
		}
	}

	get data() {
		return this.#data;
	}

	get empty() {
		return !this.#data?.items.length;
	}

	copy(project: Project, items: readonly Item[]) {
		if (!items.length) return;
		const sourceIds = new Set(items.map(sourceOf));
		const imageIds = new Set(items.map(imageOf));
		const data: ClipboardData = $state.snapshot({
			projectId: project.id,
			items: [...items],
			sources: project.sources.filter((s) => sourceIds.has(s.id)),
			images: project.images.filter((i) => imageIds.has(i.id))
		});
		this.#data = data;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch {
			// ignore: pasting still works in this tab
		}
	}
}

export const clipboard = new Clipboard();

async function copyFile(from: string, to: string, file: string) {
	const source = await mediaFile(from, file);
	await source.stream().pipeTo(await mediaWritable(to, file));
}

/**
 * Prepares pasting `data` into `project`: copies the media files it lacks from the source project. Items whose
 * media cannot be found are left out (`skipped`); `sources`/`images` are the ones to add to the media bin.
 */
export async function prepareMedia(data: ClipboardData, project: Project, onCopying?: () => void) {
	const has = new Set([...project.sources.map((s) => s.id), ...project.images.map((i) => i.id)]);
	const missing = [
		...data.sources.map((media) => ({ media, source: true })),
		...data.images.map((media) => ({ media, source: false }))
	].filter(({ media }) => !has.has(media.id));
	if (missing.length && data.projectId !== project.id) onCopying?.();
	const available = new Set(has);
	const sources: Source[] = [];
	const images: ImageAsset[] = [];
	for (const { media, source } of missing) {
		try {
			// Same project: the file is still there (e.g. the source was only removed from the bin, then restored)
			if (data.projectId !== project.id) await copyFile(data.projectId, project.id, media.file);
			else await mediaFile(project.id, media.file);
		} catch (e) {
			console.error(e);
			continue;
		}
		if (source) {
			// Waveform cache: nice to have
			if (data.projectId !== project.id) await copyFile(data.projectId, project.id, `${media.id}.peaks.json`).catch(() => {});
			sources.push(media as Source);
		} else images.push(media);
		available.add(media.id);
	}
	const usable = (item: Item) => [sourceOf(item), imageOf(item)].every((id) => id === undefined || available.has(id));
	const items = data.items.filter(usable);
	return { items, sources, images, skipped: data.items.length - items.length };
}
