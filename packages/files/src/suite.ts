import { initPwa } from '@in-browser/brand/pwa.svelte.js';
import { pruneIncoming } from './incoming.js';
import { installLaunchHandler } from './receive.svelte.js';
import { suiteSettings } from './suite-settings.svelte.js';
import { startSync } from './sync/sync.svelte.js';

// What runs as long as the tab, whatever page it shows (decided by the user, 2026-11-27: pages change without
// reloading, so the connections of the syncs stay): the Service Worker's registration, both syncs, the suite
// settings, files opened with the suite. Started once – by the first tool frame at once (its pages read the
// connections and the sync state right away), on the overview when `Suite.svelte` has loaded.

let started = false;

export function startSuite(): void {
	if (started || typeof window === 'undefined') return;
	started = true;
	initPwa();
	// Keeps My files in sync with the folder on disk and the other devices while any page of the suite is open
	startSync();
	void suiteSettings.load();
	// “Open with in-browser” of the operating system, whatever page the window shows
	installLaunchHandler();
	void pruneIncoming().catch(() => {});
}
