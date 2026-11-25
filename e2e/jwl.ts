import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { zipSync } from 'fflate';
import { createHash } from 'node:crypto';

// JW Library backups for the E2E tests: JW Library's schema with a few notes, zipped with a manifest like the app's.

export async function backup(notes: { guid: string; title: string }[], device = 'Phone'): Promise<Buffer> {
	const SQL = await initSqlJs();
	const db = new SQL.Database();
	const schema = readFileSync('packages/jwl/src/schema-v16.sql', 'utf8');
	const triggers = schema.indexOf('CREATE TRIGGER');
	db.exec(schema.slice(0, triggers));
	db.run('INSERT INTO LastModified (LastModified) VALUES (?)', ['2026-01-02T00:00:00Z']);
	db.exec(schema.slice(triggers));
	db.exec('PRAGMA user_version = 16');
	db.run(`INSERT INTO PlaylistItemAccuracy (PlaylistItemAccuracyId, Description) VALUES (1, 'Accurate'), (2, 'NeedsUserVerification')`);
	db.run("INSERT INTO Location (LocationId, BookNumber, ChapterNumber, KeySymbol, MepsLanguage, Type) VALUES (1, 43, 3, 'nwtsty', 2, 0)");
	notes.forEach((n, i) =>
		db.run('INSERT INTO Note (NoteId, Guid, LocationId, Title, Content, LastModified, Created, BlockType) VALUES (?, ?, 1, ?, ?, ?, ?, 0)', [
			i + 1,
			n.guid,
			n.title,
			`Text of ${n.title}`,
			'2026-01-02T00:00:00Z',
			'2026-01-02T00:00:00Z'
		])
	);
	const database = db.export();
	db.close();
	const manifest = {
		name: `UserdataBackup_2026-01-02_${device}.jwlibrary`,
		creationDate: '2026-01-02T10:00:00.000+01:00',
		version: 1,
		type: 0,
		userDataBackup: {
			lastModifiedDate: '2026-01-02T09:00:00+00:00',
			deviceName: device,
			databaseName: 'userData.db',
			hash: createHash('sha256').update(database).digest('hex'),
			schemaVersion: 16
		}
	};
	return Buffer.from(zipSync({ 'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)), 'userData.db': database }));
}
