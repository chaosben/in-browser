// The merger of `.jwlibrary` backups for the suite's merge frame (`@in-browser/files/merge.js`): it reads both files,
// finds the merge results they started from (kept by the frame, named by the mark in each file), merges and writes
// the result with a new mark – kept for the next merge.

import { DEVICE_NAME, JwlError, jwlBlob, readJwl, type JwlFile } from './jwl-file.js';
import { difference, loss, mergeFiles, sameContent, tooMuchLost, type Snapshot } from './merge.js';
import { dataFromJson, dataToJson } from './model.js';

/** What the frame keeps of a merge result: when it was written and its data */
const baseText = (time: number, data: string) => `{"time":${time},"data":${data}}`;

function snapshot(file: JwlFile, name: string): Snapshot {
	return { name, time: file.modified, data: file.data };
}

async function baseOf(file: JwlFile, bases: { get(id: string): Promise<string | null> }): Promise<Snapshot | null> {
	if (!file.data.marker) return null;
	const text = await bases.get(file.data.marker).catch(() => null);
	if (!text) return null;
	try {
		const raw = JSON.parse(text) as { time: number; data: unknown };
		return { name: `base ${file.data.marker}`, time: raw.time, data: dataFromJson(JSON.stringify(raw.data)) };
	} catch {
		return null;
	}
}

export const merger = {
	async merge(mine: Blob, incoming: Blob, bases: { get(id: string): Promise<string | null> }) {
		const [a, b] = await Promise.all([readJwl(mine), readJwl(incoming)]);
		if (a.kind !== 'backup' || b.kind !== 'backup') throw new JwlError('archive', 'not a backup');
		const none = { result: mine, counts: { added: 0, changed: 0, removed: 0 }, loss: null, unchanged: true, keep: null };
		if (a.hash === b.hash) return none;
		const files = new Map([...a.files, ...b.files]);
		const merged = mergeFiles(snapshot(a, 'mine'), snapshot(b, 'incoming'), { mine: await baseOf(a, bases), incoming: await baseOf(b, bases) }, files);
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
			keep: { id, text: baseText(time, dataToJson(merged.data)) }
		};
	}
};
