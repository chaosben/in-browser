// Builds a `.jwlplaylist` (see playlist.ts): hashes the media, writes JW Library's database with sql.js and streams
// the ZIP (fflate, DEFLATE like JW Library's own files) back to the page piece by piece.

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { Zip, ZipDeflate } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import schema from './schema-v16.sql?raw';
import { END_ACTIONS, type Playlist, type PlaylistReply, type PlaylistRequest } from './playlist.js';

const SCHEMA_VERSION = 16;
const TICKS_PER_SECOND = 10_000_000;
const DATABASE = 'userData.db';

/** Extensions JW Library's files use, by MIME type */
const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/bmp': 'bmp',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm',
	'audio/mpeg': 'mp3',
	'audio/mp4': 'm4a'
};

function post(reply: PlaylistReply, transfer: Transferable[] = []) {
	self.postMessage(reply, { transfer });
}

let acknowledged: (() => void) | null = null;

self.onmessage = ({ data }: MessageEvent<PlaylistRequest>) => {
	if (data.type === 'ack') {
		acknowledged?.();
		acknowledged = null;
	} else
		build(data.playlist, data.deviceName).then(
			() => post({ type: 'done' }),
			(error: unknown) => post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
		);
};

/** A file of the playlist: each distinct content once (JW Library keys them by hash) */
interface Media {
	id: number;
	blob: Blob;
	path: string;
	original: string;
	mime: string;
	hash: string;
}

