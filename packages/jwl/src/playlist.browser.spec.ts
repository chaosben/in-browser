import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { unzipSync } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import schema from './schema-v16.sql?raw';
import { playlistBlob, playlistThumbnail, type PlaylistItem } from './playlist';

async function picture(color: string, type = 'image/jpeg'): Promise<Blob> {
	const canvas = new OffscreenCanvas(64, 36);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 64, 36);
	return canvas.convertToBlob({ type });
}

const hex = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

describe('JW Library playlists', () => {
	it('writes the files, database and manifest JW Library reads – each content once, items in order', async () => {
		const red = await picture('#f00');
		const blue = await picture('#00f');
		const thumb = await playlistThumbnail(new OffscreenCanvas(64, 36), 64, 36);
		const video = new Blob([new Uint8Array(70_000).map((_, i) => i % 251)], { type: 'video/mp4' });
		const items: PlaylistItem[] = [
			{ label: 'Page 1', media: red, name: 'Talk_1.jpg', kind: 'image', seconds: 4, endAction: 'freeze', thumbnail: thumb },
			{ label: 'Page 2', media: blue, name: 'Talk_2.jpg', kind: 'image', seconds: 7.5, endAction: 'continue', thumbnail: thumb },
			// The same picture again is stored once
			{ label: 'Page 1 again', media: red, name: 'Talk_1.jpg', kind: 'image', seconds: 4, endAction: 'repeat', thumbnail: thumb },
			{ label: 'Clip', media: video, name: 'Clip.mp4', kind: 'video', seconds: 12, endAction: 'stop', thumbnail: thumb }
		];
		const zipped = new Uint8Array(await (await playlistBlob({ name: 'Talk', items })).arrayBuffer());
		const files = unzipSync(zipped);

		// Every entry DEFLATE-compressed (method 8 in the central directory), like JW Library's own files
		const view = new DataView(zipped.buffer);
		const end = zipped.length - 22;
		expect(view.getUint32(end, true)).toBe(0x06054b50);
		const methods: number[] = [];
		for (let i = 0, at = view.getUint32(end + 16, true); i < view.getUint16(end + 10, true); i++) {
			expect(view.getUint32(at, true)).toBe(0x02014b50);
			methods.push(view.getUint16(at + 10, true));
			at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
		}
		expect(methods).toEqual(Object.keys(files).map(() => 8));

		const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
		expect(manifest).toMatchObject({ name: 'Talk.jwlplaylist', version: 1, type: 1 });
		expect(manifest.userDataBackup).toMatchObject({ databaseName: 'userData.db', schemaVersion: 16 });
		expect(manifest.userDataBackup.hash).toBe(hex(files['userData.db']));
		expect(manifest.creationDate).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
		expect(files['default_thumbnail.png']).toBeDefined();

		const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
		const db = new SQL.Database(files['userData.db']);
		const all = (sql: string) => db.exec(sql)[0]?.values ?? [];
		expect(all('PRAGMA user_version')).toEqual([[16]]);
		// A database of its own: no write-ahead log to go with it
		expect(all('PRAGMA journal_mode')).not.toEqual([['wal']]);
		// The schema is JW Library's, unchanged
		const expected = new SQL.Database();
		expected.exec(schema);
		const schemaOf = (d: typeof db) => d.exec('SELECT type, name, sql FROM sqlite_master ORDER BY name')[0].values;
		expect(schemaOf(db)).toEqual(schemaOf(expected));

		expect(all('SELECT TagId, Type, Name FROM Tag')).toEqual([[1, 2, 'Talk']]);
		expect(all('SELECT * FROM PlaylistItemAccuracy')).toEqual([
			[1, 'Accurate'],
			[2, 'NeedsUserVerification']
		]);
		const rows = all(`
			SELECT i.Label, i.EndAction, i.Accuracy, i.StartTrimOffsetTicks, m.DurationTicks, f.FilePath, f.MimeType, f.OriginalFilename, f.Hash, i.ThumbnailFilePath
			FROM TagMap t JOIN PlaylistItem i ON i.PlaylistItemId = t.PlaylistItemId
			JOIN PlaylistItemIndependentMediaMap m ON m.PlaylistItemId = i.PlaylistItemId
			JOIN IndependentMedia f ON f.IndependentMediaId = m.IndependentMediaId
			WHERE t.TagId = 1 ORDER BY t.Position`);
		expect(rows.map((r) => r.slice(0, 5))).toEqual([
			['Page 1', 2, 1, null, 40_000_000],
			['Page 2', 0, 1, null, 75_000_000],
			['Page 1 again', 3, 1, null, 40_000_000],
			['Clip', 1, 1, null, 120_000_000]
		]);
		expect(all('SELECT PlaylistItemId, Position FROM TagMap ORDER BY Position').map(([id, at]) => Number(id) - Number(at))).toEqual([1, 1, 1, 1]);
		expect(rows[0][5]).toBe(rows[2][5]);
		expect(rows.map((r) => r[6])).toEqual(['image/jpeg', 'image/jpeg', 'image/jpeg', 'video/mp4']);
		expect(rows[3][7]).toBe('Clip.mp4');
		// Each file is in the ZIP under its path, its hash the one stored
		for (const r of rows) {
			const path = String(r[5]);
			expect(path).toMatch(/^[0-9a-f-]{36}\.(jpg|mp4)$/);
			expect(hex(files[path])).toBe(r[8]);
			expect(files[String(r[9])]).toBeDefined();
		}
		// Two pictures, a video and one thumbnail (the same for all), each once
		expect(all('SELECT COUNT(*) FROM IndependentMedia')).toEqual([[4]]);
		expect(Object.keys(files)).toHaveLength(4 + 3);
		expect(all('SELECT LastModified FROM LastModified')[0][0]).toBe(manifest.userDataBackup.lastModifiedDate.replace('+00:00', 'Z'));
		db.close();
		expected.close();
	});
});
