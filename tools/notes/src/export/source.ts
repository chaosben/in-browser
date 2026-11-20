// What the exports need from a notebook (the open `NotebookDoc`, or test data). Page contents must be loaded.

import type { Item, PageMeta } from '#lib/model/types.js';
import type { PdfPages } from '@in-browser/pdf/pages.js';
import type { PictureCache } from '@in-browser/ink/render/pictures.js';
import type { PageScene } from '@in-browser/ink/render/scene.js';

export interface ExportSource {
	pages: PageMeta[];
	scene(id: string): PageScene<Item> | null;
	pictures: PictureCache;
	backgrounds: PdfPages;
	readAsset(name: string): Promise<Blob>;
}

/** Export progress 0…1 */
export type Progress = (done: number) => void;
