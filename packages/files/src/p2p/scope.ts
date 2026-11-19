import { isInside } from '../path.js';
import { inTrash, originalPath } from '../trash.js';
import type { Base, Snapshot } from '../sync/plan.js';

// Which folders a device takes part in: every device keeps a list of excluded folders (default: none, so new folders
// are synced automatically). An excluded folder is neither sent nor received by that device; between the other
// devices it keeps syncing. `/.apps` (tool data) is always synced.

/** Folders that can't be excluded */
const ALWAYS = '/.apps';

/**
 * Whether `path` takes part for a device with these excluded folders. In the trash, an item counts by where it was:
 * what was deleted in an excluded folder doesn't come to that device through the trash either.
 */
export function inScope(path: string, excluded: readonly string[]): boolean {
	if (inTrash(path)) {
		const original = originalPath(path);
		if (!original) return true;
		path = original;
	}
	if (path === ALWAYS || isInside(path, ALWAYS)) return true;
	return !excluded.some((folder) => isInside(path, folder));
}

export function canExclude(folder: string): boolean {
	return folder !== '/' && folder !== ALWAYS && !isInside(folder, ALWAYS);
}

/** Only the paths both devices take part in; applied to both snapshots and the base before planning */
export function intersect<T extends Snapshot | Base>(entries: T, mine: readonly string[], theirs: readonly string[]): T {
	const out = new Map() as T;
	for (const [path, value] of entries) {
		if (inScope(path, mine) && inScope(path, theirs)) (out as Map<string, unknown>).set(path, value);
	}
	return out;
}

/** Adds a folder to the excluded ones (dropping excluded folders inside it, which it now covers) */
export function exclude(excluded: readonly string[], folder: string): string[] {
	if (!inScope(folder, excluded)) return [...excluded];
	return [...excluded.filter((f) => !isInside(f, folder)), folder].sort();
}

/** Takes a folder (or the excluded folder it lies in) part again */
export function include(excluded: readonly string[], folder: string): string[] {
	return excluded.filter((f) => f !== folder && !isInside(folder, f));
}
