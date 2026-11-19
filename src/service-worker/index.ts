// Service Worker of the whole suite: makes the launcher (the overview) and the tools installable and usable
// offline. It is registered by every page via `initPwa()` from @in-browser/brand and covers the whole origin.
// - Build files, prerendered pages and `static/` are precached on install (one cache per version).
// - Navigations: network first, offline the cached page of that path (every page is prerendered).
// - A new version waits until a page activates it via the `SKIP_WAITING` message (user clicks "Reload"), or
//   silently when the page already runs that version (`VERSION` message).
// - `/_live/<token>/<name>`: media read in pieces from wherever they live (`mediaUrl` in @in-browser/files): range
//   responses whose bytes the page that made the token reads for us.

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
	// in their own cache, see `packages/graphics/src/icons/index.ts`)
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

	if (url.pathname.startsWith('/_live/')) {
		event.respondWith(live(event, request, url));
		return;
	}
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

// --- Media read in pieces (`/_live/`) ---

/** Bytes per response: video elements ask for open ranges and come back for the rest */
const LIVE_CHUNK = 4 * 1024 * 1024;
const LIVE_TIMEOUT = 30_000;
/**
 * Only media elements may load these: the bytes come from anywhere (another device, a guest share, a folder on disk),
 * and opened as a page an SVG or HTML file would run in our origin
 */
const LIVE_DESTINATIONS = new Set<RequestDestination>(['image', 'video', 'audio', 'track']);
/** Never a document of our origin, never sniffed into something else */
// (SVG images apply it too: their own styles and embedded images stay allowed)
const LIVE_HEADERS = {
	'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; sandbox",
	'X-Content-Type-Options': 'nosniff'
};

type LiveAnswer = { size: number; type: string } | { bytes: Uint8Array } | { unknown: true } | { error: string };

function askClient(client: Client, message: object): Promise<LiveAnswer> {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const timer = setTimeout(() => reject(new Error('No answer from the page')), LIVE_TIMEOUT);
		channel.port1.onmessage = (event: MessageEvent<LiveAnswer>) => {
			clearTimeout(timer);
			resolve(event.data);
		};
		client.postMessage({ type: 'in-browser-live', ...message }, [channel.port2]);
	});
}

/** The page that made the token: usually the one asking, otherwise any of ours */
async function liveClient(event: FetchEvent, token: string): Promise<{ client: Client; size: number; type: string } | null> {
	const own = event.clientId ? await self.clients.get(event.clientId) : undefined;
	const all = await self.clients.matchAll({ type: 'window' });
	for (const client of own ? [own, ...all.filter((c) => c.id !== own.id)] : all) {
		const meta = await askClient(client, { token, op: 'meta' }).catch(() => null);
		if (meta && 'size' in meta) return { client, size: meta.size, type: meta.type };
	}
	return null;
}

async function readBytes(client: Client, token: string, start: number, end: number): Promise<Uint8Array> {
	const answer = await askClient(client, { token, op: 'read', start, end });
	if ('bytes' in answer) return answer.bytes;
	throw new Error('error' in answer ? answer.error : 'Gone');
}

async function live(event: FetchEvent, request: Request, url: URL): Promise<Response> {
	if (!LIVE_DESTINATIONS.has(request.destination)) return new Response('Forbidden', { status: 403, headers: LIVE_HEADERS });
	const token = url.pathname.split('/')[2] ?? '';
	const found = await liveClient(event, token);
	if (!found) return new Response('Not found', { status: 404 });
	const { client, size, type } = found;
	const headers = { ...LIVE_HEADERS, 'Content-Type': type || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
	const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') ?? '');
	if (range) {
		let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
		let end = range[1] && range[2] ? Number(range[2]) + 1 : size;
		if (!range[1]) end = size;
		end = Math.min(end, size, start + LIVE_CHUNK);
		if (start >= size || start >= end) {
			return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
		}
		start = Math.max(0, start);
		const bytes = await readBytes(client, token, start, end);
		return new Response(bytes as BodyInit, {
			status: 206,
			headers: { ...headers, 'Content-Range': `bytes ${start}-${end - 1}/${size}`, 'Content-Length': String(bytes.length) }
		});
	}
	// Whole file: streamed piece by piece
	let offset = 0;
	const body = new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (offset >= size) return controller.close();
			const end = Math.min(size, offset + 1024 * 1024);
			controller.enqueue(await readBytes(client, token, offset, end));
			offset = end;
		}
	});
	return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
}
