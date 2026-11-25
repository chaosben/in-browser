import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import initSqlJs from 'sql.js';
import { afterAll, describe, expect, it } from 'vitest';
import { foldWal } from './wal.js';

// JW Library packed a backup whose newest changes were only in `userData.db-wal` (seen on Android): folding the log
// in must give every committed row – and leave out a transaction that was never finished.

const dir = mkdtempSync(join(tmpdir(), 'wal-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('write-ahead log', () => {
	it('folds committed transactions into the database and leaves out a torn one', async () => {
		const path = join(dir, 'userData.db');
		const db = new DatabaseSync(path);
		db.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE Note (Title TEXT)');
		db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
		// Only in the log from here on: enough rows to grow the file by pages
		const insert = db.prepare('INSERT INTO Note (Title) VALUES (?)');
		db.exec('BEGIN');
		for (let i = 0; i < 500; i++) insert.run(`Note ${i} ${'x'.repeat(40)}`);
		db.exec('COMMIT');
		db.exec("UPDATE Note SET Title = 'first' WHERE rowid = 1");
		// Read while open, as a backup packs them (closing would checkpoint)
		const database = new Uint8Array(readFileSync(path));
		const wal = new Uint8Array(readFileSync(`${path}-wal`));
		db.close();
		expect(wal.length).toBeGreaterThan(32);

		const SQL = await initSqlJs();
		const count = (bytes: Uint8Array) => {
			const read = new SQL.Database(bytes);
			try {
				return [read.exec('SELECT count(*) FROM Note')[0].values[0][0], read.exec('SELECT Title FROM Note WHERE rowid = 1')[0]?.values[0][0]];
			} finally {
				read.close();
			}
		};
		expect(count(foldWal(database, wal))).toEqual([500, 'first']);
		// The last transaction cut off in the middle of its frame: the one before it holds
		const frame = 24 + 4096;
		expect(count(foldWal(database, wal.subarray(0, wal.length - frame / 2)))[0]).toBe(500);
		expect(count(foldWal(database, wal.subarray(0, wal.length - frame / 2)))[1]).not.toBe('first');
	});
});
