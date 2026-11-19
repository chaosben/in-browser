// Types shared by fs.ts and the connected sources (`sources/`)

export interface Entry {
	name: string;
	path: string;
	kind: 'file' | 'directory';
	/** Bytes (files only) */
	size?: number;
	/** Last change in ms (files only; OPFS folders have no date) */
	modified?: number;
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
	| 'readOnly';

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
