// Fixtures of the browser specs that write real files: an empty database with JW Library's schema, and a small
// backup's data with its files.

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import schema from './schema-v16.sql?raw';
import { emptyData, locKey, noteTarget, playlistKey, playlistTarget, tagKey, type JwlData, type Location } from './model.js';

export async function template(): Promise<Uint8Array> {
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

export const doc: Location = { book: null, chapter: null, document: 7, track: null, issue: 20260100, keySymbol: 'w', language: 2, type: 0, title: 'Article', specialty: null, edition: null };
const verse: Location = { book: 43, chapter: 3, document: null, track: null, issue: 0, keySymbol: 'nwtsty', language: 2, type: 0, title: null, specialty: null, edition: null };

export function sample(notes: string[], items: string[] = ['Picture']): { data: JwlData; files: Map<string, Blob> } {
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
	const keys = items.map((label) => {
		const item = { label, startTrim: null, endTrim: null, accuracy: 1, endAction: 2, thumbnail: null, locations: [], media: [{ hash, ticks: 40_000_000 }], markers: [] };
		const key = playlistKey(item, data.playlists);
		data.playlists.set(key, item);
		return key;
	});
	const list = { type: 2, name: 'Talk' };
	data.tags.set(tagKey(list), list);
	keys.forEach((key, position) => data.tagMaps.push({ tag: tagKey(list), target: playlistTarget(key), position }));
	return { data, files: new Map([[hash, picture]]) };
}
