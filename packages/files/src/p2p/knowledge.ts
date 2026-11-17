import { inScope } from './scope.js';

// What every device knows, for hints on devices that are probably not up to date – also when they got the latest
// changes indirectly (A → B → C):
// - Every local change gets a running number of the device it happened on: `(origin, n, path)`. The log travels with
//   every sync (the last `LOG_LIMIT` entries per origin).
// - A vector `{origin → n}` says up to which number a device has all changes of that origin (within its folders).
//   After a sync without failures a device takes over the partner's numbers as far as it really got them.

export interface Change {
	/** Device the change happened on */
	o: string;
	/** Running number on that device */
	n: number;
	p: string;
}

export type Vector = Record<string, number>;

export const LOG_LIMIT = 1000;

/** Records a local change; returns the new log and vector */
export function record(log: Change[], vector: Vector, origin: string, path: string): { log: Change[]; vector: Vector } {
	const n = (vector[origin] ?? 0) + 1;
	return { log: trim([...log, { o: origin, n, p: path }]), vector: { ...vector, [origin]: n } };
}

export function mergeLogs(a: Change[], b: Change[]): Change[] {
	const byKey = new Map<string, Change>();
	for (const change of [...a, ...b]) byKey.set(`${change.o}:${change.n}`, change);
	return trim([...byKey.values()]);
}

/** Keeps the newest `LOG_LIMIT` entries per origin, sorted by origin and number */
function trim(log: Change[]): Change[] {
	const byOrigin = new Map<string, Change[]>();
	for (const change of log) byOrigin.set(change.o, [...(byOrigin.get(change.o) ?? []), change]);
	return [...byOrigin.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.flatMap(([, changes]) => changes.sort((a, b) => a.n - b.n).slice(-LOG_LIMIT));
}

/**
 * My vector after a sync without failures with a partner: per origin, as far as every change in between either lies
 * outside my folders or inside the partner's (then I got it). Without the log entries in between (trimmed) only when
 * the partner takes part in everything I do.
 */
export function advance(mine: Vector, myScope: readonly string[], theirs: Vector, theirScope: readonly string[], log: Change[]): Vector {
	const out = { ...mine };
	const coversMine = theirScope.every((folder) => !inScope(folder, myScope));
	for (const [origin, target] of Object.entries(theirs)) {
		let n = out[origin] ?? 0;
		if (target <= n) continue;
		const changes = new Map(log.filter((c) => c.o === origin && c.n > n && c.n <= target).map((c) => [c.n, c]));
		if (changes.size < target - n) {
			if (coversMine) out[origin] = target;
			continue;
		}
		while (n < target) {
			const change = changes.get(n + 1)!;
			if (inScope(change.p, myScope) && !inScope(change.p, theirScope)) break;
			n++;
		}
		out[origin] = n;
	}
	return out;
}

/** Changes a device with this vector and these folders is missing: count of paths, `more` if the log is trimmed */
export function missing(vector: Vector, scope: readonly string[], log: Change[]): { paths: number; more: boolean } {
	const paths = new Set<string>();
	let more = false;
	const newest = new Map<string, number>();
	const oldest = new Map<string, number>();
	for (const change of log) {
		newest.set(change.o, Math.max(newest.get(change.o) ?? 0, change.n));
		oldest.set(change.o, Math.min(oldest.get(change.o) ?? Infinity, change.n));
		if (change.n > (vector[change.o] ?? 0) && inScope(change.p, scope)) paths.add(change.p);
	}
	for (const [origin, first] of oldest) if ((vector[origin] ?? 0) < first - 1 && newest.get(origin)! > (vector[origin] ?? 0)) more = true;
	return { paths: paths.size, more };
}

/** What devices know about each other; travels with every contact */
export interface DeviceInfo {
	lastSeen: number;
	/** Last sync without failures with any device */
	lastSync: number;
	scope: string[];
	vector: Vector;
}

export function mergeDevices(a: Record<string, DeviceInfo>, b: Record<string, DeviceInfo>): Record<string, DeviceInfo> {
	const out: Record<string, DeviceInfo> = { ...a };
	for (const [id, info] of Object.entries(b)) {
		const mine = out[id];
		if (!mine) {
			out[id] = info;
			continue;
		}
		const vector = { ...mine.vector };
		for (const [o, n] of Object.entries(info.vector)) vector[o] = Math.max(vector[o] ?? 0, n);
		out[id] = {
			lastSeen: Math.max(mine.lastSeen, info.lastSeen),
			lastSync: Math.max(mine.lastSync, info.lastSync),
			scope: info.lastSeen > mine.lastSeen ? info.scope : mine.scope,
			vector
		};
	}
	return out;
}
