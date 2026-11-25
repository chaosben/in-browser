import { describe, expect, it } from 'vitest';
import { DEVICE_NAME, jwlBlob, newPlaylist, readJwl } from './jwl-file.js';
import { merger } from './merger.js';
import { sameContent } from './merge.js';
import { locKey } from './model.js';
import { doc, sample, template } from './testing.js';

// Writing a backup and reading it back gives the same data, the merge mark and the files byte for byte; a merge
// through the frame's interface lets a deletion travel – once the device restored the result, or with the next
// backup of a device whose last one is known.

describe('JW Library files', () => {
	it('reads back what it wrote: data, merge mark and files', async () => {
		const { data, files } = sample(['n1', 'n2']);
		const blob = await jwlBlob({ kind: 'backup', name: '', deviceName: 'test', data, template: await template(), files, marker: 'result-1' });
		const read = await readJwl(blob);
		expect(read.kind).toBe('backup');
		expect(read.data.marker).toBe('result-1');
		expect(read.data.warnings).toEqual([]);
		expect(sameContent(read.data, data)).toBe(true);
		expect(read.data.locations.get(locKey(doc))?.title).toBe('Article');
		expect(new Uint8Array(await read.files.get('a'.repeat(64))!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
		expect(read.manifest.userDataBackup?.schemaVersion).toBe(16);
	});

	it('writes a new, empty playlist from JW Library’s schema, named as asked', async () => {
		const read = await readJwl(await newPlaylist('Talk'));
		expect(read.kind).toBe('playlist');
		expect(read.manifest.name).toBe('Talk.jwlplaylist');
		expect([...read.data.tags.values()]).toEqual([{ type: 2, name: 'Talk' }]);
		expect(read.data.schema).toBe(16);
	});

	it('lets a deletion travel once the device restored the merge result', async () => {
		const frame = await template();
		const kept = new Map<string, string>();
		const bases = { get: async (id: string) => kept.get(id) ?? null };
		const file = (notes: string[], marker: string | null) => {
			const { data, files } = sample(notes);
			return jwlBlob({ kind: 'backup', name: '', deviceName: DEVICE_NAME, data, template: frame, files, marker });
		};
		// First merge: the union, kept as a base under its mark
		const first = await merger.merge(await file(['n1', 'n2'], null), await file(['n1', 'n3'], null), bases);
		expect(first.unchanged).toBe(false);
		const mark = first.keep[0].id;
		kept.set(mark, first.keep[0].text);
		const result = await readJwl(first.result);
		expect([...result.data.notes.keys()].sort()).toEqual(['n1', 'n2', 'n3']);
		// The phone restored the result and deleted n2; its next backup carries the result's mark
		const phone = await file(['n1', 'n3'], mark);
		const second = await merger.merge(first.result, phone, bases);
		expect([...(await readJwl(second.result)).data.notes.keys()].sort()).toEqual(['n1', 'n3']);
		expect(second.counts.removed).toBe(1);
		// The same backup once more changes nothing
		kept.set(second.keep[0].id, second.keep[0].text);
		expect((await merger.merge(second.result, second.result, bases)).unchanged).toBe(true);
	});

	it('lets a deletion travel with the next backup of a device that never restored – and only its own', async () => {
		const frame = await template();
		const kept = new Map<string, string>();
		const bases = { get: async (id: string) => kept.get(id) ?? null };
		const keep = (outcome: { keep: { id: string; text: string }[] }) => outcome.keep.forEach((k) => kept.set(k.id, k.text));
		const file = (deviceName: string, notes: string[]) => {
			const { data, files } = sample(notes);
			return jwlBlob({ kind: 'backup', name: '', deviceName, data, template: frame, files, marker: null });
		};
		const notesOf = async (blob: Blob) => [...(await readJwl(blob)).data.notes.keys()].sort();
		// A device's first backup only adds, and is remembered as what that device has
		const first = await merger.merge(await file('tablet', ['n1', 'n3']), await file('phone', ['n1', 'n2']), bases);
		keep(first);
		expect(await notesOf(first.result)).toEqual(['n1', 'n2', 'n3']);
		// The phone deleted n2. It never had n3 (the tablet's), which stays
		const second = await merger.merge(first.result, await file('phone', ['n1']), bases);
		keep(second);
		expect(await notesOf(second.result)).toEqual(['n1', 'n3']);
		// Merged into another file, the phone's backup still brings what it has
		const other = await merger.merge(await file('tablet', ['n3']), await file('phone', ['n1', 'n4']), bases);
		expect(await notesOf(other.result)).toEqual(['n1', 'n3', 'n4']);
	});
});
