// Directory of all in-browser tools for the launcher on the overview. A new tool needs an entry here and texts
// under `tools.<id>` in en.ts/de.ts; its icon is the tool's favicon (static/<tool>/favicon.svg), its start page
// also gets a shortcut in static/manifest.webmanifest.

import type { Messages } from './i18n/index.svelte.js';

export type Category = keyof Messages['categories'];
export type Requirement = keyof Messages['requires'];

export interface Tool {
	id: keyof Messages['tools'];
	url: string;
	icon: string;
	/** Section on the launcher (each tool appears once) */
	category: Category;
	/** Further categories: only for the search */
	also?: Category[];
	/** Browser feature it can't run without; without it the tool runs everywhere */
	requires?: Requirement;
}

/** Order of the sections */
export const CATEGORIES: readonly Category[] = ['media', 'writing', 'drawing', 'organize'];

/** Feature detection per requirement (browser only, never browser sniffing) */
export const REQUIREMENTS: Record<Requirement, () => boolean> = {
	displayCapture: () => !!navigator.mediaDevices?.getDisplayMedia
};

export const TOOLS: readonly Tool[] = [
	{
		id: 'screenCapture',
		url: '/screen-capture',
		icon: '/screen-capture/favicon.svg',
		category: 'media',
		requires: 'displayCapture'
	},
	{
		id: 'files',
		url: '/files',
		icon: '/files/favicon.svg',
		category: 'organize'
	},
	{
		id: 'textEditor',
		url: '/text-editor',
		icon: '/text-editor/favicon.svg',
		category: 'writing'
	},
	{
		id: 'notes',
		url: '/notes',
		icon: '/notes/favicon.svg',
		category: 'writing',
		also: ['drawing']
	},
	{
		id: 'pdfEditor',
		url: '/pdf-editor',
		icon: '/pdf-editor/favicon.svg',
		category: 'writing',
		also: ['organize', 'drawing']
	}
];
