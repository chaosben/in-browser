import { TEXT_EXTENSIONS } from './kinds.js';
import { extname } from './path.js';

// Which tool opens which files. A **package** is a folder `Name.<ext>/` with `project.json` (`{ format, version, … }`)
// at its root; Files shows it as one file. Large files inside a package are only ever added (new name), never
// overwritten – only small control files like `project.json` change, so syncing file by file stays consistent.
// Tools with simple content use plain files (`kind: 'file'`). Unknown packages appear as normal folders.

export interface Format {
	/** Extension in lower case, with dot */
	ext: string;
	kind: 'package' | 'file';
	/** Tool folder/route (`/screen-capture`) */
	tool: string;
	/** Tool name as shown in the UI (a brand name, not translated) */
	toolName: string;
	/** Page that opens it; gets `?path=<path>` */
	open: string;
	/** Icon of the tool (its favicon) */
	icon: string;
	/**
	 * Only offered under "Open with …": the file belongs to another kind (e.g. SVG is an image, previewed in Files)
	 * and is never opened by double-click, nor does it give the file its icon or kind
	 */
	fallback?: boolean;
}

/** Control file at the root of every package */
export const PACKAGE_MANIFEST = 'project.json';

export const FORMATS: readonly Format[] = [
	{
		ext: '.screencapture',
		kind: 'package',
		tool: 'screen-capture',
		toolName: 'Screen Capture',
		open: '/screen-capture/editor',
		icon: '/screen-capture/favicon.svg'
	},
	{
		ext: '.note',
		kind: 'package',
		tool: 'notes',
		toolName: 'Notes',
		open: '/notes/editor',
		icon: '/notes/favicon.svg'
	},
	// A PDF becomes a new notebook to write on (Notes asks where it goes)
	{
		ext: '.pdf',
		kind: 'file',
		tool: 'notes',
		toolName: 'Notes',
		open: '/notes',
		icon: '/notes/favicon.svg'
	},
	...TEXT_EXTENSIONS.map(
		(ext): Format => ({
			ext,
			kind: 'file',
			tool: 'text-editor',
			toolName: 'Text Editor',
			open: '/text-editor',
			icon: '/text-editor/favicon.svg'
		})
	),
	// An image whose text can be edited
	{ ext: '.svg', kind: 'file', tool: 'text-editor', toolName: 'Text Editor', open: '/text-editor', icon: '/text-editor/favicon.svg', fallback: true }
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

/** Address that opens `path` in the tool of `format` */
export function openUrl(format: Format, path: string): string {
	return `${format.open}?path=${encodeURIComponent(path)}`;
}
