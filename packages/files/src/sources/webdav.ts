import { FilesError, type Entry } from '../entry.js';
import { basename, nameProblem, parent } from '../path.js';
import { bufferedWritable, rangeReader, send } from './http.js';
import { uriEncode } from './sigv4.js';
import type { Source } from './source.js';

// A WebDAV server (Nextcloud, ownCloud, a NAS, Apache/nginx …) as a connected source: listed with PROPFIND, read with
// range requests, written with PUT, MKCOL, DELETE and MOVE. Needs HTTPS and CORS on the server (help page
// “Connected folders”). Deleting is for good (WebDAV has no trash of its own; Nextcloud keeps one on its side).

export interface WebDavConfig {
	/** Address of the folder on the server that is the connection's root */
	url: string;
	username: string;
	password: () => Promise<string>;
}

const DAV = 'DAV:';

export interface DavEntry extends Entry {
	etag?: string | null;
	type?: string;
}

/** The base address with a trailing slash */
export const davBase = (url: string) => (url.endsWith('/') ? url : url + '/');

/** Address of a path inside the root (each name encoded); folders end with `/` */
export function davUrl(base: string, path: string, folder = false): string {
	const inner = path.split('/').filter(Boolean).map(uriEncode).join('/');
	return davBase(base) + inner + (folder && inner ? '/' : '');
}

const text = (parent: Element, name: string) => parent.getElementsByTagNameNS(DAV, name)[0]?.textContent?.trim() ?? null;

/**
 * The entries of a PROPFIND answer as paths inside the root. Answers name entries by `href` (absolute or relative,
 * encoded in any way the server likes); names we can't take (`nameProblem`) are left out like elsewhere.
 */
export function parsePropfind(xml: string, base: string): DavEntry[] {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const root = decodePath(new URL(davBase(base)).pathname);
	const entries: DavEntry[] = [];
	for (const response of doc.getElementsByTagNameNS(DAV, 'response')) {
		const href = text(response, 'href');
		if (!href) continue;
		const full = decodePath(new URL(href, base).pathname).replace(/\/$/, '');
		if (!(full + '/').startsWith(root)) continue;
		const path = '/' + full.slice(root.length);
		// The properties that were found (a server may answer others with 404 in a second propstat)
		const found = [...response.getElementsByTagNameNS(DAV, 'propstat')].find((p) => /\s200\s/.test(text(p, 'status') ?? ''));
		if (!found) continue;
		const folder = found.getElementsByTagNameNS(DAV, 'collection').length > 0;
		const name = basename(path);
		if (path !== '/' && nameProblem(name)) continue;
		entries.push(
			folder
				? { name, path, kind: 'directory' }
				: {
						name,
						path,
						kind: 'file',
						size: Number(text(found, 'getcontentlength') ?? 0),
						modified: Date.parse(text(found, 'getlastmodified') ?? '') || 0,
						etag: text(found, 'getetag'),
						type: (text(found, 'getcontenttype') ?? '').split(';')[0]
					}
		);
	}
	return entries;
}

/** Free bytes the server reports for the root (`null` when it doesn't) */
export function parseQuota(xml: string): number | null {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const value = Number(doc.getElementsByTagNameNS(DAV, 'quota-available-bytes')[0]?.textContent);
	return Number.isFinite(value) && value >= 0 ? value : null;
}

function decodePath(pathname: string): string {
	return pathname
		.split('/')
		.map((part) => {
			try {
				return decodeURIComponent(part);
			} catch {
				return part;
			}
		})
		.join('/');
}

const PROPS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getetag/><d:getcontenttype/></d:prop></d:propfind>`;
const QUOTA = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:quota-available-bytes/></d:prop></d:propfind>`;

export function webdavSource(config: WebDavConfig): Source & { free(): Promise<number | null> } {
	const base = davBase(config.url);
	let auth: Promise<string> | null = null;
	const authorization = () =>
		(auth ??= config.password().then((password) => {
			const bytes = new TextEncoder().encode(`${config.username}:${password}`);
			return 'Basic ' + btoa(String.fromCharCode(...bytes));
		}));

	async function request(method: string, path: string, init: { folder?: boolean; headers?: Record<string, string>; body?: BodyInit; ok?: (s: number) => boolean } = {}) {
		return send(davUrl(base, path, init.folder), { method, headers: { authorization: await authorization(), ...init.headers }, body: init.body }, path, init.ok);
	}

	async function propfind(path: string, depth: '0' | '1', folder: boolean): Promise<DavEntry[] | null> {
		const response = await request('PROPFIND', path, {
			folder,
			headers: { depth, 'content-type': 'application/xml; charset=utf-8' },
			body: PROPS,
			ok: (s) => s === 207 || s === 404
		});
		if (response.status === 404) return null;
		return parsePropfind(await response.text(), base);
	}

	async function stat(path: string): Promise<DavEntry | null> {
		const entries = await propfind(path, '0', false);
		return entries?.find((e) => e.path === path) ?? entries?.[0] ?? null;
	}

	return {
		caps: { readOnly: false, trash: false },
		async list(path) {
			const entries = await propfind(path, '1', true);
			if (!entries) throw new FilesError('notFound', path);
			return entries.filter((e) => e.path !== path).map(({ etag: _, type: __, ...entry }) => entry);
		},
		async stat(path) {
			const entry = await stat(path);
			if (!entry) return null;
			const { etag: _, type: __, ...rest } = entry;
			return rest;
		},
		async read(path) {
			const response = await request('GET', path);
			const blob = await response.blob();
			return new File([blob], basename(path), { type: blob.type, lastModified: Date.parse(response.headers.get('last-modified') ?? '') || Date.now() });
		},
		async open(path) {
			const entry = await stat(path);
			if (!entry || entry.kind !== 'file') throw new FilesError('notFound', path);
			return rangeReader({ size: entry.size ?? 0, type: entry.type ?? '', modified: entry.modified ?? 0, etag: entry.etag }, (headers) =>
				request('GET', path, { headers })
			);
		},
		writable: (path) =>
			bufferedWritable(async (file) => {
				await request('PUT', path, { body: file, headers: { 'content-type': 'application/octet-stream' } });
			}),
		async mkdir(path) {
			await request('MKCOL', path, { folder: true });
		},
		async remove(path) {
			const entry = await stat(path);
			if (!entry) return;
			await request('DELETE', path, { folder: entry.kind === 'directory', ok: (s) => (s >= 200 && s < 300) || s === 404 });
		},
		async move(from, to) {
			const entry = await stat(from);
			if (!entry) throw new FilesError('notFound', from);
			const folder = entry.kind === 'directory';
			// The parent must exist; WebDAV answers 409 otherwise (not a name clash)
			if (parent(to) !== '/' && !(await stat(parent(to)))) throw new FilesError('notFound', parent(to));
			await request('MOVE', from, { folder, headers: { destination: davUrl(base, to, folder), overwrite: 'F' } });
		},
		async free() {
			const response = await request('PROPFIND', '/', { folder: true, headers: { depth: '0', 'content-type': 'application/xml; charset=utf-8' }, body: QUOTA, ok: (s) => s === 207 });
			return parseQuota(await response.text());
		}
	};
}
