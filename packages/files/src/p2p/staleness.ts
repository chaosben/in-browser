import { missing, type Change, type DeviceInfo } from './knowledge.js';

// Whether a device is probably not up to date, for the hints in the device list and the footer

export interface Staleness {
	/** Changes it is missing (paths); `more` when the log doesn't reach back far enough */
	changes: number;
	more: boolean;
}

/** What another device is missing, judged from what is known about it */
export function staleness(info: DeviceInfo, log: Change[]): Staleness {
	const { paths, more } = missing(info.vector, info.scope, log);
	return { changes: paths, more };
}

/** One day without a sync while devices exist: work here could lead to conflict copies */
export const SELF_STALE_AFTER = 24 * 60 * 60 * 1000;

export function selfStale(lastSync: number, othersOnline: number, now: number): boolean {
	return othersOnline === 0 && lastSync > 0 && now - lastSync > SELF_STALE_AFTER;
}
