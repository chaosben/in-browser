// Every set has a curated selection in the bundle (offline). Whole sets (Material Symbols ~16,000, Tabler ~6,000,
// Phosphor ~9,000 icons, 2–8 MB JSON each) are separate assets fetched on demand and then kept in the browser
// (Cache Storage), so they are available offline from then on. The Service Worker deliberately does not precache
// them (see `src/service-worker/index.ts` of the app) and keeps their cache across versions. Inserted icons keep their SVG anyway.

import materialUrl from '@iconify-json/material-symbols/icons.json?url';
import materialMetaUrl from '@iconify-json/material-symbols/metadata.json?url';
import phosphorUrl from '@iconify-json/ph/icons.json?url';
import tablerUrl from '@iconify-json/tabler/icons.json?url';
import type { IconData } from '#lib/project/types.js';
import { CURATED as MATERIAL } from './curated/material.js';
import type { IconCategoryGroup } from './curated/types.js';

interface IconSet {
	width?: number;
	height?: number;
	icons: Record<string, { body: string; width?: number; height?: number; hidden?: boolean }>;
}

/**
 * Offered sets; all free to use without attribution. `size`: approximate download (compressed). `variants`: name
 * suffix → name of the style (as Iconify shows them). `meta`: Iconify metadata with categories (Material only).
 */
export const ICON_SETS = [
	{
		id: 'material',
		name: 'Material Symbols',
		license: 'Apache 2.0',
		count: 16000,
		size: '1.3 MB',
		url: materialUrl,
		meta: materialMetaUrl,
		variants: {
			'': 'Regular',
			rounded: 'Rounded',
			sharp: 'Sharp',
			outline: 'Outline',
			'outline-rounded': 'Outline Rounded',
			'outline-sharp': 'Outline Sharp'
		}
	},
	{
		id: 'tabler',
		name: 'Tabler Icons',
		license: 'MIT',
		count: 6000,
		size: '0.3 MB',
		url: tablerUrl,
		meta: undefined,
		variants: { '': 'Outline', filled: 'Filled' }
	},
	{
		id: 'ph',
		name: 'Phosphor',
		license: 'MIT',
		count: 9000,
		size: '0.9 MB',
		url: phosphorUrl,
		meta: undefined,
		variants: { thin: 'Thin', light: 'Light', '': 'Regular', bold: 'Bold', fill: 'Fill', duotone: 'Duotone' }
	}
] as const;

export type IconSetId = (typeof ICON_SETS)[number]['id'];
export const DEFAULT_ICON_SET: IconSetId = 'material';

const setOf = (id: IconSetId) => ICON_SETS.find((s) => s.id === id)!;

/** Curated selection of a set; only the default one is in the main bundle */
export function loadCurated(id: IconSetId): Promise<IconCategoryGroup[]> {
	if (id === 'tabler') return import('./curated/tabler.js').then((m) => m.CURATED);
	if (id === 'ph') return import('./curated/ph.js').then((m) => m.CURATED);
	return Promise.resolve(MATERIAL);
}

/** An icon of a whole set with its style and (if the set has them) category */
export interface SetIcon {
	icon: IconData;
	variant: string;
	category?: string;
}

/** A whole set, ready for filtering */
export interface LoadedSet {
	icons: SetIcon[];
	/** Categories in display order; empty if the set has none */
	categories: string[];
}

/** Cache Storage for whole sets, kept across app versions (keys are the hashed asset URLs) */
export const ICON_CACHE = 'screen-capture:icon-sets';

const loaded = new Map<IconSetId, Promise<LoadedSet>>();

/** Whole icon set, loaded once (from the browser cache if fetched before) */
export function loadAllIcons(id: IconSetId): Promise<LoadedSet> {
	let set = loaded.get(id);
	if (!set) {
		set = fetchSet(id).catch((e) => {
			// Allow another attempt (e.g. once back online)
			loaded.delete(id);
			throw e;
		});
		loaded.set(id, set);
	}
	return set;
}

