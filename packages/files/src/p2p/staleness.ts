import { missing, type Change, type DeviceInfo, type Vector } from './knowledge.js';

// Whether a device is up to date, for the hints in the device list and the footer – judged from what is known about
// it, also when that came through another device (A → B → C)

export interface Staleness {
	/** Changes it is missing (paths); `more` when the log doesn't reach back far enough */
	changes: number;
	more: boolean;
	/** It has changes this device is missing */
	ahead: boolean;
}

/** Compared with this device, from what is known about the other one (as of its `lastSeen`) */
export function staleness(info: DeviceInfo, log: Change[], mine: { vector: Vector; scope: readonly string[] }): Staleness {
	const theirs = missing(info.vector, info.scope, log);
	const ours = missing(mine.vector, mine.scope, log, info.vector);
	return { changes: theirs.paths, more: theirs.more, ahead: ours.paths > 0 || ours.more };
}

/** Both have the same state, as far as known */
export const upToDate = (s: Staleness) => !s.changes && !s.more && !s.ahead;

/** It is missing changes this device has */
export const behind = (s: Staleness) => s.changes > 0 || s.more;

/** One day without a sync while devices exist: work here could lead to conflict copies */
export const SELF_STALE_AFTER = 24 * 60 * 60 * 1000;

/** No other device connected, and one of them is known to have more, or the last sync is a day ago */
export function selfStale(lastSync: number, ahead: boolean, othersOnline: number, now: number): boolean {
	return othersOnline === 0 && (ahead || (lastSync > 0 && now - lastSync > SELF_STALE_AFTER));
}
