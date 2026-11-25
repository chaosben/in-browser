import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import schema from './schema-v16.sql?raw';
import { jwlBlob, newPlaylist, readJwl } from './jwl-file.js';
import { merger } from './merger.js';
import { sameContent } from './merge.js';
import { emptyData, locKey, noteTarget, playlistKey, playlistTarget, tagKey, type JwlData, type Location } from './model.js';

// Writing a backup and reading it back gives the same data, the merge mark and the files byte for byte; a merge
// through the frame's interface lets a deletion travel once the device restored the result.

async function template(): Promise<Uint8Array> {
	const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
	const db = new SQL.Database();
	const triggers = schema.indexOf('CREATE TRIGGER');
	db.exec(schema.slice(0, triggers));
	db.run('INSERT INTO LastModified (LastModified) VALUES (?)', ['2026-01-01T00:00:00Z']);
	db.exec(schema.slice(triggers));
	db.exec('PRAGMA user_version = 16');
	db.run(`INSERT INTO PlaylistItemAccuracy (PlaylistItemAccuracyId, Description) VALUES (1, 'Accurate'), (2, 'NeedsUserVerification')`);
	const bytes = db.export();
	db.close();
	return bytes;
}

const doc: Location = { book: null, chapter: null, document: 7, track: null, issue: 20260100, keySymbol: 'w', language: 2, type: 0, title: 'Article', specialty: null, edition: null };
const verse: Location = { book: 43, chapter: 3, document: null, track: null, issue: 0, keySymbol: 'nwtsty', language: 2, type: 0, title: null, specialty: null, edition: null };

function sample(notes: string[]): { data: JwlData; files: Map<string, Blob> } {
	const data = emptyData();
	for (const l of [doc, verse]) data.locations.set(locKey(l), l);
	data.marks.set('m1', { guid: 'm1', loc: locKey(verse), color: 1, style: 0, version: 1, ranges: [{ blockType: 2, identifier: 16, start: 0, end: 12 }] });
	for (const guid of notes)
		data.notes.set(guid, { guid, mark: guid === 'n1' ? 'm1' : null, loc: locKey(verse), title: `Note ${guid}`, content: 'Text', modified: '2026-01-02T00:00:00Z', created: '2026-01-02T00:00:00Z', blockType: 2, blockId: 16 });
	const tag = { type: 1, name: 'Study' };
	data.tags.set(tagKey(tag), tag);
	data.tagMaps.push({ tag: tagKey(tag), target: noteTarget(notes[0]), position: 0 });
	const picture = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' });
	const hash = 'a'.repeat(64);
	data.media.set(hash, { name: 'Picture.jpg', path: 'picture.jpg', mime: 'image/jpeg', hash });
	const item = { label: 'Picture', startTrim: null, endTrim: null, accuracy: 1, endAction: 2, thumbnail: null, locations: [], media: [{ hash, ticks: 40_000_000 }], markers: [] };
	const key = playlistKey(item, data.playlists);
	data.playlists.set(key, item);
	const list = { type: 2, name: 'Talk' };
	data.tags.set(tagKey(list), list);
	data.tagMaps.push({ tag: tagKey(list), target: playlistTarget(key), position: 0 });
	return { data, files: new Map([[hash, picture]]) };
}

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
			return jwlBlob({ kind: 'backup', name: '', deviceName: 'phone', data, template: frame, files, marker });
		};
		// First merge: the union, kept as a base under its mark
		const first = await merger.merge(await file(['n1', 'n2'], null), await file(['n1', 'n3'], null), bases);
		expect(first.unchanged).toBe(false);
		kept.set(first.keep!.id, first.keep!.text);
		const result = await readJwl(first.result);
		expect([...result.data.notes.keys()].sort()).toEqual(['n1', 'n2', 'n3']);
		// The phone restored the result and deleted n2; its next backup carries the result's mark
		const phone = await file(['n1', 'n3'], first.keep!.id);
		const second = await merger.merge(first.result, phone, bases);
		expect([...(await readJwl(second.result)).data.notes.keys()].sort()).toEqual(['n1', 'n3']);
		expect(second.counts.removed).toBe(1);
		// The same backup once more changes nothing
		kept.set(second.keep!.id, second.keep!.text);
		expect((await merger.merge(second.result, second.result, bases)).unchanged).toBe(true);
	});
});
