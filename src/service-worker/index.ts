// Service Worker of the whole suite: makes the tools installable and usable offline. It is registered by the
// tools (`initPwa()` from @in-browser/brand), never by the overview, but covers the whole origin.
// - Build files, prerendered pages and `static/` are precached on install (one cache per version).
// - Navigations: network first, offline the cached page of that path (every page is prerendered).
// - A new version waits until a page activates it via the `SKIP_WAITING` message (user clicks "Reload"), or
//   silently when the page already runs that version (`VERSION` message).
// Media come from the OPFS or as blob: URLs and do not go through the Service Worker.

import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const PREFIX = 'in-browser-';
const CACHE = `${PREFIX}${version}`;
// No base path: simply make manifest paths absolute
const abs = (path: string) => `/${path}`;

const PRECACHE = [
	...prerendered.map((page) => abs(page.path)),
	// Except Screen Capture's whole icon sets and their metadata (2–8 MB each, loaded only on demand and kept
	// in their own cache, see `tools/screen-capture/src/icons/index.ts`)
	...immutable.filter((file) => !/\/(icons|metadata)\.[\w-]+\.json$/.test(file.path)).map((file) => abs(file.path)),
	// `_headers` & co. are Cloudflare configuration, not served files
	...assets.filter((file) => !file.path.split('/').pop()!.startsWith('_')).map((file) => abs(file.path))
];
const PRECACHED = new Set(PRECACHE);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Only our own old versions go; caches of the tools (e.g. downloaded icon sets) stay
			for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
	// The page compares it with its own version (see `initPwa`)
	else if (event.data === 'VERSION') event.ports[0]?.postMessage(version);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(navigate(request, url));
	} else if (PRECACHED.has(url.pathname)) {
		event.respondWith(cacheFirst(url.pathname, request));
	}
});

async function navigate(request: Request, url: URL): Promise<Response> {
	try {
		return await fetch(request);
	} catch (error) {
		// Prerendered pages are cached under their path (query strings like `?id=` do not matter)
		const page = await caches.match(url.pathname);
		if (page) return page;
		throw error;
	}
}

async function cacheFirst(path: string, request: Request): Promise<Response> {
	const cached = await caches.match(path);
	return cached ?? fetch(request);
}
