// PWA state for the installable launcher (overview) and tools: register the Service Worker and announce new versions.
// Installing is left to the browser (its own offer, e.g. in the address bar). Only active in the production build
// (the dev server has no Service Worker).

import { dev, version } from '$app/env';
import { resolve } from '$app/paths';

export const pwa = $state({
	/** A new version is loaded and waiting for “Reload”. */
	updateReady: false
});

/** Asks a Service Worker for its build version; `null` if it does not answer (older workers without the message). */
function workerVersion(worker: ServiceWorker): Promise<string | null> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timeout = setTimeout(() => resolve(null), 2000);
		channel.port1.onmessage = (e) => {
			clearTimeout(timeout);
			resolve(typeof e.data === 'string' ? e.data : null);
		};
		worker.postMessage('VERSION', [channel.port2]);
	});
}

let waiting: ServiceWorker | null = null;
let started = false;
/** The user chose “Reload” on this page */
let applying = false;

export function initPwa() {
	if (started || typeof window === 'undefined') return;
	started = true;

	if (!('serviceWorker' in navigator)) return;
	if (dev) {
		// The dev server has no Service Worker – but one left behind by a build served from this address (a preview)
		// would keep answering with what it cached, e.g. old tool icons after every normal reload. Remove it.
		void navigator.serviceWorker.getRegistrations().then((registrations) => {
			for (const registration of registrations) void registration.unregister();
			if (registrations.length) console.warn('[PWA] removed a Service Worker left behind on the dev server – reload once');
		});
		if ('caches' in window) void caches.keys().then((keys) => keys.filter((key) => key.startsWith('in-browser-')).forEach((key) => void caches.delete(key)));
		return;
	}
	navigator.serviceWorker
		.register(resolve('/') + 'service-worker.js', { type: 'module' })
		.then((registration) => {
			const track = (worker: ServiceWorker | null) => {
				if (!worker) return;
				let checked = false;
				const check = async () => {
					// Only an update if a version already controls the page (not on first install)
					if (checked || worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
					checked = true;
					// Navigations are network first: the page may already run the version the new worker brings.
					// Then just swap the worker (and its offline cache) – nothing to reload.
					if ((await workerVersion(worker)) === version) return worker.postMessage('SKIP_WAITING');
					waiting = worker;
					pwa.updateReady = true;
				};
				check();
				worker.addEventListener('statechange', check);
			};
			track(registration.waiting);
			registration.addEventListener('updatefound', () => track(registration.installing));
			// Check for new versions periodically when the tab stays open
			setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
		})
		.catch((e) => console.error('[PWA] Service worker could not be registered', e));

	// A new version took over. Only the page whose user said “Reload” reloads; every other one keeps running what it
	// has (a recording, unsaved input – never taken over unasked) and offers the reload. The worker keeps the files
	// of the versions open pages still run (it asks for them with `VERSION`).
	navigator.serviceWorker.addEventListener('controllerchange', async () => {
		if (applying) return location.reload();
		const controller = navigator.serviceWorker.controller;
		if (controller && (await workerVersion(controller)) !== version) pwa.updateReady = true;
	});
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data === 'VERSION') event.ports[0]?.postMessage(version);
	});
}

/** Takes over the new version: activates it if it still waits; the page reloads. */
export function applyUpdate() {
	if (applying) return;
	applying = true;
	// Another page may have activated it already: then nothing changes hands anymore, just reload
	if (waiting?.state === 'installed') waiting.postMessage('SKIP_WAITING');
	else location.reload();
}
