import type { ToolSlug } from '@in-browser/brand/i18n/index.svelte.js';
import { TEXT_EXTENSIONS } from './kinds.js';
import { extname, parent } from './path.js';

// Which tool opens which files. A **package** is a folder `Name.<ext>/` with `project.json` (`{ format, version, … }`)
// at its root; Files shows it as one file. Large files inside a package are only ever added (new name), never
// overwritten – only small control files like `project.json` change, so syncing file by file stays consistent.
// Tools with simple content use plain files (`kind: 'file'`). Unknown packages appear as normal folders.

export interface Format {
	/** Extension in lower case, with dot */
	ext: string;
	kind: 'package' | 'file';
	/** Tool that opens it (its folder; the visible name is `toolName(tool)`) */
	tool: ToolSlug;
	/** Page that opens it; gets `?path=<path>` */
	open: string;
	/**
	 * Only offered under "Open with …": the file belongs to another kind (e.g. SVG is an image, previewed in Files)
	 * and is never opened by double-click, nor does it give the file its icon or kind
	 */
	fallback?: boolean;
}

/** A saved document this version can't read: unknown format, or written by a newer version of the tool */
export class FormatError extends Error {
	constructor(readonly reason: 'unknown' | 'newer') {
		super(reason === 'newer' ? 'created with a newer version' : 'unknown format');
	}
}

export type RawDocument = Record<string, unknown> & { version: number; format?: unknown };

/**
 * Brings a saved document (`project.json` of a package) to the current `version` of `format`, one step per older
 * version (`migrations[n]` goes from n to n + 1; every change of a format adds one, with a test).
 */
export function migrateFormat(raw: unknown, format: string, version: number, migrations: Record<number, (p: RawDocument) => RawDocument>): RawDocument {
	let p = raw as RawDocument;
	if (!p || typeof p !== 'object' || typeof p.version !== 'number') throw new FormatError('unknown');
	if (p.version > version) throw new FormatError('newer');
	while (p.version < version) {
		const step = migrations[p.version];
		if (!step) throw new FormatError('unknown');
		p = step(p);
	}
	if (p.format !== format) throw new FormatError('unknown');
	return p;
}

/** Control file at the root of every package */
export const PACKAGE_MANIFEST = 'project.json';

export const FORMATS: readonly Format[] = [
	{
		ext: '.screencapture',
		kind: 'package',
		tool: 'screen-capture',
		open: '/screen-capture/editor'
	},
	// A font file opens in the tool Fonts (shown, and added to the user's fonts)
	{
		ext: '.ttf',
		kind: 'file',
		tool: 'fonts',
		open: '/fonts/file'
	},
	{
		ext: '.otf',
		kind: 'file',
		tool: 'fonts',
		open: '/fonts/file'
	},
	// JW Library's backups and playlists open in JWL Files (backups also merge, `merge.ts`)
	{
		ext: '.jwlibrary',
		kind: 'file',
		tool: 'jwl',
		open: '/jwl/editor'
	},
	{
		ext: '.jwlplaylist',
		kind: 'file',
		tool: 'jwl',
		open: '/jwl/editor'
	},
	// A PDF opens in the PDF Editor (changed in place)
	{
		ext: '.pdf',
		kind: 'file',
		tool: 'pdf-editor',
		open: '/pdf-editor/editor'
	},
	...TEXT_EXTENSIONS.map(
		(ext): Format => ({
			ext,
			kind: 'file',
			tool: 'text-editor',
			open: '/text-editor/editor'
		})
	),
	// An image whose text can be edited
	{ ext: '.svg', kind: 'file', tool: 'text-editor', open: '/text-editor/editor', fallback: true }
];

/**
 * Formats (and so tools) that open an entry of that name and kind; several mean "Open with …". Fallback formats only
 * with `{ fallback: true }` (they are offered, but never the way the entry opens).
 */
export function formatsOf(name: string, kind: 'file' | 'directory', { fallback = false } = {}): Format[] {
	const ext = extname(name);
	if (!ext) return [];
	return FORMATS.filter((f) => f.ext === ext && (f.kind === 'package') === (kind === 'directory') && (fallback || !f.fallback));
}

/** Folder that a tool treats as one document */
export function isPackage(name: string, kind: 'file' | 'directory'): boolean {
	return kind === 'directory' && formatsOf(name, kind).length > 0;
}

/** The package a path lies inside (the outermost one); `null` outside packages and for a package itself */
export function packageOf(path: string): string | null {
	const parts = path.split('/').filter(Boolean);
	for (let i = 0; i < parts.length - 1; i++) if (isPackage(parts[i], 'directory')) return '/' + parts.slice(0, i + 1).join('/');
	return null;
}

/** “Show in Files”: the address of Files with the folder `path` lies in – the same from every tool */
export const filesUrl = (path: string) => `/files?path=${encodeURIComponent(parent(path))}`;

/** Address that opens `path` in the tool of `format` */
export function openUrl(format: Format, path: string): string {
	return `${format.open}?path=${encodeURIComponent(path)}`;
}
