import { describe, expect, it } from 'vitest';
import { jwlBlob, newPlaylist, readJwl } from './jwl-file.js';
import { sameContent } from './merge.js';
import { locKey } from './model.js';
import { doc, sample, template } from './testing.js';

// Writing a backup and reading it back gives the same data and the files byte for byte; the hidden mark in-browser
// wrote into merged backups until 2026-11-26 is dropped.

describe('JW Library files', () => {
	it('reads back what it wrote: data and files, without merge marks', async () => {
		const { data, files } = sample(['n1', 'n2']);
		const mark = { ...doc, document: 1, issue: 0, keySymbol: 'in-browser-merge', language: null, title: 'result-1' };
		data.locations.set(locKey(mark), mark);
		const blob = await jwlBlob({ kind: 'backup', name: '', deviceName: 'test', data, template: await template(), files });
		const read = await readJwl(blob);
		expect(read.kind).toBe('backup');
		expect([...read.data.locations.values()].some((l) => l.keySymbol === 'in-browser-merge')).toBe(false);
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
});
