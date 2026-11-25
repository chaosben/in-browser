// Reads and writes `.jwlibrary` backups and `.jwlplaylist` files (see jwl-file.ts): unzips, reads the database with
// sql.js into the id-free model, and writes a model into a copy of a database JW Library made, streaming the ZIP back
// to the page piece by piece.

import initSqlJs, { type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import schema from './schema-v16.sql?raw';
import { ZipOut, defaultThumbnail, localIso, unzipBlob } from './archive.js';
import { JwlFormatError, readData, verify, writeData } from './database.js';
import type { FileReply, FileRequest, JwlManifest, ReadResult, WriteJob } from './jwl-file.js';
import { foldWal } from './wal.js';

const DATABASE = 'userData.db';

let sql: Promise<SqlJsStatic> | null = null;
const engine = () => (sql ??= initSqlJs({ locateFile: () => sqlWasmUrl }));

function post(reply: FileReply, transfer: Transferable[] = []) {
	self.postMessage(reply, { transfer });
}

let acknowledged: (() => void) | null = null;

self.onmessage = ({ data }: MessageEvent<FileRequest>) => {
	if (data.type === 'ack') {
		acknowledged?.();
		acknowledged = null;
		return;
	}
	const work = data.type === 'read' ? read(data.file).then((result) => post({ type: 'read', result })) : write(data.job).then(() => post({ type: 'done' }));
	work.catch((error: unknown) =>
		post({ type: 'error', message: error instanceof Error ? error.message : String(error), reason: error instanceof JwlFormatError ? error.reason : null })
	);
};

async function read(file: Blob): Promise<ReadResult> {
	let entries: Map<string, Blob>;
	try {
		entries = await unzipBlob(file);
	} catch (error) {
		throw new JwlFormatError('archive', error instanceof Error ? error.message : String(error));
	}
	const manifestEntry = entries.get('manifest.json');
	if (!manifestEntry) throw new JwlFormatError('archive', 'no manifest.json');
	let manifest: JwlManifest;
	try {
		manifest = JSON.parse(await manifestEntry.text());
	} catch {
		throw new JwlFormatError('archive', 'manifest.json is no JSON');
	}
	const name = manifest.userDataBackup?.databaseName || DATABASE;
	const database = entries.get(name);
	if (!database) throw new JwlFormatError('archive', `no ${name}`);
	// Changes JW Library had only in its write-ahead log yet are folded in first (as a checkpoint would)
	const wal = entries.get(`${name}-wal`);
	let bytes = new Uint8Array(await database.arrayBuffer());
	if (wal && wal.size > 0) bytes = foldWal(bytes, new Uint8Array(await wal.arrayBuffer()));
	const SQL = await engine();
	let db;
	try {
		db = new SQL.Database(bytes);
	} catch (error) {
		throw new JwlFormatError('database', error instanceof Error ? error.message : String(error));
	}
	try {
		const data = readData(db);
		const files = new Map<string, Blob>();
		for (const m of data.media.values()) {
			const blob = entries.get(m.path);
			if (blob) files.set(m.hash, blob.type ? blob : new Blob([blob], { type: m.mime }));
			else data.warnings.push(`file ${m.path} missing`);
		}
		return { manifest, data, files, database: bytes, hash: bytesToHex(sha256(bytes)) };
	} finally {
		db.close();
	}
}

async function write(job: WriteJob) {
	const now = new Date();
	const SQL = await engine();
	const db = job.template ? new SQL.Database(job.template) : emptyDatabase(SQL);
	let database: Uint8Array;
	let paths: Map<string, string>;
	try {
		paths = writeData(db, job.data, { marker: job.marker, modified: now.getTime() });
		verify(db);
		database = db.export();
	} finally {
		db.close();
	}
	const utc = now.toISOString().replace(/\.\d+Z$/, '');
	const ext = job.kind === 'playlist' ? '.jwlplaylist' : '.jwlibrary';
	const manifest: JwlManifest = {
		name: job.kind === 'playlist' ? `${job.name}${ext}` : `UserdataBackup_${utc.slice(0, 10)}_${job.deviceName}${ext}`,
		creationDate: localIso(now),
		version: 1,
		type: job.kind === 'playlist' ? 1 : 0,
		userDataBackup: {
			lastModifiedDate: `${utc}+00:00`,
			deviceName: job.deviceName,
			databaseName: DATABASE,
			hash: bytesToHex(sha256(database)),
			schemaVersion: job.data.schema
		}
	};
	const total = [...paths.keys()].reduce((sum, hash) => sum + (job.files.get(hash)?.size ?? 0), 0);
	let done = 0;
	const zip = new ZipOut(async (data) => {
		const sent = new Promise<void>((resolve) => (acknowledged = resolve));
		post({ type: 'chunk', data }, [data.buffer]);
		await sent;
	}, now);
	await zip.whole('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)));
	for (const [hash, path] of paths) {
		const blob = job.files.get(hash);
		if (!blob) throw new Error(`file missing: ${path}`);
		await zip.stream(path, blob, (bytes) => {
			done += bytes;
			post({ type: 'progress', done, total });
		});
	}
	await zip.whole('default_thumbnail.png', await defaultThumbnail());
	await zip.whole(DATABASE, database);
	await zip.end();
}

/** A database as JW Library makes it, without data (a new file): its whole schema, `LastModified` set before the
 * triggers that forbid inserting into it */
function emptyDatabase(SQL: SqlJsStatic) {
	const db = new SQL.Database();
	const triggers = schema.indexOf('CREATE TRIGGER');
	db.exec(schema.slice(0, triggers));
	db.run('INSERT INTO LastModified (LastModified) VALUES (?)', [new Date().toISOString().replace(/\.\d+Z$/, 'Z')]);
	db.exec(schema.slice(triggers));
	db.exec('PRAGMA user_version = 16');
	db.run(`INSERT INTO PlaylistItemAccuracy (PlaylistItemAccuracyId, Description) VALUES (1, 'Accurate'), (2, 'NeedsUserVerification')`);
	return db;
}
