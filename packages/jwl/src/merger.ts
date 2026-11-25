// The merger of `.jwlibrary` backups for the suite's merge frame (`@in-browser/files/merge.js`): it reads both files,
// finds what they started from (kept by the frame) – the merge result named by the mark in a file, or the last
// backup of the incoming file's device –, merges and writes the result with a new mark. The result and the incoming
// backup (as its device's state) are kept for the next merge.

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { DEVICE_NAME, JwlError, jwlBlob, readJwl, type JwlFile } from './jwl-file.js';
import { difference, loss, mergeFiles, sameContent, tooMuchLost, type Snapshot } from './merge.js';
import { dataFromJson, dataToJson } from './model.js';

/** What the frame keeps of a merge result: when it was written and its data */
const baseText = (time: number, data: string) => `{"time":${time},"data":${data}}`;

function snapshot(file: JwlFile, name: string): Snapshot {
	return { name, time: file.modified, data: file.data };
}

type Bases = { get(id: string): Promise<string | null> };

async function kept(id: string | null, bases: Bases): Promise<Snapshot | null> {
	if (!id) return null;
	const text = await bases.get(id).catch(() => null);
	if (!text) return null;
	try {
		const raw = JSON.parse(text) as { time: number; data: unknown };
		return { name: `base ${id}`, time: raw.time, data: dataFromJson(JSON.stringify(raw.data)) };
	} catch {
		return null;
	}
}

/** The merge result a file started from (its mark) */
const baseOf = (file: JwlFile, bases: Bases) => kept(file.data.marker, bases);

/**
 * Under which a device's last backup is kept: by the name the backup gives (two devices of one name count as
 * one); null for files written here, which are no device's state
 */
function deviceId(file: JwlFile): string | null {
	if (!file.device || file.device === DEVICE_NAME) return null;
	return `device-${bytesToHex(sha256(new TextEncoder().encode(file.device))).slice(0, 24)}`;
}

/**
 * What the incoming backup started from: the merge result its device restored (its mark), or the last backup of
 * that device – the newer of the two; a first backup merged into an older one of the same device starts from that.
 * `adds`: the base is the device's own state, so what the backup still has is added where missing.
 */
async function incomingBase(mine: JwlFile, incoming: JwlFile, bases: Bases): Promise<{ base: Snapshot | null; adds: boolean }> {
	const result = await baseOf(incoming, bases);
	const device = deviceId(incoming);
	let last = await kept(device, bases);
	if (!last && device && deviceId(mine) === device && mine.modified < incoming.modified) last = snapshot(mine, 'earlier backup');
	if (last && (!result || last.time > result.time)) return { base: last, adds: true };
	return { base: result, adds: false };
}

export const merger = {
	async merge(mine: Blob, incoming: Blob, bases: Bases) {
		const [a, b] = await Promise.all([readJwl(mine), readJwl(incoming)]);
		if (a.kind !== 'backup' || b.kind !== 'backup') throw new JwlError('archive', 'not a backup');
		// The incoming backup is what its device has now: the base of that device's next one
		const device = deviceId(b);
		const state = device ? [{ id: device, text: baseText(b.modified, dataToJson(b.data)), lasting: true }] : [];
		const same = { result: mine, counts: { added: 0, changed: 0, removed: 0 }, loss: null, unchanged: true, keep: state, blind: false };
		if (a.hash === b.hash) return same;
		const files = new Map([...a.files, ...b.files]);
		const from = await incomingBase(a, b, bases);
		// The backup names a merge result that isn't here (made on another device, not synced yet): it only adds
		const blind = !!b.data.marker && !from.base;
		const none = { ...same, blind };
		const merged = mergeFiles(snapshot(a, 'mine'), snapshot(b, 'incoming'), { mine: await baseOf(a, bases), incoming: from.base, incomingAdds: from.adds }, files);
		if (sameContent(merged.data, a.data)) return none;
		const lost = loss(a.data, merged.data);
		const id = crypto.randomUUID();
		const time = Date.now();
		// The newer schema's database is the frame of the result
		const template = b.data.schema > a.data.schema ? b.database : a.database;
		const result = await jwlBlob({ kind: 'backup', name: '', deviceName: DEVICE_NAME, data: merged.data, template, files, marker: id });
		return {
			result,
			counts: difference(a.data, merged.data),
			loss: tooMuchLost(lost) ? lost : null,
			unchanged: false,
			blind,
			keep: [{ id, text: baseText(time, dataToJson(merged.data)) }, ...state]
		};
	}
};
