import type { Entry } from '../entry.js';

// A connected source: storage outside My files that is opened live (nothing is copied into the browser). fs.ts routes
// every path under `/:c/<id>` to the source of that connection, so tools use it like any other path. Paths given to
// a source are inside it (`/` = its root); entries come back with such paths too.
//
// Built: a folder on disk (`folder.ts`). Foreseen: own devices on demand, guest shares, WebDAV – each may be slow or
// gone, so every method may throw `FilesError` `offline` or `denied`.

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
	/** Replaces the file's content when the stream closes (the parent folder exists) */
	writable(path: string): Promise<WritableStream<FileSystemWriteChunkType>>;
	/** Creates one folder (its parent exists) */
	mkdir(path: string): Promise<void>;
	/** Deletes a file or folder with everything in it (no error if it doesn't exist) */
	remove(path: string): Promise<void>;
	/** Moves or renames inside the source (also in upper/lower case only); `to` doesn't exist, its parent does */
	move(from: string, to: string): Promise<void>;
}
