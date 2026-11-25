// Reading and writing JW Library's files – backups (`.jwlibrary`) and playlists (`.jwlplaylist`), the same archive
// with the same database – as the id-free model of `model.ts`. The work is done in `jwl-file.worker.ts` (SQLite is
// WebAssembly, which pages may not compile); writing streams the ZIP out piece by piece.

import { BRAND } from '@in-browser/brand/brand.js';
import { TAG_PLAYLIST, copyData, emptyData, tagKey, type JwlData } from './model.js';

export interface JwlManifest {
	name: string;
	creationDate: string;
	version: number;
	/** 0 backup, 1 playlist */
	type: number;
	userDataBackup?: {
		lastModifiedDate?: string;
		deviceName?: string;
		databaseName?: string;
		hash?: string;
		schemaVersion?: number;
	};
}

export type JwlKind = 'backup' | 'playlist';

/** What the worker reads from a file */
export interface ReadResult {
	manifest: JwlManifest;
	data: JwlData;
	/** The archive's files (pictures, videos, thumbnails) by their hash */
	files: Map<string, Blob>;
	/** The database as it is in the file – what a written file starts from */
	database: Uint8Array;
	/** SHA-256 of the database (the manifest's own isn't trusted) */
	hash: string;
}

export interface JwlFile extends ReadResult {
	kind: JwlKind;
	/** When it was last changed (the manifest's time, else the database's), ms */
	modified: number;
	device: string;
}

export interface WriteJob {
	kind: JwlKind;
	/** A playlist's name (the manifest names a backup after its date and device) */
	name: string;
	deviceName: string;
	data: JwlData;
	/** A database JW Library made (`JwlFile.database`): schema, triggers and metadata come from it; null for a new
	 * file (JW Library's schema 16) */
	template: Uint8Array | null;
	files: Map<string, Blob>;
	/** Id of a merge result, kept in the file (`MARKER_KEY`) */
	marker: string | null;
}

export type FileRequest = { type: 'read'; file: Blob } | { type: 'write'; job: WriteJob } | { type: 'ack' };
export type FileReply =
	| { type: 'read'; result: ReadResult }
	| { type: 'chunk'; data: Uint8Array }
	| { type: 'progress'; done: number; total: number }
	| { type: 'done' }
	| { type: 'error'; message: string; reason: 'schema' | 'database' | 'archive' | null };

/** A file this version can't read: no JW Library archive, a database it doesn't know, a newer schema */
export class JwlError extends Error {
	constructor(
		readonly reason: 'schema' | 'database' | 'archive',
		message: string
	) {
		super(message);
	}
}

function run<T>(request: FileRequest, onreply: (reply: FileReply, worker: Worker) => Promise<T | undefined> | T | undefined, signal?: AbortSignal): Promise<T> {
	const worker = new Worker(new URL('./jwl-file.worker.ts', import.meta.url), { type: 'module' });
	return new Promise<T>((resolve, reject) => {
		const abort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
		if (signal?.aborted) return abort();
		signal?.addEventListener('abort', abort, { once: true });
		worker.onerror = (e) => reject(new Error(e.message || 'The JW Library worker failed'));
		worker.onmessage = async ({ data: reply }: MessageEvent<FileReply>) => {
			try {
				if (reply.type === 'error') reject(reply.reason ? new JwlError(reply.reason, reply.message) : new Error(reply.message));
				else {
					const value = await onreply(reply, worker);
					if (value !== undefined) resolve(value);
				}
			} catch (error) {
				reject(error);
			}
		};
		worker.postMessage(request);
	}).finally(() => worker.terminate());
}

/** Reads a backup or playlist */
export async function readJwl(file: Blob, signal?: AbortSignal): Promise<JwlFile> {
	const result = await run<ReadResult>({ type: 'read', file }, (reply) => (reply.type === 'read' ? reply.result : undefined), signal);
	const stamp = Date.parse(result.manifest.userDataBackup?.lastModifiedDate ?? '') || Date.parse(result.manifest.creationDate ?? '');
	return {
		...result,
		kind: result.manifest.type === 1 ? 'playlist' : 'backup',
		modified: Number.isNaN(stamp) ? (file instanceof File ? file.lastModified : Date.now()) : stamp,
		device: result.manifest.userDataBackup?.deviceName ?? ''
	};
}

export interface WriteOptions {
	signal?: AbortSignal;
	onprogress?: (done: number, total: number) => void;
}

/** Writes a file into `out` (closed when done, aborted on errors) */
export async function writeJwl(job: WriteJob, out: WritableStream<Uint8Array> | WritableStream<FileSystemWriteChunkType>, { signal, onprogress }: WriteOptions = {}): Promise<void> {
	const writer = (out as WritableStream<Uint8Array>).getWriter();
	try {
		await run<true>(
			{ type: 'write', job: { ...job, data: usedMedia(job.data, job.files) } },
			async (reply, worker) => {
				if (reply.type === 'chunk') {
					await writer.write(reply.data);
					worker.postMessage({ type: 'ack' } satisfies FileRequest);
				} else if (reply.type === 'progress') onprogress?.(reply.done, reply.total);
				else if (reply.type === 'done') return true;
			},
			signal
		);
		await writer.close();
	} catch (error) {
		await writer.abort(error).catch(() => {});
		throw error;
	}
}

/** `writeJwl` into memory */
export async function jwlBlob(job: WriteJob, options: WriteOptions = {}): Promise<Blob> {
	const parts: Uint8Array[] = [];
	await writeJwl(job, new WritableStream<Uint8Array>({ write: (chunk) => void parts.push(chunk) }), options);
	return new Blob(parts as BlobPart[], { type: 'application/octet-stream' });
}

/** The suite's name as the device that wrote a file */
export const DEVICE_NAME = BRAND.suite;

/**
 * Only the files the playlist items show and that are at hand: an item's reference to a missing file is dropped,
 * a file nothing shows is left out.
 */
export function usedMedia(data: JwlData, files: { has(hash: string): boolean }): JwlData {
	const out = copyData(data);
	out.media = new Map();
	for (const [key, item] of data.playlists) {
		const thumbnail = item.thumbnail && files.has(item.thumbnail) && data.media.has(item.thumbnail) ? item.thumbnail : null;
		const media = item.media.filter((m) => files.has(m.hash) && data.media.has(m.hash));
		out.playlists.set(key, { ...item, thumbnail, media });
		if (thumbnail) out.media.set(thumbnail, data.media.get(thumbnail)!);
		for (const m of media) out.media.set(m.hash, data.media.get(m.hash)!);
	}
	return out;
}

/** A new, empty playlist file named `name` */
export function newPlaylist(name: string): Promise<Blob> {
	const data = emptyData();
	const tag = { type: TAG_PLAYLIST, name: name.trim() || 'Playlist' };
	data.tags.set(tagKey(tag), tag);
	return jwlBlob({ kind: 'playlist', name: tag.name, deviceName: DEVICE_NAME, data, template: null, files: new Map(), marker: null });
}
