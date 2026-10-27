// PWA state for the installable in-browser.de tools: register the Service Worker, offer installation,
// announce new versions. Only active in the production build (the dev server has no Service Worker).

import { dev, version } from '$app/env';
import { resolve } from '$app/paths';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state({
	/** The browser offers installation (and the app is not already running installed). */
	installable: false,
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

let installEvent: BeforeInstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;
let started = false;

export function initPwa() {
	if (started || typeof window === 'undefined') return;
	started = true;

	window.addEventListener('beforeinstallprompt', (e) => {
		// Show our own button instead of the browser bar
		e.preventDefault();
		installEvent = e as BeforeInstallPromptEvent;
		pwa.installable = true;
	});
	window.addEventListener('appinstalled', () => {
		installEvent = null;
		pwa.installable = false;
	});

	if (dev || !('serviceWorker' in navigator)) return;
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

	let reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading || !waiting) return;
		reloading = true;
		location.reload();
	});
}

export async function install() {
	if (!installEvent) return;
	await installEvent.prompt();
	await installEvent.userChoice;
	installEvent = null;
	pwa.installable = false;
}

/** Activates the waiting version; the page reloads afterwards. */
export function applyUpdate() {
	waiting?.postMessage('SKIP_WAITING');
}