async function build(playlist: Playlist, deviceName: string) {
	// Read twice: once for the hashes (media and thumbnails), once into the ZIP (media)
	const total = playlist.items.reduce((sum, item) => sum + 2 * item.media.size + item.thumbnail.size, 0);
	let done = 0;
	const progress = (bytes: number) => {
		done += bytes;
		post({ type: 'progress', done, total });
	};

	// 1. Hash every file in pieces – a video never has to fit in memory
	const media: Media[] = [];
	const byHash = new Map<string, Media>();
	const add = async (blob: Blob, mime: string, extension: string | null, original: (path: string) => string) => {
		const hash = await hashOf(blob, progress);
		const key = `${hash} ${mime}`;
		const known = byHash.get(key);
		if (known) return known;
		const path = extension ? `${crypto.randomUUID()}.${extension}` : crypto.randomUUID();
		const entry: Media = { id: media.length + 1, blob, path, original: original(path), mime, hash };
		media.push(entry);
		byHash.set(key, entry);
		return entry;
	};
	const rows: { label: string; media: Media; thumbnail: Media; ticks: number; endAction: number }[] = [];
	for (const item of playlist.items) {
		const mime = item.media.type || mimeOf(item.name);
		const extension = EXTENSIONS[mime] ?? item.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? null;
		const file = await add(item.media, mime, extension, (path) => item.name || path);
		// Thumbnails have no extension, as JW Library names them
		const thumbnail = await add(item.thumbnail, 'image/jpeg', null, () => crypto.randomUUID());
		rows.push({
			label: item.label.trim() || item.name || file.path,
			media: file,
			thumbnail,
			ticks: Math.max(0, Math.round(item.seconds * TICKS_PER_SECOND)),
			endAction: Math.max(0, END_ACTIONS.indexOf(item.endAction))
		});
	}

	// 2. The database
	const now = new Date();
	const utc = now.toISOString().replace(/\.\d+Z$/, '');
	const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
	const db = new SQL.Database();
	let database: Uint8Array;
	try {
		// `LastModified` takes its one row before the triggers that forbid inserting into it
		const triggers = schema.indexOf('CREATE TRIGGER');
		db.exec(schema.slice(0, triggers));
		db.run('INSERT INTO LastModified (LastModified) VALUES (?)', [`${utc}Z`]);
		db.exec(schema.slice(triggers));
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
		db.exec('BEGIN');
		db.run(`INSERT INTO PlaylistItemAccuracy (PlaylistItemAccuracyId, Description) VALUES (1, 'Accurate'), (2, 'NeedsUserVerification')`);
		db.run('INSERT INTO Tag (TagId, Type, Name) VALUES (1, 2, ?)', [playlist.name.trim() || 'Playlist']);
		for (const m of media)
			db.run('INSERT INTO IndependentMedia (IndependentMediaId, OriginalFilename, FilePath, MimeType, Hash) VALUES (?, ?, ?, ?, ?)', [
				m.id,
				m.original,
				m.path,
				m.mime,
				m.hash
			]);
		rows.forEach((row, i) => {
			const id = i + 1;
			db.run(
				'INSERT INTO PlaylistItem (PlaylistItemId, Label, StartTrimOffsetTicks, EndTrimOffsetTicks, Accuracy, EndAction, ThumbnailFilePath) VALUES (?, ?, NULL, NULL, 1, ?, ?)',
				[id, row.label, row.endAction, row.thumbnail.path]
			);
			db.run('INSERT INTO PlaylistItemIndependentMediaMap (PlaylistItemId, IndependentMediaId, DurationTicks) VALUES (?, ?, ?)', [id, row.media.id, row.ticks]);
			db.run('INSERT INTO TagMap (TagMapId, PlaylistItemId, LocationId, NoteId, TagId, Position) VALUES (?, ?, NULL, NULL, 1, ?)', [id, id, i]);
		});
		// The triggers stamped the inserts with SQLite's clock; the manifest names the same moment
		db.run('UPDATE LastModified SET LastModified = ?', [`${utc}Z`]);
		db.exec('COMMIT');
		db.exec('VACUUM');
		database = db.export();
	} finally {
		db.close();
	}

	// 3. The ZIP, in the order JW Library writes it
	const manifest = {
		name: `${playlist.name.trim() || 'Playlist'}.jwlplaylist`,
		creationDate: localIso(now),
		version: 1,
		type: 1,
		userDataBackup: {
			lastModifiedDate: `${utc}+00:00`,
			deviceName,
			databaseName: DATABASE,
			hash: bytesToHex(sha256(database)),
			schemaVersion: SCHEMA_VERSION
		}
	};
	const out: Uint8Array[] = [];
	let failure: Error | null = null;
	const zip = new Zip((error, chunk) => {
		if (error) failure = error;
		else out.push(chunk);
	});
	const flush = async () => {
		if (failure) throw failure;
		for (const chunk of out.splice(0)) {
			const sent = new Promise<void>((resolve) => (acknowledged = resolve));
			// A copy of its own: fflate's pieces may be views into a buffer it keeps using
			const data = chunk.slice();
			post({ type: 'chunk', data }, [data.buffer]);
			await sent;
		}
	};
	const entry = (name: string, level: 1 | 6) => {
		const file = new ZipDeflate(name, { level });
		file.mtime = now;
		zip.add(file);
		return file;
	};
	const whole = async (name: string, data: Uint8Array) => {
		const file = entry(name, 6);
		file.push(data, true);
		await flush();
	};
	await whole('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)));
	for (const m of media) {
		// Already compressed pictures and videos: the fastest level, still DEFLATE as JW Library's files are
		const file = entry(m.path, 1);
		// One piece ahead, so the last one is pushed as the file's end
		const reader = m.blob.stream().getReader();
		let next = await reader.read();
		if (next.done) file.push(new Uint8Array(0), true);
		while (!next.done) {
			const piece = next.value;
			next = await reader.read();
			file.push(piece, next.done);
			progress(piece.byteLength);
			await flush();
		}
		await flush();
	}
	await whole('default_thumbnail.png', await defaultThumbnail());
	await whole(DATABASE, database);
	zip.end();
	await flush();
	// Files shown more than once were written once
	if (done < total) progress(total - done);
}

/** SHA-256 of a file as JW Library stores it (lowercase hex), read in pieces */
async function hashOf(blob: Blob, progress: (bytes: number) => void): Promise<string> {
	const hash = sha256.create();
	const reader = blob.stream().getReader();
	for (let next = await reader.read(); !next.done; next = await reader.read()) {
		hash.update(next.value);
		progress(next.value.byteLength);
	}
	return bytesToHex(hash.digest());
}

function mimeOf(name: string): string {
	const extension = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
	const found = Object.entries(EXTENSIONS).find(([, e]) => e === extension || (e === 'jpg' && extension === 'jpeg'));
	return found?.[0] ?? 'application/octet-stream';
}

/** `2026-11-23T02:15:47.045+01:00` – local time with its offset, as JW Library writes `creationDate` */
function localIso(date: Date): string {
	const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');
	const offset = -date.getTimezoneOffset();
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:` +
		`${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${offset < 0 ? '-' : '+'}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
	);
}

/** The plain grey picture JW Library falls back to where an item has no thumbnail */
async function defaultThumbnail(): Promise<Uint8Array> {
	const canvas = new OffscreenCanvas(128, 128);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No canvas');
	ctx.fillStyle = '#d4d4d4';
	ctx.fillRect(0, 0, 128, 128);
	return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}
