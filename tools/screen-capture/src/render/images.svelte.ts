// Pictures of `image` and `icon` annotations for the canvas. They load asynchronously: until then the annotation
// is not drawn, and listeners (the preview) redraw once something has arrived. SVGs stay vector images, so they
// are sharp at any size.

import type { Annotation, IconData, ImageAsset, Item } from '#lib/project/types.js';
import { libraryMediaFile, mediaFile } from '#lib/storage/store.js';
import { parseColor } from '#lib/util/color.js';
import { toast } from '@in-browser/brand/ui/toast.svelte.js';
import { m } from '#lib/i18n/index.js';

/** Counts loaded pictures (for things measured outside the canvas loop) */
export const imageState = $state({ version: 0 });

const ready = new Map<string, CanvasImageSource>();
const loading = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

/** Images of the open project: file per image ID */
let project: { id: string; images: ImageAsset[] } | null = null;

/** Tells the cache which project's images to load (editor and export) */
export function setImageProject(id: string, images: ImageAsset[]) {
	if (project?.id === id && project.images === images) return;
	project = { id, images };
	// Drawing may have asked for an image that was not known yet (just imported): try again
	listeners.forEach((fn) => fn());
}

/** Images of the global library (their files are in its own folder), for previews of its entries */
let libraryImages: ImageAsset[] = [];

export function setLibraryImages(images: ImageAsset[]) {
	libraryImages = images;
}

/** Calls `fn` whenever a picture has loaded; returns the unsubscribe function */
export function onPictureLoaded(fn: () => void) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** Loads an image element from a blob; `null` if the browser cannot decode it */
async function loadElement(blob: Blob): Promise<HTMLImageElement | null> {
	const url = URL.createObjectURL(blob);
	const img = new Image();
	img.src = url;
	try {
		await img.decode();
		return img;
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function load(key: string, name: string, get: () => Promise<CanvasImageSource | null>): Promise<void> {
	let promise = loading.get(key);
	if (!promise) {
		const failed = (e: unknown) => {
			console.error('[images]', name, e);
			toast(m.errors.pictureFailed(name), 'error');
		};
		promise = get()
			.then((source) => {
				if (!source) return failed('decoding failed');
				ready.set(key, source);
				imageState.version++;
				listeners.forEach((fn) => fn());
			})
			.catch(failed);
		loading.set(key, promise);
	}
	return promise;
}

/** The project's image, else one of the global library (same id = same file) */
function imageAsset(imageId: string) {
	const own = project?.images.find((i) => i.id === imageId);
	if (own && project) return { asset: own, key: `image:${project.id}/${imageId}`, open: () => mediaFile(project!.id, own.file) };
	const shared = libraryImages.find((i) => i.id === imageId);
	if (shared) return { asset: shared, key: `image:library/${imageId}`, open: () => libraryMediaFile(shared.file) };
	return null;
}
const iconKey = (icon: IconData, hex: string) => `icon:${hex}:${icon.body}`;

function loadImage(imageId: string): Promise<void> {
	const found = imageAsset(imageId);
	if (!found) return Promise.resolve();
	const { asset, key, open } = found;
	return load(key, asset.name, async () => {
		const file = await open();
		// Raster images as bitmaps (fast to draw), SVGs as elements (vector)
		return /\.svg$/i.test(asset.file) ? loadElement(file) : createImageBitmap(file);
	});
}

/** SVG of an icon in a solid color (opacity is applied when drawing) */
export function iconSvg(icon: IconData, hex: string): string {
	const body = icon.body.replaceAll('currentColor', hex);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${icon.width * 10}" height="${icon.height * 10}" viewBox="0 0 ${icon.width} ${icon.height}">${body}</svg>`;
}

function loadIcon(icon: IconData, hex: string): Promise<void> {
	return load(iconKey(icon, hex), icon.name, () => loadElement(new Blob([iconSvg(icon, hex)], { type: 'image/svg+xml' })));
}

/** Picture of an own image; starts loading it if needed */
export function imagePicture(imageId: string): CanvasImageSource | undefined {
	const key = imageAsset(imageId)?.key;
	const picture = key ? ready.get(key) : undefined;
	if (!picture) void loadImage(imageId);
	return picture;
}

/** Picture of an icon in `color` (without its opacity); starts loading it if needed */
export function iconPicture(icon: IconData, color: string): CanvasImageSource | undefined {
	const hex = parseColor(color).hex;
	const picture = ready.get(iconKey(icon, hex));
	if (!picture) void loadIcon(icon, hex);
	return picture;
}

/** Loads all pictures the items need (before an export) */
export function loadPictures(items: Item[]): Promise<void[]> {
	const annotations = items.filter((i): i is Annotation => i.type === 'annotation');
	return Promise.all(
		annotations.flatMap((a) => {
			if (a.kind === 'image') return [loadImage(a.imageId)];
			if (a.kind === 'icon') return [loadIcon(a.icon, parseColor(a.color).hex)];
			return [];
		})
	);
}
