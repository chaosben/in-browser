import type { Entry } from '../entry.js';
import type { TrashRef } from '../trash.js';

export type { TrashRef } from '../trash.js';

// A connected source: storage outside My files that is opened live (nothing is copied into the browser). fs.ts routes
// every path under `/:c/<id>` to the source of that connection, so tools use it like any other path. Paths given to
// a source are inside it (`/` = its root); entries come back with such paths too.
//
// Built: a folder on disk (`folder.ts`). Foreseen: own devices on demand, guest shares, WebDAV – each may be slow or
// gone, so every method may throw `FilesError` `offline` or `denied`.

/** A file read in pieces: only what is asked for is read (or fetched, for remote sources) */
export interface RandomAccess {
	size: number;
	/** MIME type, `''` if unknown */
	type: string;
	modified: number;
	/** Bytes `start` (inclusive) to `end` (exclusive), `0 <= start <= end <= size` */
	read(start: number, end: number): Promise<Uint8Array>;
}

export interface SourceCaps {
	/** Only reading is possible */
	readOnly: boolean;
	/** Deleting moves into a trash of the source; otherwise deleting is for good (and asked first) */
	trash: boolean;
}

export interface Source {
	readonly caps: SourceCaps;
	/** Entries of a folder (unsorted), including hidden ones */
	list(path: string): Promise<Entry[]>;
	/** File or folder, `null` if there is none */
	stat(path: string): Promise<Entry | null>;
	read(path: string): Promise<File>;
	/** Reads in pieces (remote sources fetch only those); without it the file from `read` is sliced */
	open?(path: string): Promise<RandomAccess>;
	/** Replaces the file's content when the stream closes (the parent folder exists) */
	writable(path: string): Promise<WritableStream<FileSystemWriteChunkType>>;
	/** Creates one folder (its parent exists) */
	mkdir(path: string): Promise<void>;
	/** Deletes a file or folder with everything in it (no error if it doesn't exist) */
	remove(path: string): Promise<void>;
	/** Moves or renames inside the source (also in upper/lower case only); `to` doesn't exist, its parent does */
	move(from: string, to: string): Promise<void>;
	/** Sources with `caps.trash`: moves into the trash where the item lives; the entry to undo it */
	trash?(path: string): Promise<TrashRef>;
	/** Puts an item back (under a free name if that is taken now) */
	untrash?(ref: TrashRef): Promise<void>;
}

