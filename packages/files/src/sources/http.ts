import { cacheDir } from '../cache.js';
import { FilesError } from '../entry.js';
import { blockReader } from './blocks.js';
import type { RandomAccess } from './source.js';

// What the HTTP sources (WebDAV, S3) share: requests with a timeout and errors as `FilesError`, files read in blocks
// with range requests, and writing through a temporary file in the OPFS (Firefox and Safari can't stream a request
// body, and a large upload must not sit in memory).

/** A request that gets no answer within this time fails (`offline`) */
const TIMEOUT = 60_000;

/** Turns an answer that isn't a success into a `FilesError` (or an `Error` with what the server said) */
export function statusError(response: Response, path: string): Error {
	switch (response.status) {
		case 401:
		case 403:
			return new FilesError('credentials', path);
		case 404:
		case 410:
			return new FilesError('notFound', path);
		case 405:
		case 409:
		case 412:
			return new FilesError('exists', path);
		case 507:
			return new Error(`Not enough space on the server (${path})`);
		default:
			return new Error(`HTTP ${response.status} ${response.statusText} (${path})`);
	}
}

/**
 * Sends a request. A network error (also a refused CORS check, which looks the same to the page) becomes `offline`;
 * statuses not in `ok` become `statusError`s.
 */
export async function send(url: string, init: RequestInit, path: string, ok: (status: number) => boolean = (s) => s >= 200 && s < 300): Promise<Response> {
	let response: Response;
	try {
		response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(TIMEOUT), credentials: 'omit', cache: 'no-store' });
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') throw e;
		throw new FilesError('offline', path);
	}
	if (!ok(response.status)) {
		// Free the connection
		await response.body?.cancel().catch(() => {});
		throw statusError(response, path);
	}
	return response;
}

/**
 * A file read in blocks with range requests. `etag` (when the server names one) makes a read fail instead of mixing
 * bytes of two versions when the file changes while it is read.
 */
export function rangeReader(info: { size: number; type: string; modified: number; etag?: string | null }, get: (headers: Record<string, string>) => Promise<Response>): RandomAccess {
	return blockReader({
		size: info.size,
		type: info.type,
		modified: info.modified,
		async fetch(start, end) {
			const response = await get({ range: `bytes=${start}-${end - 1}`, ...(info.etag ? { 'if-match': info.etag } : {}) });
			const bytes = new Uint8Array(await response.arrayBuffer());
			// A server that ignores ranges sends the whole file
			return response.status === 206 ? bytes : bytes.subarray(start, end);
		}
	});
}

/**
 * A stream like `FileSystemFileHandle.createWritable()` (also `{ type: 'write', position, data }` chunks) that
 * collects the content in a temporary file and hands it to `upload` when closed; the temporary file goes afterwards.
 */
export async function bufferedWritable(upload: (file: File) => Promise<void>): Promise<WritableStream<FileSystemWriteChunkType>> {
	const folder = await cacheDir('files', 'uploads');
	const name = crypto.randomUUID();
	const handle = await folder.getFileHandle(name, { create: true });
	const temp = await handle.createWritable();
	const cleanup = () => folder.removeEntry(name).catch(() => {});
	return new WritableStream<FileSystemWriteChunkType>({
		write: (chunk) => temp.write(chunk),
		async close() {
			try {
				await temp.close();
				await upload(await handle.getFile());
			} finally {
				await cleanup();
			}
		},
		async abort() {
			await temp.abort().catch(() => {});
			await cleanup();
		}
	});
}

/** A file's info from response headers */
export const headerInfo = (response: Response) => ({
	size: Number(response.headers.get('content-length') ?? 0),
	type: (response.headers.get('content-type') ?? '').split(';')[0],
	modified: Date.parse(response.headers.get('last-modified') ?? '') || 0,
	etag: response.headers.get('etag')
});
