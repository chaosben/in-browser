// Clipboard for timeline items, shared by all tabs (localStorage) and so across projects. It holds the items and
// the metadata of the sources/images they use; the media files stay in the source project's package (`projectId`
// is its path in the shared file system) and are copied into the target project when pasting there.
import { imageOf, sourceOf } from './library.js';
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
