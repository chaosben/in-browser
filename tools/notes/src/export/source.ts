// What the exports need from a notebook (the open `NotebookDoc`, or test data). Page contents must be loaded.

import type { PageMeta } from '#lib/model/types.js';
import type { PdfBackgrounds } from '#lib/render/backgrounds.js';
import type { PictureCache } from '#lib/render/pictures.js';
import type { PageScene } from '#lib/render/scene.js';

export interface ExportSource {
	pages: PageMeta[];
	scene(id: string): PageScene | null;
	pictures: PictureCache;
	backgrounds: PdfBackgrounds;
	readAsset(name: string): Promise<Blob>;
}

/** Export progress 0…1 */
export type Progress = (done: number) => void;
