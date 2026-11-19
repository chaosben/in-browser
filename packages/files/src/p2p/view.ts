import type { Share } from './shares.js';

// What the UI shows of the device sync (`Device.view()`, mirrored to every tab as `p2pStatus.view`). Its own module,
// so the app can show the status before the sync code (`device.ts`) is loaded.

export interface DeviceView {
	id: string;
	name: string;
	self: boolean;
	online: boolean;
	/** In the room, but no direct connection came about */
	unreachable: boolean;
	/** Has another protocol version */
	outdated: boolean;
	syncing: { done: number; total: number } | null;
	lastSync: number;
	lastSeen: number;
	/** Changes it is missing, as far as known */
	missing: { changes: number; more: boolean } | null;
	scope: string[];
}

export interface P2pView {
	state: 'off' | 'online' | 'removed';
	self: { id: string; name: string } | null;
	devices: DeviceView[];
	invite: { code: string; expires: number } | null;
	scope: string[];
	pendingDeletes: number;
	failed: number;
	/** Last sync of this device with any other */
	lastSync: number;
	/** Folders shared with a guest right now */
	shares: ShareView[];
}

/** No group (yet), or not started */
export const OFF_VIEW: P2pView = { state: 'off', self: null, devices: [], invite: null, scope: [], pendingDeletes: 0, failed: 0, lastSync: 0, shares: [] };

export interface ShareView {
	id: string;
	folder: string;
	mode: Share['mode'];
	code: string;
	/** A guest is connected right now */
	connected: boolean;
	/** A guest opened it (the link no longer works in another browser) */
	used: boolean;
}
