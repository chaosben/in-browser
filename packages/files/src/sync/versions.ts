import { inTrash, entryName, expired, parseEntry, type Retention } from '../trash.js';
import { isInside, segments } from '../path.js';
import { ignored } from './plan.js';
import type { Tree } from './tree.js';

// Earlier versions: what a sync replaces or deletes on this device because another side changed it is kept for a
// while instead of being gone (the user's own deletions go into the synced trash instead). Versions stay on the
// device – never synced, never in My files: the browser keeps them in `cache/files/versions/`, the p2p-node in
// `versions/` of its instance. One entry per version: `<entry>/info.json` (`VersionInfo`, written first) and
// `<entry>/data` (the file). Entry names are those of the trash (`entryName`: sortable by time).
// They go after the trash's retention (suite setting), oldest first when storage runs low.

export type VersionReason = 'replaced' | 'deleted';

export interface VersionInfo {
	/** Where the file was */
	path: string;
	reason: VersionReason;
	/** When it was kept (ms) */
	time: number;
	size: number;
	/** The file's own date */
	modified: number;
}

export interface Version extends VersionInfo {
	entry: string;
}

/** The area of the versions, as a tree of its own (root = the versions folder) */
export type VersionStore = Pick<Tree, 'names' | 'read' | 'write' | 'remove' | 'stat'>;

export const VERSION_INFO = 'info.json';
export const VERSION_DATA = 'data';
export const versionInfoPath = (entry: string) => `/${entry}/${VERSION_INFO}`;
export const versionDataPath = (entry: string) => `/${entry}/${VERSION_DATA}`;

/** Files worth keeping: the user's, not the trash (emptied on purpose), tool data or what the syncs ignore */
export const versioned = (path: string) => !inTrash(path) && !isInside(path, '/.apps') && path !== '/.apps' && !ignored(path);

/**
 * Starts a version: writes its info and returns the entry; the caller then moves the file to `versionDataPath(entry)`
 * (an entry without data is never listed and goes with the cleanup)
 */
export async function beginVersion(store: VersionStore, info: Omit<VersionInfo, 'time'>, now = Date.now()): Promise<string> {
	const entry = entryName(now);
	const writer = (await store.write(versionInfoPath(entry))).getWriter();
	await writer.write(new TextEncoder().encode(JSON.stringify({ ...info, time: now } satisfies VersionInfo)));
	await writer.close();
	return entry;
}

/** Every complete version, newest first */
export async function listVersions(store: VersionStore): Promise<Version[]> {
	const out: Version[] = [];
	for (const entry of await store.names('/')) {
		if (parseEntry(entry) === null) continue;
		try {
			const info = JSON.parse(await (await store.read(versionInfoPath(entry))).text()) as VersionInfo;
			if (typeof info?.path !== 'string' || !(await store.stat(versionDataPath(entry)))) continue;
			out.push({ ...info, entry });
		} catch {
			// Unreadable or half-made: not a version (the cleanup takes it by its name)
		}
	}
	return out.sort((a, b) => b.time - a.time || a.path.localeCompare(b.path));
}

/** Removes versions older than the retention (the local clock made them, so the entry's name counts) */
export async function cleanVersions(store: VersionStore, retention: Retention, now = Date.now()): Promise<void> {
	if (retention === null) return;
	for (const entry of await store.names('/')) {
		if (expired(entry, now, retention)) await store.remove(`/${entry}`);
	}
}

/** Removes the oldest versions until `bytes` are freed (storage running low); returns what was freed */
export async function dropOldest(store: VersionStore, bytes: number): Promise<number> {
	let freed = 0;
	for (const version of (await listVersions(store)).reverse()) {
		if (freed >= bytes) break;
		await store.remove(`/${version.entry}`);
		freed += version.size;
	}
	return freed;
}

/**
 * Deleted versions as entries of the trash: one per file, or one per folder that is gone as a whole (its files
 * together). `exists` tells whether a path is there now. Of a file deleted several times, the newest version counts.
 */
export async function deletedGroups(versions: Version[], exists: (path: string) => Promise<boolean>): Promise<{ path: string; kind: 'file' | 'directory'; versions: Version[] }[]> {
	const newest = new Map<string, Version>();
	for (const v of versions) if (v.reason === 'deleted' && !newest.has(v.path)) newest.set(v.path, v);
	const groups = new Map<string, { path: string; kind: 'file' | 'directory'; versions: Version[] }>();
	const gone = new Map<string, boolean>();
	const isGone = async (path: string) => {
		if (!gone.has(path)) gone.set(path, !(await exists(path)));
		return gone.get(path)!;
	};
	for (const v of newest.values()) {
		if (!(await isGone(v.path))) continue;
		// The topmost folder above it that is gone: the folder that was deleted
		let top = v.path;
		const names = segments(v.path);
		for (let i = names.length - 1; i >= 1; i--) {
			const folder = '/' + names.slice(0, i).join('/');
			if (!(await isGone(folder))) break;
			top = folder;
		}
		const group = groups.get(top) ?? { path: top, kind: top === v.path ? ('file' as const) : ('directory' as const), versions: [] };
		group.versions.push(v);
		groups.set(top, group);
	}
	return [...groups.values()];
}
