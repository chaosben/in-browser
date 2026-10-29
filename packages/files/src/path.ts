// Paths of the shared file system: POSIX-like, absolute, root `/`, no trailing slash (`/Screen Capture/Demo.screencapture`).
// Names must be valid on every desktop system, because the content is mirrored into a real folder (sync).

/** Normalized absolute path: collapses slashes, resolves `.` and `..` (never above the root). */
export function normalize(path: string): string {
	const parts: string[] = [];
	for (const part of path.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') parts.pop();
		else parts.push(part);
	}
	return '/' + parts.join('/');
}

export function join(...parts: string[]): string {
	return normalize(parts.join('/'));
}

/** Names from the root, `[]` for `/` */
export function segments(path: string): string[] {
	return normalize(path).split('/').filter(Boolean);
}

export function basename(path: string): string {
	return segments(path).at(-1) ?? '';
}

/** Parent folder; `/` stays `/` */
export function parent(path: string): string {
	return '/' + segments(path).slice(0, -1).join('/');
}

/** Extension in lower case including the dot (`.screencapture`), `''` without one; `.hidden` has none */
export function extname(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/** Name without extension */
export function stem(name: string): string {
	const ext = extname(name);
	return ext ? name.slice(0, -ext.length) : name;
}

/** `path` is `folder` itself or lies inside it */
export function isInside(path: string, folder: string): boolean {
	const p = normalize(path);
	const f = normalize(folder);
	return f === '/' || p === f || p.startsWith(f + '/');
}

/** Some part of the path starts with a dot (hidden in the file manager, e.g. `/.apps/…`) */
export function isHidden(path: string): boolean {
	return segments(path).some((name) => name.startsWith('.'));
}

export type NameProblem = 'empty' | 'dots' | 'chars' | 'reserved' | 'trailing' | 'long';

// Forbidden on Windows (and `/` everywhere); control characters as well
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i;

/** Why a file or folder name is not allowed, `null` if it is fine. */
export function nameProblem(name: string): NameProblem | null {
	if (!name.trim()) return 'empty';
	if (name === '.' || name === '..') return 'dots';
	if (FORBIDDEN.test(name)) return 'chars';
	if (RESERVED.test(name)) return 'reserved';
	if (/[ .]$/.test(name) || /^ /.test(name)) return 'trailing';
	if (new TextEncoder().encode(name).length > 255) return 'long';
	return null;
}

/** Key under which two names collide on case-insensitive systems (Windows, macOS) */
export function nameKey(name: string): string {
	return name.normalize('NFC').toLowerCase();
}

/** `name`, or with ` (2)`, ` (3)` … before the extension if it is taken (case-insensitive). */
export function uniqueName(name: string, taken: Iterable<string>): string {
	const keys = new Set([...taken].map(nameKey));
	if (!keys.has(nameKey(name))) return name;
	const ext = extname(name);
	const base = stem(name).replace(/ \(\d+\)$/, '');
	for (let i = 2; ; i++) {
		const candidate = `${base} (${i})${ext ? name.slice(-ext.length) : ''}`;
		if (!keys.has(nameKey(candidate))) return candidate;
	}
}

/** Valid file name from any title: forbidden characters become `-`, edges are trimmed; `fallback` if nothing is left */
export function safeName(title: string, fallback: string): string {
	let name = title.replace(new RegExp(FORBIDDEN.source, 'g'), '-').replace(/\s+/g, ' ').trim().replace(/[ .]+$/, '');
	if (new TextEncoder().encode(name).length > 200) name = name.slice(0, 100).trim();
	return !name || nameProblem(name) ? fallback : name;
}
