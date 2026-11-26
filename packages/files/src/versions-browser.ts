import { cacheDir, storageEstimate } from './cache.js';
import { exists, list, moveOut, stat, write } from './opfs.js';
import { basename, extname, join, parent, stem, uniqueName } from './path.js';
import { handleTree } from './sync/handle-tree.js';
import {
	beginVersion,
	cleanVersions,
	deletedGroups,
	dropOldest,
	listVersions,
	VERSION_DATA,
	versionDataPath,
	type Version,
	type VersionReason,
	type VersionStore
} from './sync/versions.js';
import type { Retention } from './trash.js';

// The earlier versions in the browser (`sync/versions.ts`): `cache/files/versions/`, filled by the syncs through
// `opfsTree.keep`, shown in Files (“Earlier versions …” of a file; deleted ones in the trash) and cleaned up with the
// trash.

const versionsDir = () => cacheDir('files', 'versions');
const store = async (): Promise<VersionStore> => handleTree(await versionsDir());

/** `Tree.keep` of My files: the file goes into the versions (moved, so it costs no extra space) */
export async function keepInBrowser(path: string, reason: VersionReason): Promise<void> {
	const entry = await stat(path);
	if (!entry || entry.kind !== 'file') throw new Error(`Not a file: ${path}`);
	const versions = await store();
	const id = await beginVersion(versions, { path, reason, size: entry.size ?? 0, modified: entry.modified ?? 0 });
	await moveOut(path, await cacheDir('files', 'versions', id), VERSION_DATA);
}

export const listAllVersions = async () => listVersions(await store());

/** Earlier versions of one file, newest first */
export async function versionsOf(path: string): Promise<Version[]> {
	return (await listAllVersions()).filter((v) => v.path === path);
}

/** Deleted versions as entries of the trash (only on this device) */
export async function deletedVersions() {
	return deletedGroups(await listAllVersions(), exists);
}

/**
 * Puts a version back into My files as a copy: at its old place when that is free (a deleted file), else next to it
 * as `Name (label).ext`, numbered if taken. Returns the path.
 */
export async function restoreVersion(version: Version, label: string): Promise<string> {
	const folder = parent(version.path);
	let path = version.path;
	if (await exists(path)) {
		const name = basename(path);
		const taken = (await list(folder)).map((e) => e.name);
		path = join(folder, uniqueName(`${stem(name)} (${label})${extname(name)}`, taken));
	}
	await write(path, await (await store()).read(versionDataPath(version.entry)));
	return path;
}

/** Removes versions for good */
export async function removeVersions(versions: Version[]): Promise<void> {
	const s = await store();
	for (const v of versions) await s.remove(`/${v.entry}`);
}

/** Expired versions go with the trash's retention */
export async function cleanBrowserVersions(retention: Retention): Promise<void> {
	await cleanVersions(await store(), retention);
	await makeRoom();
}

/** When storage runs low (less than a tenth free), the oldest versions go first – before a sync finds no room */
export async function makeRoom(): Promise<void> {
	try {
		const estimate = await storageEstimate();
		if (!estimate?.quota) return;
		const free = estimate.quota - (estimate.usage ?? 0);
		if (free < estimate.quota / 10) await dropOldest(await store(), estimate.quota / 10 - free);
	} catch (e) {
		console.warn('[Versions] making room failed', e);
	}
}
