import type { Share } from './shares.js';
import type { HeldFolder } from '../sync/plan.js';
import type { Staleness } from './staleness.js';

// What the UI shows of the device sync (`Device.view()`, mirrored to every tab as `p2pStatus.view`). Its own module,
// so the app can show the status before the sync code (`device.ts`) is loaded.

export interface DeviceView {
	id: string;
	name: string;
	self: boolean;
	online: boolean;
	/** In the room, but no direct connection came about */
	unreachable: boolean;
	/** Has an older protocol version: it needs the update */
	outdated: boolean;
	/** Has a newer protocol version: this device needs the update */
	newer: boolean;
	syncing: { done: number; total: number } | null;
	lastSync: number;
	lastSeen: number;
	/** Name of the device that saw it last (`lastSeen`), when it wasn't seen here directly */
	via: string | null;
	/** Compared with this device, as far as known (also through other devices) */
	missing: Staleness | null;
	scope: string[];
}

export interface P2pView {
	state: 'off' | 'online' | 'removed';
	self: { id: string; name: string } | null;
	devices: DeviceView[];
	invite: { code: string; expires: number } | null;
	scope: string[];
	pendingDeletes: number;
	/** New folders waiting for confirmation before they come to this device */
	pendingFolders: HeldFolder[];
	/** Just joined: waits for the folder choice */
	setup: boolean;
	failed: number;
	/** Last sync of this device with any other */
	lastSync: number;
	/** Another device is known to have changes this one is missing */
	behind: boolean;
	/** Folders shared with a guest right now */
	shares: ShareView[];
	/** What the other ends of connections offer live now (`live-ends.ts`), with this device's paths */
	live: LiveView[];
}

/** No group (yet), or not started */
export const OFF_VIEW: P2pView = { state: 'off', self: null, devices: [], invite: null, scope: [], pendingDeletes: 0, pendingFolders: [], setup: false, failed: 0, lastSync: 0, behind: false, shares: [], live: [] };

export interface ShareView {
	id: string;
	folder: string;
	mode: Share['mode'];
	code: string;
	/** Only that entry (a file, a package) is shared */
	single?: true;
	/** When it runs out (ms since 1970); missing: when it is ended */
	expires?: number;
	/** A guest is connected right now */
	connected: boolean;
	/** A guest opened it (the link no longer works in another browser) */
	used: boolean;
}

export interface LiveView {
	/** The end it comes from (`LivePeer.id`) */
	end: string;
	/** The device's name; empty for a guest */
	peer: string;
	kind: string;
	/** The document on this device */
	path: string;
	title: string;
}
