// Service Worker: makes the app installable and usable offline.
// - Build files and `static/` are precached on install (one cache per version).
// - Navigations: network first, offline the cached app shell (SPA, every path serves index.html).
// - A new version waits until the page activates it via the `SKIP_WAITING` message (user clicks "Reload"), or
//   silently when the page already runs that version (`VERSION` message).
// Media come from the OPFS or as blob: URLs and do not go through the Service Worker.

import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `screen-capture-${version}`;
// Own subdomain, no base path: simply make manifest paths absolute
const abs = (path: string) => `/${path}`;
const SHELL = '/';
/** Same name as `ICON_CACHE` in `lib/icons/index.ts` */
const ICON_CACHE = 'screen-capture:icon-sets';

const PRECACHE = [
	SHELL,
	// Except the whole icon sets and their metadata (2–8 MB each, loaded only on demand, see `lib/icons/index.ts`)
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
			// Old versions go; downloaded icon sets stay (they have their own cache, see `lib/icons/index.ts`)
			for (const key of await caches.keys()) if (key !== CACHE && key !== ICON_CACHE) await caches.delete(key);
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
		event.respondWith(navigate(request));
	} else if (PRECACHED.has(url.pathname)) {
		event.respondWith(cacheFirst(url.pathname, request));
	}
});

async function navigate(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch (error) {
		const shell = await caches.match(SHELL);
		if (shell) return shell;
		throw error;
	}
}

async function cacheFirst(path: string, request: Request): Promise<Response> {
	const cached = await caches.match(path);
	return cached ?? fetch(request);
}
