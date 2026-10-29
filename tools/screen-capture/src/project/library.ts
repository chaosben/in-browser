// Pure helpers for library entries (saved selections to insert again)
import { itemEnd } from '#lib/timeline/ops.js';
import type { ImageAsset, Item, LibraryEntry, Source } from './types.js';

export const sourceOf = (item: Item) => (item.type === 'annotation' ? undefined : item.sourceId);
export const imageOf = (item: Item) => (item.type === 'annotation' && item.kind === 'image' ? item.imageId : undefined);

/** Does an entry use the source or image `id`? */
export function entriesUse(entries: readonly LibraryEntry[], id: string): boolean {
	return entries.some((entry) => entry.items.some((item) => sourceOf(item) === id || imageOf(item) === id));
}

/** The sources and images of `sources`/`images` that `items` use */
export function mediaOf(items: readonly Item[], sources: readonly Source[], images: readonly ImageAsset[]) {
	const ids = new Set(items.flatMap((item) => [sourceOf(item), imageOf(item)]));
	return { sources: sources.filter((s) => ids.has(s.id)), images: images.filter((i) => ids.has(i.id)) };
}

/** Media files of the global library that no entry uses any more (after removing one) */
export function unusedFiles(entries: readonly LibraryEntry[], removed: LibraryEntry): string[] {
	return [...removed.sources, ...removed.images]
		.filter((media) => !entriesUse(entries, media.id))
		.flatMap((media) => ('hasVideo' in media ? [media.file, `${media.id}.peaks.json`] : [media.file]));
}

/** Default name of a new entry: the clicked element's caption, "… +n" for more */
export function entryName(first: string, count: number): string {
	return count > 1 ? `${first} +${count - 1}` : first;
}

/** Duration of an entry in seconds */
export function entryDuration(items: readonly Item[]): number {
	if (!items.length) return 0;
	return Math.max(...items.map(itemEnd)) - Math.min(...items.map((item) => item.start));
}
