// Types shared by fs.ts and the connected sources (`sources/`)

export interface Entry {
	name: string;
	path: string;
	kind: 'file' | 'directory';
	/** Bytes (files only) */
	size?: number;
	/** Last change in ms (files only; OPFS folders have no date) */
	modified?: number;
	/** Not on this device: opened live from another device (a folder this device doesn't sync) */
	remote?: boolean;
}

export type FilesErrorCode =
	| 'notFound'
	| 'exists'
	| 'collision'
	| 'invalidName'
	| 'intoItself'
	| 'root'
	/** A connected source can't be reached (now) */
	| 'offline'
	/** The browser doesn't (or no longer) allow access to a connected source */
	| 'denied'
	/** A connected source can only be read */
	| 'readOnly'
	/** A guest share was ended or ran out */
	| 'ended'
	/** A guest share is already open in another browser */
	| 'taken'
	/** A server (WebDAV, S3) refused the sign-in data of a connection */
	| 'credentials';

/** Error with a code the UI translates (`filesMessages().errors`) */
export class FilesError extends Error {
	constructor(
		readonly code: FilesErrorCode,
		readonly path: string
	) {
		super(`${code}: ${path}`);
		this.name = 'FilesError';
	}
}
