// Service Worker of the whole suite: makes the launcher (the overview) and the tools installable and usable
// offline. It is registered by every page via `initPwa()` from @in-browser/brand and covers the whole origin.
// - Build files, prerendered pages and `static/` are precached on install (one cache per version).
// - Navigations and the files of `static/` (same name, changing content): network first, offline the cached copy.
//   Build files (hashed names): cache first.
// - A new version waits until a page activates it via the `SKIP_WAITING` message (user clicks "Reload"), or
//   silently when the page already runs that version (`VERSION` message).
// - Pages of an older version stay open and are never reloaded unasked: the cache of a version is kept while a page
//   still runs it (`dropUnused` asks the pages), so what they load later (PDF.js, languages) is still there after a
//   deploy removed it from the server.
// - `/_live/<token>/<name>`: media read in pieces from wherever they live (`mediaUrl` in @in-browser/files): range
//   responses whose bytes the page that made the token reads for us.

import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';
import { fetchFresh } from './fetch-fresh.js';

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
const IMMUTABLE = '/_app/immutable/';

self.addEventListener('install', (event) => {
	// Not `addAll`: it would take a 404 the HTTP cache kept (`fetchFresh`) and never install
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await Promise.all(
				PRECACHE.map(async (path) => {
					const response = await fetchFresh(path);
					if (!response.ok) throw new Error(`${path}: ${response.status}`);
					await cache.put(path, response);
				})
			);
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			await self.clients.claim();
			await dropUnused();
		})()
	);
});

/** A page's build version; `null` if it does not answer (frozen, or from before pages answered) */
function pageVersion(client: Client): Promise<string | null> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timeout = setTimeout(() => resolve(null), 2000);
		channel.port1.onmessage = (e) => {
			clearTimeout(timeout);
			resolve(typeof e.data === 'string' ? e.data : null);
		};
		client.postMessage('VERSION', [channel.port2]);
	});
}

let dropping: Promise<void> | null = null;
/**
 * Removes the caches of versions no open page runs anymore. Only our own (`PREFIX`); caches of the tools (e.g.
 * downloaded icon sets) stay.
 */
function dropUnused(): Promise<void> {
	return (dropping ??= (async () => {
		try {
			const used = new Set([CACHE]);
			const pages = await self.clients.matchAll({ type: 'window' });
			for (const page of await Promise.all(pages.map(pageVersion))) if (page) used.add(PREFIX + page);
			for (const key of await caches.keys()) if (key.startsWith(PREFIX) && !used.has(key)) await caches.delete(key);
		} finally {
			dropping = null;
		}
	})());
}

self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
	// The page compares it with its own version (see `initPwa`)
	else if (event.data === 'VERSION') event.ports[0]?.postMessage(version);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/files' && url.searchParams.has('share-target')) {
		event.respondWith(receiveShare(request));
		return;
	}
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (url.pathname.startsWith('/_live/')) {
		event.respondWith(live(event, request, url));
		return;
	}
	if (request.mode === 'navigate') {
		event.respondWith(navigate(request, url));
		// A page went or came: a good moment to let go of versions nobody runs
		event.waitUntil(dropUnused());
	} else if (url.pathname.startsWith(IMMUTABLE)) {
		// Build files never change under their name (a hash): the cache first – of older versions too, so pages
		// still running them find their files
		event.respondWith(cacheFirst(url.pathname, request));
	} else if (PRECACHED.has(url.pathname)) {
		// Files of `static/` keep their name when they change (tool icons, manifests): like the pages, from the
		// network first – a page of the new version must never show the icons an older worker cached
		event.respondWith(networkFirst(url.pathname, request));
	}
});

/** This version's copy first (pages and `static/` have the same path in every version), then any version's */
async function cached(path: string): Promise<Response | undefined> {
	return (await (await caches.open(CACHE)).match(path)) ?? (await caches.match(path));
}

async function navigate(request: Request, url: URL): Promise<Response> {
	try {
		return await fetch(request);
	} catch (error) {
		// Prerendered pages are cached under their path (query strings like `?id=` do not matter)
		const page = await (await caches.open(CACHE)).match(url.pathname);
		if (page) return page;
		throw error;
	}
}

async function networkFirst(path: string, request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch (error) {
		const kept = await cached(path);
		if (kept) return kept;
		throw error;
	}
}

async function cacheFirst(path: string, request: Request): Promise<Response> {
	return (await cached(path)) ?? fetchFresh(request);
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

// --- Share target: another app of the device shared with the installed suite (`share_target` of
// `static/manifest.webmanifest`). What arrives is kept where pages find it – the layout of
// `packages/files/src/incoming.ts`: `cache/files/incoming/<id>/` with the files as `0`, `1` … and `meta.json` – and the
// page is told by its address (`/files?received=<id>`). Nothing leaves the device.

async function receiveShare(request: Request): Promise<Response> {
	try {
		const form = await request.formData();
		const files = form.getAll('files').filter((f): f is File => f instanceof File && f.name !== '');
		const field = (name: string) => {
			const value = form.get(name);
			return typeof value === 'string' ? value : undefined;
		};
		const id = crypto.randomUUID();
		let dir = await navigator.storage.getDirectory();
		for (const name of ['cache', 'files', 'incoming', id]) dir = await dir.getDirectoryHandle(name, { create: true });
		for (const [i, file] of files.entries()) {
			const out = await (await dir.getFileHandle(String(i), { create: true })).createWritable();
			await file.stream().pipeTo(out);
		}
		const meta = { title: field('title'), text: field('text'), url: field('url'), files: files.map((f) => ({ name: f.name, type: f.type })), at: Date.now() };
		const out = await (await dir.getFileHandle('meta.json', { create: true })).createWritable();
		await out.write(JSON.stringify(meta));
		await out.close();
		return Response.redirect(`/files?received=${id}`, 303);
	} catch (e) {
		console.error('[service worker] share target', e);
		return Response.redirect('/files', 303);
	}
}
