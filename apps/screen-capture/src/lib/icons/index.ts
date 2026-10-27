// Whole icon sets (Material Symbols ~16,000, Tabler ~6,000, Phosphor ~9,000 icons, 2–8 MB JSON each) are separate
// assets that are only fetched on demand. The Service Worker deliberately does not precache them (see
// `service-worker/index.ts`), so they need the network – inserted icons keep their SVG and work offline anyway.

import materialUrl from '@iconify-json/material-symbols/icons.json?url';
import phosphorUrl from '@iconify-json/ph/icons.json?url';
import tablerUrl from '@iconify-json/tabler/icons.json?url';
import type { IconData } from '#lib/project/types.js';

interface IconSet {
	width?: number;
	height?: number;
	icons: Record<string, { body: string; width?: number; height?: number; hidden?: boolean }>;
}

/** Offered sets; all free to use without attribution. `size`: approximate download (compressed) */
export const ICON_SETS = [
	{ id: 'material', name: 'Material Symbols', license: 'Apache 2.0', count: 16000, size: '1.2 MB', url: materialUrl },
	{ id: 'tabler', name: 'Tabler Icons', license: 'MIT', count: 6000, size: '0.3 MB', url: tablerUrl },
	{ id: 'ph', name: 'Phosphor', license: 'MIT', count: 9000, size: '0.9 MB', url: phosphorUrl }
] as const;

export type IconSetId = (typeof ICON_SETS)[number]['id'];

const loaded = new Map<IconSetId, Promise<IconData[]>>();

/** Whole icon set, loaded once */
export function loadAllIcons(id: IconSetId): Promise<IconData[]> {
	let icons = loaded.get(id);
	if (!icons) {
		icons = fetchIcons(ICON_SETS.find((s) => s.id === id)!.url).catch((e) => {
			// Allow another attempt (e.g. once back online)
			loaded.delete(id);
			throw e;
		});
		loaded.set(id, icons);
	}
	return icons;
}

async function fetchIcons(url: string): Promise<IconData[]> {
	const response = await fetch(url);
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
