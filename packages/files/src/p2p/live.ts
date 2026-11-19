import { FilesError, type FilesErrorCode } from '../entry.js';
import { RemoteError, type Json } from './rpc.js';

// Live access to the files of another device: one side answers requests on its tree (`serveLive`), the other uses
// them as a source of the shared file system (`liveSource`). Used for folders a device doesn't sync (opened from a
// device that has them) and for guest shares (one folder for a browser outside the group). Nothing here is synced:
// what is written lands on the answering device, whose own sync passes it on.
//
// Data always travels in pieces: reads ask for a byte range (`live.read`), writes go through a session
// (`live.open`, `live.chunk` at a position, `live.close` puts the file in place atomically, `live.abort`).

// The answering side is `live-server.ts`, the asking side `live-client.ts`; this module holds what both use.

/** Upper bound of one piece (reads ask for blocks, writes are cut to this) */
export const PIECE = 1024 * 1024;

export type WireEntry = [name: string, kind: 'f' | 'd', size: number, modified: number];

/** Errors of the shared file system travel as `files:<code>` (devices, guest shares) */
export const wireErrorOf = (code: FilesErrorCode) => new Error(`files:${code}`);

export function wireError(e: unknown): never {
	if (e instanceof FilesError) throw wireErrorOf(e.code);
	throw e;
}

/** The `FilesError` an answer of the other side stands for, `null` for any other error */
export function filesErrorOf(e: unknown, path: string): FilesError | null {
	return e instanceof RemoteError && e.message.startsWith('files:') ? new FilesError(e.message.slice(6) as FilesErrorCode, path) : null;
}

export function liftError(e: unknown, path: string): never {
	throw filesErrorOf(e, path) ?? e;
}

/** One request to the answering side; `upload` goes along as body, read requests come back with `bytes` */
export type LiveCall = (method: string, params: Json, upload?: Uint8Array) => Promise<{ value: Json; bytes?: Uint8Array }>;