/** Was the whole set fetched before? Then it loads without a download. */
export async function isIconSetCached(id: IconSetId): Promise<boolean> {
	const cache = await openCache();
	return !!cache && !!(await cache.match(setOf(id).url));
}

async function fetchSet(id: IconSetId): Promise<LoadedSet> {
	const def = setOf(id);
	const [set, meta] = await Promise.all([
		fetchJson<IconSet>(def.url),
		def.meta ? fetchJson<{ categories?: Record<string, string[]> }>(def.meta) : undefined
	]);
	const categoryOf = new Map<string, string>();
	for (const [category, names] of Object.entries(meta?.categories ?? {})) {
		for (const name of names) if (!categoryOf.has(name)) categoryOf.set(name, category);
	}
	const suffixes = Object.keys(def.variants);
	return {
		icons: iconList(set).map((icon) => ({ icon, variant: variantOf(suffixes, icon.name), category: categoryOf.get(icon.name) })),
		categories: Object.keys(meta?.categories ?? {})
	};
}

let cachePromise: Promise<Cache | null> | undefined;

/** The icon cache, without entries of former versions; null without Cache Storage (e.g. insecure context) */
function openCache(): Promise<Cache | null> {
	cachePromise ??= (async () => {
		if (typeof caches === 'undefined') return null;
		const cache = await caches.open(ICON_CACHE);
		const current = new Set(ICON_SETS.flatMap((s) => [s.url, s.meta]).map((url) => url && new URL(url, location.href).href));
		for (const request of await cache.keys()) if (!current.has(request.url)) await cache.delete(request);
		return cache;
	})().catch((e) => {
		console.error('[icons] cache not available', e);
		return null;
	});
	return cachePromise;
}

async function fetchJson<T>(url: string): Promise<T> {
	const cache = await openCache();
	const cached = await cache?.match(url);
	if (cached) return cached.json();
	const response = await fetch(url);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	// Storing must not break loading (e.g. quota exceeded)
	await cache?.put(url, response.clone()).catch((e) => console.error('[icons] could not cache', url, e));
	return response.json();
}

/** Visible icons of an Iconify set */
export function iconList(set: IconSet): IconData[] {
	const { width = 24, height = 24 } = set;
	return Object.entries(set.icons)
		.filter(([, icon]) => !icon.hidden)
		.map(([name, icon]) => ({ name, body: icon.body, width: icon.width ?? width, height: icon.height ?? height }));
}

/** Style of an icon from its name: the longest matching suffix (`outline-rounded` before `rounded`), else `''` */
export function variantOf(suffixes: readonly string[], name: string): string {
	let best = '';
	for (const suffix of suffixes) {
		if (suffix.length > best.length && name.endsWith(`-${suffix}`)) best = suffix;
	}
	return best;
}

const words = (query: string) => query.toLowerCase().split(/[\s-]+/).filter(Boolean);
const matches = (name: string, query: string[]) => query.every((w) => name.includes(w));

/** Icons whose name contains all words of `query` (names are English, e.g. `arrow-forward`) */
export function searchIcons(icons: IconData[], query: string): IconData[] {
	const q = words(query);
	return q.length ? icons.filter((icon) => matches(icon.name, q)) : icons;
}

export interface IconFilter {
	query: string;
	/** Name suffix of the style; null: all */
	variant: string | null;
	/** null: all */
	category: string | null;
}

/** Icons of a whole set matching search, style and category */
export function filterIcons(icons: SetIcon[], filter: IconFilter): IconData[] {
	const q = words(filter.query);
	const result: IconData[] = [];
	for (const { icon, variant, category } of icons) {
		if (filter.variant !== null && variant !== filter.variant) continue;
		if (filter.category !== null && category !== filter.category) continue;
		if (matches(icon.name, q)) result.push(icon);
	}
	return result;
}
