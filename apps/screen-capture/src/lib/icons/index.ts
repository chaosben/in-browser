// The whole Material Symbols Light set (~16,000 icons, ~10 MB JSON) is a separate asset that is only fetched on
// demand. The Service Worker deliberately does not precache it (see `service-worker/index.ts`), so it needs the
// network – inserted icons keep their SVG and work offline anyway.

import setUrl from '@iconify-json/material-symbols-light/icons.json?url';
import type { IconData } from '#lib/project/types.js';

interface IconSet {
	width?: number;
	height?: number;
	icons: Record<string, { body: string; width?: number; height?: number; hidden?: boolean }>;
}

let all: Promise<IconData[]> | null = null;

/** Whole icon set, loaded once */
export function loadAllIcons(): Promise<IconData[]> {
	all ??= fetchIcons().catch((e) => {
		// Allow another attempt (e.g. once back online)
		all = null;
		throw e;
	});
	return all;
}

async function fetchIcons(): Promise<IconData[]> {
	const response = await fetch(setUrl);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return iconList(await response.json());
}

/** Visible icons of an Iconify set */
export function iconList(set: IconSet): IconData[] {
	const { width = 24, height = 24 } = set;
	return Object.entries(set.icons)
		.filter(([, icon]) => !icon.hidden)
		.map(([name, icon]) => ({ name, body: icon.body, width: icon.width ?? width, height: icon.height ?? height }));
}

/** Icons whose name contains all words of `query` (names are English, e.g. `arrow-forward`) */
export function searchIcons(icons: IconData[], query: string, limit = 200): IconData[] {
	const words = query.toLowerCase().split(/[\s-]+/).filter(Boolean);
	if (!words.length) return icons.slice(0, limit);
	const result: IconData[] = [];
	for (const icon of icons) {
		if (words.every((w) => icon.name.includes(w))) result.push(icon);
		if (result.length >= limit) break;
	}
	return result;
}
